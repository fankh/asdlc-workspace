"""Watcher decision-logic tests — no LLM, no subprocess pipeline runs."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.config import Config  # noqa: E402
from pipeline.stages import STAGES, clear_markers_from, marker_path  # noqa: E402
from pipeline.watcher import Watcher  # noqa: E402


@pytest.fixture
def workspace(tmp_path: Path) -> Config:
    for stage in STAGES:
        (tmp_path / stage.output_dir).mkdir(exist_ok=True)
        if stage.writes_marker:
            marker_path(tmp_path, stage).write_text("done\n")
    (tmp_path / ".pipeline").mkdir()
    (tmp_path / "00_input").mkdir(exist_ok=True)
    (tmp_path / "00_input" / "brief.md").write_text("v1", encoding="utf-8")
    return Config(root=tmp_path, project={"mode": "new"}, agents={},
                  refinement={}, phases={},
                  env={"LLM_PROVIDER": "anthropic"})  # skips the ollama ping


class RecordingWatcher(Watcher):
    def __init__(self, config):
        super().__init__(config)
        self.ran_from: list[str] = []

    def _run_pipeline(self, first_stage: str) -> str:
        clear_markers_from(self.root, first_stage)
        self.ran_from.append(first_stage)
        self._save({"inputs": __import__("pipeline.watcher", fromlist=["input_digest"]).input_digest(self.root),
                    "tickets": __import__("pipeline.watcher", fromlist=["tickets_digest"]).tickets_digest(self.root)})
        return "run-green"


def test_first_tick_records_baseline(workspace: Config):
    watcher = RecordingWatcher(workspace)
    assert watcher.tick() == "baseline"
    assert watcher.tick() == "idle"
    assert watcher.ran_from == []


def test_input_change_triggers_run_from_ingest(workspace: Config):
    watcher = RecordingWatcher(workspace)
    watcher.tick()  # baseline
    (workspace.root / "00_input" / "brief.md").write_text("v2", encoding="utf-8")
    assert watcher.tick() == "run-green"
    assert watcher.ran_from == ["ingest"]
    # every marker from ingest onward was cleared by the run trigger
    assert not marker_path(workspace.root, STAGES[0]).exists()
    assert watcher.tick() == "idle"  # digest updated after the run


def test_ticket_change_triggers_run_from_product(workspace: Config):
    watcher = RecordingWatcher(workspace)
    watcher.tick()  # baseline
    tickets = workspace.root / "01_requirements" / "discovered" / "tickets"
    tickets.mkdir(parents=True)
    (tickets / "PROBLEM-001.md").write_text("# P1 — thing", encoding="utf-8")
    assert watcher.tick() == "run-green"
    assert watcher.ran_from == ["product"]
    # ingest untouched, product onward cleared
    assert marker_path(workspace.root, STAGES[0]).exists()


def test_human_flag_blocks(workspace: Config):
    from pipeline.state import State
    state = State(workspace.root / ".pipeline" / "state.json")
    state.require_human("test")
    watcher = RecordingWatcher(workspace)
    assert watcher.tick() == "blocked"
    assert watcher.ran_from == []


def test_clear_markers_from_midpoint(workspace: Config):
    removed = clear_markers_from(workspace.root, "product")
    names = {p.parent.name for p in removed}
    assert "01_requirements" not in names
    assert "02_specs" in names and "06_docs" in names
