"""Scaffold a fresh project workspace from the engine's `scaffold/` template.

`run-pipeline.py init <name>` copies the template (config + .env + doc
templates + e2e oracle + deploy files, but NOT the engine code — that stays
shared) into a new workspace directory, customizes the project name/type, seeds
the requirements brief, and git-inits it. The engine then operates on it via
`--workspace <dir>`.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from pipeline.config import ENGINE_ROOT, VALID_PROJECT_TYPES

SCAFFOLD = ENGINE_ROOT / "scaffold"


def init_workspace(dest: Path, name: str, ptype: str = "b2b_console",
                   brief: str | None = None) -> Path:
    if ptype not in VALID_PROJECT_TYPES:
        raise SystemExit(f"project.type '{ptype}' not one of {sorted(VALID_PROJECT_TYPES)}")
    if not SCAFFOLD.exists():
        raise SystemExit(f"scaffold template missing at {SCAFFOLD}")
    if dest.exists() and any(dest.iterdir()):
        raise SystemExit(f"workspace already exists and is not empty: {dest}")

    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SCAFFOLD, dest, dirs_exist_ok=True)

    _customize_config(dest / ".pipeline" / "config.yaml", name, ptype)
    _seed_env(dest / ".env", dest / ".env.example", ptype)
    _seed_brief(dest, brief)
    _git_init(dest)
    return dest


def _customize_config(path: Path, name: str, ptype: str) -> None:
    s = path.read_text(encoding="utf-8")
    s = re.sub(r'(name:\s*)"[^"]*"', rf'\1"{name}"', s, count=1)
    s = re.sub(r'(type:\s*)"[^"]*"', rf'\1"{ptype}"', s, count=1)
    path.write_text(s, encoding="utf-8")


def _seed_env(env_path: Path, example: Path, ptype: str) -> None:
    # start from .env.example, default to the local Ollama provider, set
    # PROJECT_TYPE to match config (the loader errors if they disagree), and
    # inherit the engine's working LLM/OLLAMA settings so a fresh workspace
    # points at a model that's actually installed (the example ships a
    # placeholder model name).
    text = example.read_text(encoding="utf-8") if example.exists() else ""
    text = re.sub(r"^LLM_PROVIDER=.*$", "LLM_PROVIDER=ollama", text, flags=re.M)
    engine_env = _parse_env(ENGINE_ROOT / ".env")
    for key in ("OLLAMA_MODEL", "OLLAMA_HOST", "LLM_MODEL"):
        if key in engine_env:
            if re.search(rf"^{key}=.*$", text, flags=re.M):
                text = re.sub(rf"^{key}=.*$", f"{key}={engine_env[key]}", text, flags=re.M)
            else:
                text += f"\n{key}={engine_env[key]}\n"
    if "PROJECT_TYPE=" in text:
        text = re.sub(r"^PROJECT_TYPE=.*$", f"PROJECT_TYPE={ptype}", text, flags=re.M)
    else:
        text += f"\nPROJECT_TYPE={ptype}\n"
    env_path.write_text(text, encoding="utf-8")


def _parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def _seed_brief(dest: Path, brief: str | None) -> None:
    target = dest / "00_input" / "brief.md"
    (dest / "00_input").mkdir(exist_ok=True)
    if brief:
        src = Path(brief)
        if not src.exists():
            raise SystemExit(f"--brief file not found: {src}")
        target.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        target.write_text(
            "# Requirements brief\n\n"
            "Describe the product for the pipeline to plan from. Include the user,\n"
            "the stories (### STORY headings), domain rules, and an explicit\n"
            "out-of-scope list. See config.yaml `requirements.anchors` /\n"
            "`out_of_scope` to make the plan-fidelity checks enforce your terms.\n",
            encoding="utf-8")
    # remove the placeholder .gitkeep now that a brief exists
    (dest / "00_input" / ".gitkeep").unlink(missing_ok=True)


def _git_init(dest: Path) -> None:
    try:
        subprocess.run(["git", "init", "-q"], cwd=dest, check=True)
        subprocess.run(["git", "add", "-A"], cwd=dest, check=True,
                       capture_output=True)
        subprocess.run(["git", "commit", "-qm", "workspace baseline (scaffolded)"],
                       cwd=dest, check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        pass  # git optional; scaffold is still usable
