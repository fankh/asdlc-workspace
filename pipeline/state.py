"""Control plane: .pipeline/state.json load/save and per-stage bookkeeping."""

from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_KEYS = {
    "current_phase": "00_input",
    "started_at": None,
    "last_updated_at": None,
    "phase_history": [],
    "refinement_loops": 0,
    "human_intervention_required": False,
    # extensions beyond the scaffold's original contract
    "stages": {},          # {stage_name: {status, started_at, finished_at, error}}
    "usage": {},           # {stage_name: {input_tokens, output_tokens, cache_read, cache_write, cost_usd}}
    "total_cost_usd": 0.0,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class State:
    def __init__(self, path: Path):
        self.path = path
        # deep copy: STATE_KEYS holds mutable defaults that must never be
        # shared between State instances (or mutated in place)
        self.data: dict[str, Any] = copy.deepcopy(STATE_KEYS)
        if path.exists():
            self.data.update(json.loads(path.read_text(encoding="utf-8")))
        for key, default in STATE_KEYS.items():
            self.data.setdefault(key, copy.deepcopy(default))

    def save(self) -> None:
        self.data["last_updated_at"] = _now()
        self.path.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")

    # -- stage bookkeeping ----------------------------------------------

    def stage_status(self, name: str) -> str:
        return self.data["stages"].get(name, {}).get("status", "pending")

    def stage_start(self, name: str, phase_dir: str) -> None:
        if self.data["started_at"] is None:
            self.data["started_at"] = _now()
        self.data["current_phase"] = phase_dir
        self.data["stages"][name] = {"status": "running", "started_at": _now()}
        self.save()

    def stage_done(self, name: str) -> None:
        entry = self.data["stages"].setdefault(name, {})
        entry.update(status="done", finished_at=_now(), error=None)
        history = self.data["phase_history"]
        if name not in history:
            history.append(name)
        self.save()

    def stage_failed(self, name: str, error: str) -> None:
        entry = self.data["stages"].setdefault(name, {})
        entry.update(status="failed", finished_at=_now(), error=error)
        self.save()

    def record_usage(self, stage: str, usage: dict[str, Any]) -> None:
        agg = self.data["usage"].setdefault(stage, {
            "input_tokens": 0, "output_tokens": 0,
            "cache_read": 0, "cache_write": 0, "cost_usd": 0.0,
        })
        for key in agg:
            agg[key] += usage.get(key, 0)
        self.data["total_cost_usd"] = round(
            sum(u.get("cost_usd", 0.0) for u in self.data["usage"].values()), 4
        )
        self.save()

    def require_human(self, reason: str) -> None:
        self.data["human_intervention_required"] = True
        self.data["human_intervention_reason"] = reason
        self.save()

    def reset(self) -> None:
        self.data = copy.deepcopy(STATE_KEYS)
        self.save()
