"""Data plane: the ordered stage graph and .status_done marker contract.

Each stage maps to the agent that runs it and the numbered folder it fills.
A folder's .status_done marker is written when the LAST stage targeting that
folder completes — this preserves the scaffold's phase-advance contract while
letting two agents share a folder (design+architect -> 03_architecture).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Stage:
    name: str            # orchestrator/CLI name
    agent: str           # key in the agent registry
    output_dir: str      # numbered folder this stage writes into
    writes_marker: bool  # last stage for its folder -> writes .status_done
    config_key: str      # agents.* key in config.yaml gating this stage
    # stop_after aliases from config.yaml phases.stop_after
    phase_alias: str = ""


# Linear default sequence. `discover` is not here: it is an on-demand stage
# (run-pipeline.py --stage discover) that feeds 01_requirements from a live app.
STAGES: list[Stage] = [
    Stage("ingest",        "ingestion",      "01_requirements", True,  "ingestion"),
    Stage("product",       "product",        "02_specs",        True,  "product",  "specs"),
    Stage("design",        "design",         "03_architecture", False, "design"),
    Stage("architect",     "architect",      "03_architecture", True,  "architect", "architecture"),
    Stage("code_frontend", "coder_frontend", "04_source",       False, "coder"),
    Stage("code_backend",  "coder_backend",  "04_source",       False, "coder"),
    Stage("testgen",       "testgen",        "04_source",       True,  "qa",       "code"),
    Stage("secops",        "secops",         "05_test_reports", False, "secops"),
    Stage("qa",            "qa",             "05_test_reports", True,  "qa",       "test"),
    Stage("docs",          "docs",           "06_docs",         True,  "docs"),
]

ON_DEMAND_STAGES: list[Stage] = [
    Stage("discover", "discovery", "01_requirements", False, "ingestion"),
    Stage("audit",    "audit",     "05_test_reports", False, "qa"),
]

MARKER = ".status_done"


def stage_by_name(name: str) -> Stage:
    for stage in STAGES + ON_DEMAND_STAGES:
        if stage.name == name:
            return stage
    valid = [s.name for s in STAGES + ON_DEMAND_STAGES]
    raise KeyError(f"unknown stage '{name}' (valid: {valid})")


def marker_path(root: Path, stage: Stage) -> Path:
    return root / stage.output_dir / MARKER


def write_marker(root: Path, stage: Stage) -> None:
    if stage.writes_marker:
        marker_path(root, stage).write_text("done\n", encoding="utf-8")


def clear_markers_from(root: Path, first_stage: str) -> list[Path]:
    """Remove .status_done markers for `first_stage` and everything after it,
    so the next run re-executes the pipeline from that point (maintenance)."""
    names = [s.name for s in STAGES]
    removed = []
    for stage in STAGES[names.index(first_stage):]:
        path = marker_path(root, stage)
        if stage.writes_marker and path.exists():
            path.unlink()
            removed.append(path)
    return removed


def clear_markers(root: Path) -> list[Path]:
    removed = []
    for stage in STAGES:
        path = marker_path(root, stage)
        if path.exists():
            path.unlink()
            removed.append(path)
    return removed


def matches_stop_after(stage: Stage, stop_after: str | None) -> bool:
    """True when the pipeline should halt after this stage."""
    if not stop_after:
        return False
    return stop_after in (stage.name, stage.phase_alias)
