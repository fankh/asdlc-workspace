"""Watch mode: the automatic development loop.

Polls for work, then drives the normal pipeline:

- a document in 00_input/ changed/appeared  -> re-run from the ingest stage
- a discovered ticket changed/appeared      -> re-run from the product stage
  (tickets come from `--stage discover` or `--stage audit`)

Each trigger clears the affected .status_done markers and invokes
`run-pipeline.py run` (maintenance mode picks up automatically once the app
exists). With --deploy, a green run is followed by `docker compose up
--build -d`. When the refinement circuit breaker flags
HUMAN_INTERVENTION_REQUIRED the loop idles loudly until a human clears the
flag — it never thrashes against a red gate.

The first cycle records a baseline digest without running anything, so
enabling the watcher on an already-built workspace does not trigger a
rebuild.
"""

from __future__ import annotations

import hashlib
import json
import logging
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


def _digest(paths: list[Path]) -> str:
    sha = hashlib.sha256()
    for path in sorted(paths):
        sha.update(str(path.name).encode())
        sha.update(path.read_bytes())
    return sha.hexdigest()


def input_digest(root: Path) -> str:
    docs = [p for p in (root / "00_input").iterdir()
            if p.is_file() and p.name.lower() != "readme.md"]
    return _digest(docs)


def tickets_digest(root: Path) -> str:
    tickets_dir = root / "01_requirements" / "discovered" / "tickets"
    if not tickets_dir.exists():
        return _digest([])
    return _digest(sorted(tickets_dir.glob("*.md")))


def _ollama_up(config: Config) -> bool:
    if config.llm_provider != "ollama":
        return True
    host = config.env.get("OLLAMA_HOST", "http://localhost:11434")
    try:
        return requests.get(f"{host}/api/tags", timeout=5).ok
    except requests.RequestException:
        return False


class Watcher:
    def __init__(self, config: Config, deploy: bool = False):
        self.config = config
        self.root = config.root
        self.deploy = deploy
        self.state_path = self.root / ".pipeline" / "watch.json"

    # -- one polling cycle; returns what it did (for logs/tests) ----------

    def tick(self) -> str:
        state = State(self.root / ".pipeline" / "state.json")
        if state.data.get("human_intervention_required"):
            log.warning("watch: HUMAN_INTERVENTION_REQUIRED — idling until the "
                        "flag in .pipeline/state.json is cleared (see RUNBOOK)")
            return "blocked"

        if not _ollama_up(self.config):
            log.warning("watch: ollama not reachable — skipping this cycle")
            return "llm-down"

        current = {"inputs": input_digest(self.root),
                   "tickets": tickets_digest(self.root)}
        if not self.state_path.exists():
            self._save(current)
            log.info("watch: baseline recorded — will react to future changes")
            return "baseline"

        previous = json.loads(self.state_path.read_text(encoding="utf-8"))
        if current["inputs"] != previous.get("inputs"):
            log.info("watch: 00_input changed — running pipeline from ingest")
            return self._run_pipeline("ingest")
        if current["tickets"] != previous.get("tickets"):
            log.info("watch: discovered tickets changed — running from product")
            return self._run_pipeline("product")
        return "idle"

    def watch(self, interval: int, once: bool = False) -> None:
        if not once and not self._acquire_lock():
            log.warning("watch: another watcher is already running (see "
                        ".pipeline/watch.lock) — exiting")
            return
        log.info("watch: every %ds | provider=%s | deploy=%s | workspace=%s",
                 interval, self.config.llm_provider, self.deploy, self.root)
        while True:
            started = loopmetrics.now()
            try:
                blocker = loopcfg.should_yield(self.root, "watch")
                if blocker:
                    outcome = f"yielded:{blocker}"
                    log.info("watch: yielding to higher-priority %s loop", blocker)
                else:
                    outcome = self.tick()
                log.info("watch: cycle -> %s", outcome)
            except Exception:
                outcome = "crashed"
                log.exception("watch: cycle crashed (loop continues)")
            loopmetrics.record(self.root, "watch", started, loopmetrics.now(), outcome)
            if once:
                return
            time.sleep(interval)

    # -- internals ---------------------------------------------------------

    def _run_pipeline(self, first_stage: str) -> str:
        removed = clear_markers_from(self.root, first_stage)
        log.info("watch: cleared %d marker(s), starting run (this can take "
                 "hours on a local model)", len(removed))
        proc = subprocess.run(
            [sys.executable, str(self.root / "run-pipeline.py"), "run"],
            cwd=self.root,
        )
        if proc.returncode != 0:
            log.error("watch: pipeline run FAILED — digests kept stale so the "
                      "run retries once the blocker is resolved")
            return "run-failed"

        # recompute AFTER the run: the product stage consumed the tickets
        self._save({"inputs": input_digest(self.root),
                    "tickets": tickets_digest(self.root)})
        log.info("watch: pipeline green")
        if self.deploy:
            return self._deploy()
        return "run-green"

    def _deploy(self) -> str:
        docker = shutil.which("docker")
        if not docker:
            log.warning("watch: docker not found — skipping deploy")
            return "run-green"
        proc = subprocess.run([docker, "compose", "up", "--build", "-d"],
                              cwd=self.root, capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        if proc.returncode != 0:
            log.error("watch: deploy failed (run stays green): %s",
                      (proc.stderr or proc.stdout)[-400:])
            return "deploy-failed"
        log.info("watch: deployed — http://localhost:8088")
        return "deployed"

    def _save(self, digests: dict) -> None:
        self.state_path.write_text(json.dumps(digests, indent=2) + "\n",
                                   encoding="utf-8")

    # -- singleton lock ----------------------------------------------------

    def _acquire_lock(self) -> bool:
        import os
        lock = self.root / ".pipeline" / "watch.lock"
        if lock.exists():
            try:
                old_pid = int(lock.read_text(encoding="utf-8").strip())
                if _pid_alive(old_pid):
                    return False
            except (ValueError, OSError):
                pass  # stale/garbage lock — take it over
        lock.write_text(str(os.getpid()), encoding="utf-8")
        import atexit
        atexit.register(lambda: lock.unlink(missing_ok=True))
        return True


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
