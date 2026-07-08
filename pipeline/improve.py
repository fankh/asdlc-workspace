"""Self-improvement loop: audit the deployed app, fix problems, redeploy.

Each cycle:
  1. Snapshot the last-good git commit.
  2. Audit the running app (`--stage audit`) -> new PROBLEM tickets.
  3. If there are new problems, run the maintenance pipeline: the product stage
     folds the tickets into the backlog, the coders produce deltas, and the QA
     gate verifies the whole contract.
  4. GREEN  -> rebuild + redeploy (the improvement ships).
     RED    -> roll the working tree back to last-good, move the offending
               tickets to `deferred/` so they are never retried, and leave the
               LIVE app untouched.

Safety invariants:
  - Never deploys a red build; a failed auto-fix leaves the running app as-is.
  - Never thrashes: an unfixable problem is deferred after one attempt and the
    audit stops re-filing it.
  - Singleton via .pipeline/improve.lock; activity logged to improve.log.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

from pipeline import loopcfg, loopmetrics
from pipeline.config import Config
from pipeline.stages import clear_markers_from
from pipeline.state import State

log = logging.getLogger("pipeline")

TICKETS = "01_requirements/discovered/tickets"
DEFERRED = "01_requirements/discovered/deferred"


def _title_hash(text: str) -> str:
    title = next((ln for ln in text.splitlines() if ln.startswith("#")), text[:100])
    normalized = re.sub(r"(PROBLEM|TICKET)-\d+", "", title).strip().lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


def _ticket_titles(directory: Path) -> dict[str, Path]:
    """title-hash -> path for every PROBLEM ticket in a folder."""
    if not directory.exists():
        return {}
    return {_title_hash(p.read_text(encoding="utf-8")): p
            for p in directory.glob("PROBLEM-*.md")}


class SelfImproveLoop:
    def __init__(self, config: Config, target: str, deploy: bool = True):
        self.config = config
        self.root = config.root
        self.target = target.rstrip("/")
        self.deploy = deploy
        self.py = sys.executable
        self.cli = str(self.root / "run-pipeline.py")

    # -- public API -------------------------------------------------------

    def loop(self, interval: int, max_cycles: int | None = None, once: bool = False) -> None:
        if not once and not self._acquire_lock():
            log.warning("improve: another loop is already running — exiting")
            return
        log.info("improve: target=%s | interval=%ds | deploy=%s | provider=%s",
                 self.target, interval, self.deploy, self.config.llm_provider)
        cycle = 0
        while True:
            cycle += 1
            started = loopmetrics.now()
            try:
                blocker = loopcfg.should_yield(self.root, "improve")
                if blocker:
                    outcome = f"yielded:{blocker}"
                    log.info("improve: yielding to higher-priority %s loop", blocker)
                else:
                    outcome = self.cycle(cycle)
                log.info("improve: cycle %d -> %s", cycle, outcome)
            except Exception:
                outcome = "crashed"
                log.exception("improve: cycle %d crashed (loop continues)", cycle)
            loopmetrics.record(self.root, "improve", started, loopmetrics.now(), outcome)
            if once or (max_cycles and cycle >= max_cycles):
                return
            time.sleep(interval)

    def cycle(self, n: int) -> str:
        if not self._target_up():
            return "target-down"
        if not self._llm_up():
            return "llm-down"

        tickets_dir = self.root / TICKETS
        before = set(_ticket_titles(tickets_dir))

        log.info("improve: cycle %d — auditing %s", n, self.target)
        if not self._run(["run", "--stage", "audit"], env={"AUDIT_URL": self.target}):
            return "audit-failed"

        after = _ticket_titles(tickets_dir)
        new = [after[h] for h in set(after) - before]
        if not new:
            return "no-new-problems"
        log.info("improve: %d new problem(s) found — attempting auto-fix", len(new))

        last_good = self._git_head()
        clear_markers_from(self.root, "product")  # re-run product..qa in maintenance mode
        self._run(["run", "--stop-after", "test"])  # runs refinement internally

        if self._qa_green():
            log.info("improve: QA green — shipping fix for %d ticket(s)", len(new))
            self._run(["run"])  # finish docs
            return self._deploy_result(len(new))

        # failed auto-fix: preserve the running app, defer the problems
        log.warning("improve: auto-fix did NOT reach green — rolling back, deferring")
        deferred_bodies = [p.read_text(encoding="utf-8") for p in new if p.exists()]
        self._git_reset(last_good)
        self._defer(deferred_bodies)
        self._clear_human_flag()
        return f"deferred:{len(deferred_bodies)}"

    # -- steps ------------------------------------------------------------

    def _deploy_result(self, fixed: int) -> str:
        if not self.deploy:
            return f"fixed:{fixed}:not-deployed"
        docker = shutil.which("docker")
        if not docker:
            return f"fixed:{fixed}:no-docker"
        proc = subprocess.run([docker, "compose", "up", "--build", "-d"],
                              cwd=self.root, capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        if proc.returncode != 0:
            log.error("improve: deploy failed: %s", (proc.stderr or proc.stdout)[-300:])
            return f"fixed:{fixed}:deploy-failed"
        log.info("improve: redeployed %s", self.target)
        return f"shipped:{fixed}"

    def _defer(self, bodies: list[str]) -> None:
        deferred = self.root / DEFERRED
        deferred.mkdir(parents=True, exist_ok=True)
        existing = len(list(deferred.glob("PROBLEM-*.md")))
        for i, body in enumerate(bodies, start=existing + 1):
            (deferred / f"PROBLEM-{i:03d}.md").write_text(body, encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=self.root, capture_output=True)
        subprocess.run(["git", "commit", "-m", f"improve: defer {len(bodies)} unfixable problem(s)"],
                       cwd=self.root, capture_output=True)

    # -- helpers ----------------------------------------------------------

    def _run(self, args: list[str], env: dict | None = None) -> bool:
        full_env = {**os.environ, **(env or {})}
        proc = subprocess.run([self.py, self.cli, *args], cwd=self.root, env=full_env)
        return proc.returncode == 0

    def _qa_green(self) -> bool:
        marker = (self.root / "05_test_reports" / ".status_done").exists()
        state = State(self.root / ".pipeline" / "state.json")
        return marker and not state.data.get("human_intervention_required")

    def _target_up(self) -> bool:
        try:
            return requests.get(self.target, timeout=5).status_code < 500
        except requests.RequestException:
            return False

    def _llm_up(self) -> bool:
        if self.config.llm_provider != "ollama":
            return True
        host = self.config.env.get("OLLAMA_HOST", "http://localhost:11434")
        try:
            return requests.get(f"{host}/api/tags", timeout=5).ok
        except requests.RequestException:
            return False

    def _git_head(self) -> str:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.root,
                              capture_output=True, text=True).stdout.strip()

    def _git_reset(self, commit: str) -> None:
        if commit:
            subprocess.run(["git", "reset", "--hard", commit], cwd=self.root,
                           capture_output=True)

    def _clear_human_flag(self) -> None:
        path = self.root / ".pipeline" / "state.json"
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            data["human_intervention_required"] = False
            data["refinement_loops"] = 0
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    def _acquire_lock(self) -> bool:
        lock = self.root / ".pipeline" / "improve.lock"
        if lock.exists():
            try:
                old = int(lock.read_text(encoding="utf-8").strip())
                out = subprocess.run(["tasklist", "/FI", f"PID eq {old}", "/NH"],
                                     capture_output=True, text=True)
                if str(old) in out.stdout:
                    return False
            except (ValueError, OSError):
                pass
        lock.write_text(str(os.getpid()), encoding="utf-8")
        import atexit
        atexit.register(lambda: lock.unlink(missing_ok=True))
        return True
