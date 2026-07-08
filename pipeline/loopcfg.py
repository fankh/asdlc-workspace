"""Loop configuration: timers, deploy flags, targets, and priority.

Loop settings have no home in the commented ``config.yaml`` (round-tripping
that file would destroy its comments, and ``ruamel`` isn't installed), so they
live in a small machine-managed ``.pipeline/loops.json`` that the dashboard's
Pipeline Configuration form owns end-to-end.

``priority`` is an ordered list — earlier means higher. It is enforced, not
advisory: ``should_yield`` lets a running higher-priority loop make the other
skip its tick, so watch and improve never fight over the same tickets/git tree.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

LOOPS = ("improve", "watch")

DEFAULTS: dict = {
    "priority": ["improve", "watch"],
    "watch": {"interval": 300, "deploy": True},
    "improve": {
        "interval": 1800,
        "target": "http://localhost:8088",
        "deploy": True,
        "max_cycles": None,
    },
}

MIN_INTERVAL = 10  # guard against a busy-loop


def _path(root: Path) -> Path:
    return root / ".pipeline" / "loops.json"


def load(root: Path) -> dict:
    """Defaults deep-merged with whatever the form has saved."""
    settings = json.loads(json.dumps(DEFAULTS))  # deep copy
    path = _path(root)
    if path.exists():
        try:
            saved = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return settings
        if isinstance(saved.get("priority"), list):
            settings["priority"] = _norm_priority(saved["priority"])
        for name in LOOPS:
            if isinstance(saved.get(name), dict):
                settings[name].update(saved[name])
    return settings


def _norm_priority(order: list) -> list[str]:
    seen = [x for x in order if x in LOOPS]
    for name in LOOPS:  # append any missing loop, stable
        if name not in seen:
            seen.append(name)
    return seen


def validate(settings: dict) -> tuple[bool, str]:
    if not isinstance(settings, dict):
        return False, "loop settings must be an object"
    order = settings.get("priority", DEFAULTS["priority"])
    if sorted(_norm_priority(order)) != sorted(LOOPS):
        return False, "priority must order exactly: " + ", ".join(LOOPS)
    for name in LOOPS:
        node = settings.get(name, {})
        if not isinstance(node, dict):
            return False, f"{name} settings must be an object"
        iv = node.get("interval", DEFAULTS[name]["interval"])
        if not isinstance(iv, int) or iv < MIN_INTERVAL:
            return False, f"{name}.interval must be an integer >= {MIN_INTERVAL}s"
        if "deploy" in node and not isinstance(node["deploy"], bool):
            return False, f"{name}.deploy must be true/false"
    target = settings.get("improve", {}).get("target", "")
    if not str(target).startswith(("http://", "https://")):
        return False, "improve.target must be an http(s) URL"
    mc = settings.get("improve", {}).get("max_cycles")
    if mc is not None and (not isinstance(mc, int) or mc < 1):
        return False, "improve.max_cycles must be blank or an integer >= 1"
    return True, "ok"


def save(root: Path, settings: dict) -> tuple[bool, str]:
    merged = load(root)  # start from current+defaults so partial saves are safe
    if isinstance(settings.get("priority"), list):
        merged["priority"] = _norm_priority(settings["priority"])
    for name in LOOPS:
        if isinstance(settings.get(name), dict):
            merged[name].update(settings[name])
    ok, msg = validate(merged)
    if not ok:
        return False, msg
    _path(root).write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")
    return True, "saved loop settings"


# -- argv builders: the dashboard Start buttons read these --------------------

def watch_argv(root: Path) -> list[str]:
    w = load(root)["watch"]
    argv = ["watch", "--interval", str(w["interval"])]
    if w.get("deploy", True):
        argv.append("--deploy")
    return argv


def improve_argv(root: Path) -> list[str]:
    im = load(root)["improve"]
    argv = ["improve", "--interval", str(im["interval"]),
            "--target", im["target"]]
    if not im.get("deploy", True):
        argv.append("--no-deploy")
    if im.get("max_cycles"):
        argv += ["--max-cycles", str(im["max_cycles"])]
    return argv


# -- priority enforcement -----------------------------------------------------

def _pid_alive(pid: int) -> bool:
    if sys.platform == "win32":
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                             capture_output=True, text=True)
        return str(pid) in out.stdout
    try:
        import os
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def loop_running(root: Path, name: str) -> bool:
    lock = root / ".pipeline" / f"{name}.lock"
    if not lock.exists():
        return False
    try:
        return _pid_alive(int(lock.read_text(encoding="utf-8").strip()))
    except (ValueError, OSError):
        return False


def should_yield(root: Path, me: str) -> str | None:
    """Name of a *higher-priority* loop currently running, or None.

    Called at the top of each loop's tick so the lower-priority loop skips
    work while the higher-priority one holds the field."""
    order = load(root)["priority"]
    if me not in order:
        return None
    for other in order[: order.index(me)]:
        if other != me and loop_running(root, other):
            return other
    return None
