"""Loop configuration + metrics tests (no LLM / docker / processes)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import loopcfg, loopmetrics  # noqa: E402


@pytest.fixture
def root(tmp_path: Path) -> Path:
    (tmp_path / ".pipeline").mkdir()
    return tmp_path


def test_defaults_when_no_file(root: Path):
    s = loopcfg.load(root)
    assert s["priority"] == ["improve", "watch"]
    assert s["watch"]["interval"] == 300
    assert s["improve"]["target"].startswith("http")


def test_partial_save_merges_and_persists(root: Path):
    ok, _ = loopcfg.save(root, {"improve": {"interval": 600, "max_cycles": 3}})
    assert ok
    s = loopcfg.load(root)
    assert s["improve"]["interval"] == 600 and s["improve"]["max_cycles"] == 3
    assert s["watch"]["interval"] == 300  # untouched default preserved


@pytest.mark.parametrize("bad,frag", [
    ({"watch": {"interval": 2}}, "interval"),
    ({"improve": {"interval": 300, "target": "ftp://x"}}, "URL"),
    ({"improve": {"max_cycles": 0}}, "max_cycles"),
])
def test_validation_rejects(root: Path, bad: dict, frag: str):
    ok, msg = loopcfg.save(root, bad)
    assert not ok and frag in msg


def test_partial_priority_is_completed(root: Path):
    # UI may send only the higher-priority pick; the other is appended.
    ok, _ = loopcfg.save(root, {"priority": ["watch"]})
    assert ok
    assert loopcfg.load(root)["priority"] == ["watch", "improve"]


def test_argv_reflects_settings(root: Path):
    loopcfg.save(root, {"watch": {"interval": 120, "deploy": False},
                        "improve": {"interval": 600, "target": "http://localhost:8089",
                                    "deploy": False, "max_cycles": 2}})
    assert loopcfg.watch_argv(root) == ["watch", "--interval", "120"]  # no --deploy
    im = loopcfg.improve_argv(root)
    assert im[:5] == ["improve", "--interval", "600", "--target", "http://localhost:8089"]
    assert "--no-deploy" in im and "--max-cycles" in im


def test_should_yield_respects_priority(root: Path, monkeypatch):
    loopcfg.save(root, {"priority": ["improve", "watch"]})
    # pretend improve is running, watch is not
    monkeypatch.setattr(loopcfg, "loop_running",
                        lambda r, n: n == "improve")
    assert loopcfg.should_yield(root, "watch") == "improve"  # lower yields
    assert loopcfg.should_yield(root, "improve") is None     # higher never yields


def test_metrics_average_excludes_idle(root: Path):
    loopmetrics.record(root, "watch", 100.0, 145.0, "run-green")  # 45s work
    loopmetrics.record(root, "watch", 200.0, 200.2, "idle")       # not work
    loopmetrics.record(root, "watch", 300.0, 300.0, "yielded:improve")
    s = loopmetrics.summary(root, "watch")
    assert s["cycles"] == 3 and s["work_cycles"] == 1
    assert s["avg_duration_s"] == 45.0
    assert s["last_outcome"] == "yielded:improve"


def test_metrics_ring_caps_entries(root: Path):
    for i in range(loopmetrics.RING + 10):
        loopmetrics.record(root, "improve", float(i), float(i) + 1, "idle")
    assert loopmetrics.summary(root, "improve")["cycles"] == loopmetrics.RING
