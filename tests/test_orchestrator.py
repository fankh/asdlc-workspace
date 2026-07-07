"""Orchestrator/state machine tests — no LLM calls, temp workspace."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.config import Config  # noqa: E402
from pipeline.orchestrator import Orchestrator  # noqa: E402
from pipeline.stages import STAGES, clear_markers, marker_path, stage_by_name  # noqa: E402
from pipeline.state import State  # noqa: E402


@pytest.fixture
def workspace(tmp_path: Path) -> Config:
    for stage in STAGES:
        (tmp_path / stage.output_dir).mkdir(exist_ok=True)
    (tmp_path / ".pipeline").mkdir()
    (tmp_path / "CODING_PATTERNS.md").write_text("# patterns\n", encoding="utf-8")
    return Config(
        root=tmp_path,
        project={"name": "t", "type": "b2b_console", "mode": "new"},
        agents={},
        refinement={"max_loops": 2, "on_overflow": "HUMAN_INTERVENTION_REQUIRED"},
        phases={"stop_after": None},
        env={"PIPELINE_AUTO_COMMIT": "false"},
    )


def make_orch(config: Config, dry_run: bool = True) -> Orchestrator:
    state = State(config.root / ".pipeline" / "state.json")
    return Orchestrator(config, state, dry_run=dry_run)


def test_dry_run_completes_all_stages(workspace: Config):
    orch = make_orch(workspace)
    assert orch.run() is True
    for stage in STAGES:
        assert orch.state.stage_status(stage.name) == "done"
        if stage.writes_marker:
            assert marker_path(workspace.root, stage).exists()


def test_stop_after_alias_halts(workspace: Config):
    orch = make_orch(workspace)
    assert orch.run(stop_after="specs") is True
    assert orch.state.stage_status("product") == "done"
    assert orch.state.stage_status("design") == "pending"


def test_resume_skips_completed(workspace: Config):
    orch = make_orch(workspace)
    orch.run(stop_after="specs")
    # a fresh orchestrator (new state object) must respect markers/state
    orch2 = make_orch(workspace)
    assert orch2.run() is True
    assert orch2.state.stage_status("docs") == "done"


def test_reset_clears_markers(workspace: Config):
    orch = make_orch(workspace)
    orch.run()
    removed = clear_markers(workspace.root)
    assert len(removed) == sum(1 for s in STAGES if s.writes_marker)


def test_human_intervention_blocks_run(workspace: Config):
    orch = make_orch(workspace)
    orch.state.require_human("test reason")
    assert orch.run() is False


def test_state_json_shape(workspace: Config):
    orch = make_orch(workspace)
    orch.run(stop_after="specs")
    data = json.loads((workspace.root / ".pipeline" / "state.json").read_text())
    assert data["human_intervention_required"] is False
    assert "ingest" in data["phase_history"]
    assert data["current_phase"] == "02_specs"


def test_unknown_stage_raises():
    with pytest.raises(KeyError):
        stage_by_name("nope")


def test_mode_autodetects_maintenance(workspace: Config):
    assert workspace.mode == "new"
    app = workspace.root / "04_source" / "frontend" / "src" / "App.tsx"
    app.parent.mkdir(parents=True)
    app.write_text("export default function App() {}\n", encoding="utf-8")
    assert workspace.mode == "maintenance"
    # explicit declaration always wins
    workspace.project["mode"] = "new_forced"  # any non-"new" value passes through
    assert workspace.mode == "new_forced"
