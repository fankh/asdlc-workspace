"""Self-improvement loop branching tests (no LLM / docker / git)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.config import Config  # noqa: E402
from pipeline.improve import SelfImproveLoop, _title_hash  # noqa: E402
from pipeline.stages import STAGES, marker_path  # noqa: E402


@pytest.fixture
def workspace(tmp_path: Path) -> Config:
    for stage in STAGES:
        (tmp_path / stage.output_dir).mkdir(parents=True, exist_ok=True)
    (tmp_path / ".pipeline").mkdir()
    (tmp_path / "01_requirements" / "discovered" / "tickets").mkdir(parents=True)
    return Config(root=tmp_path, project={}, agents={}, refinement={}, phases={},
                  env={"LLM_PROVIDER": "anthropic"})


TICKETS = "01_requirements/discovered/tickets"
DEFERRED = "01_requirements/discovered/deferred"


class StubLoop(SelfImproveLoop):
    """Stubs external effects; scripts audit output + QA result per test."""
    def __init__(self, config, *, audit_writes=(), qa_green=True):
        super().__init__(config, target="http://localhost:8088", deploy=True)
        self._audit_writes = audit_writes
        self._qa_green_val = qa_green
        self.actions: list[str] = []

    def _target_up(self): return True
    def _llm_up(self): return True
    def _git_head(self): return "GOOD"
    def _git_reset(self, c): self.actions.append(f"reset:{c}")
    def _clear_human_flag(self): self.actions.append("clear-flag")
    def _deploy_result(self, n): self.actions.append(f"deploy:{n}"); return f"shipped:{n}"

    def _run(self, args, env=None):
        self.actions.append("run:" + " ".join(args))
        if args[:2] == ["run", "--stage"] and "audit" in args:
            tdir = self.root / TICKETS
            for name, title in self._audit_writes:
                (tdir / name).write_text(f"# P1 — {title}\n\nbody\n", encoding="utf-8")
        return True

    def _qa_green(self): return self._qa_green_val


def test_no_new_problems_idles(workspace):
    loop = StubLoop(workspace, audit_writes=())  # audit files nothing
    assert loop.cycle(1) == "no-new-problems"
    assert not any(a.startswith("deploy") for a in loop.actions)


def test_green_fix_ships(workspace):
    loop = StubLoop(workspace, audit_writes=[("PROBLEM-001.md", "missing h1")], qa_green=True)
    assert loop.cycle(1) == "shipped:1"
    assert "deploy:1" in loop.actions
    assert not any(a.startswith("reset") for a in loop.actions)


def test_red_fix_rolls_back_and_defers(workspace):
    loop = StubLoop(workspace, audit_writes=[("PROBLEM-001.md", "flaky thing")], qa_green=False)
    outcome = loop.cycle(1)
    assert outcome == "deferred:1"
    assert "reset:GOOD" in loop.actions        # rolled back to last-good
    assert "clear-flag" in loop.actions
    assert not any(a.startswith("deploy") for a in loop.actions)  # never shipped
    assert (workspace.root / DEFERRED).exists() and \
        len(list((workspace.root / DEFERRED).glob("PROBLEM-*.md"))) == 1


def test_title_hash_ignores_ticket_number():
    assert _title_hash("# P1 — Missing heading (PROBLEM-003)") == \
        _title_hash("# P1 — Missing heading (PROBLEM-099)")
