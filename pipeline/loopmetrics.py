"""Per-loop cycle metrics — the feedback needed to tune timers and priority.

Each loop appends one record per tick to a small ring buffer
``.pipeline/{loop}-metrics.json`` (last N cycles). The dashboard reads the
summary: last outcome, cycle count, and — the number that actually matters for
picking an interval — how long a cycle really takes.

Durations are wall-clock seconds. Ticks that did no real work (idle, yielded,
llm-down, target-down, baseline) are recorded but excluded from the average, so
``avg_duration_s`` reflects real build cycles, not polls.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

RING = 50
IDLE_OUTCOMES = {"idle", "baseline", "llm-down", "target-down", "no-new-problems"}


def _path(root: Path, loop: str) -> Path:
    return root / ".pipeline" / f"{loop}-metrics.json"


def record(root: Path, loop: str, started: float, ended: float, outcome: str) -> None:
    path = _path(root, loop)
    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(entries, list):
            entries = []
    except (json.JSONDecodeError, OSError):
        entries = []
    entries.append({"ts": round(ended, 3),
                    "dur": round(max(0.0, ended - started), 3),
                    "outcome": outcome})
    entries = entries[-RING:]
    try:
        path.write_text(json.dumps(entries) + "\n", encoding="utf-8")
    except OSError:
        pass  # metrics are best-effort; never break a loop over them


def _is_work(outcome: str) -> bool:
    head = outcome.split(":", 1)[0]
    return head not in IDLE_OUTCOMES and not head.startswith("yielded")


def summary(root: Path, loop: str) -> dict:
    try:
        entries = json.loads(_path(root, loop).read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        entries = []
    if not entries:
        return {"cycles": 0, "last_outcome": None, "last_run_ts": None,
                "last_duration_s": None, "avg_duration_s": None,
                "work_cycles": 0}
    work = [e for e in entries if _is_work(e.get("outcome", ""))]
    durs = [e["dur"] for e in work if e.get("dur")]
    last = entries[-1]
    return {
        "cycles": len(entries),
        "work_cycles": len(work),
        "last_outcome": last.get("outcome"),
        "last_run_ts": last.get("ts"),
        "last_duration_s": last.get("dur"),
        "avg_duration_s": round(sum(durs) / len(durs), 1) if durs else None,
    }


def now() -> float:
    return time.time()
