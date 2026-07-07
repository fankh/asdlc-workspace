"""Control plane: the state-machine loop that advances stages by marker."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from pipeline.agents import get_agent
from pipeline.agents.base import AgentContext, NoopAgent
from pipeline.config import Config
from pipeline.stages import STAGES, Stage, marker_path, matches_stop_after, stage_by_name, write_marker
from pipeline.state import State

log = logging.getLogger("pipeline")


class Orchestrator:
    def __init__(self, config: Config, state: State, dry_run: bool = False):
        self.config = config
        self.state = state
        self.root = config.root
        self.dry_run = dry_run

    # -- public API -------------------------------------------------------

    def run(self, only_stage: str | None = None, stop_after: str | None = None) -> bool:
        if self.state.data.get("human_intervention_required"):
            log.error(
                "state.json says HUMAN_INTERVENTION_REQUIRED (%s). "
                "Fix the issue, then run with --reset or clear the flag.",
                self.state.data.get("human_intervention_reason", "unknown"),
            )
            return False

        if only_stage:
            return self._run_stage(stage_by_name(only_stage))

        stop_after = stop_after or self.config.stop_after
        for stage in STAGES:
            if self._is_complete(stage):
                continue
            if not self.config.agent_enabled(stage.config_key):
                log.info("stage %-13s SKIPPED (disabled in config.yaml)", stage.name)
                continue
            if not self._run_stage(stage):
                return False
            if matches_stop_after(stage, stop_after):
                log.info("stop_after=%s reached — halting.", stop_after)
                return True
        log.info("pipeline complete — all stages done.")
        return True

    def status_table(self) -> str:
        lines = ["stage          folder            marker  state", "-" * 55]
        for stage in STAGES:
            marker = "yes" if marker_path(self.root, stage).exists() else "-"
            if not stage.writes_marker:
                marker = "n/a"
            lines.append(
                f"{stage.name:<14} {stage.output_dir:<17} {marker:<7} {self.state.stage_status(stage.name)}"
            )
        lines.append("")
        lines.append(f"refinement loops: {self.state.data['refinement_loops']}"
                     f" / {self.config.max_refinement_loops}")
        lines.append(f"total LLM cost:   ${self.state.data['total_cost_usd']:.4f}")
        if self.state.data.get("human_intervention_required"):
            lines.append(f"!! HUMAN_INTERVENTION_REQUIRED: "
                         f"{self.state.data.get('human_intervention_reason', '')}")
        return "\n".join(lines)

    # -- internals ---------------------------------------------------------

    def _is_complete(self, stage: Stage) -> bool:
        if self.state.stage_status(stage.name) == "done":
            return True
        # a pre-existing folder marker counts as done (resume after clone/copy)
        return stage.writes_marker and marker_path(self.root, stage).exists()

    def _run_stage(self, stage: Stage) -> bool:
        log.info("stage %-13s RUNNING (agent=%s -> %s)", stage.name, stage.agent, stage.output_dir)
        self.state.stage_start(stage.name, stage.output_dir)

        ctx = AgentContext(
            config=self.config,
            state=self.state,
            root=self.root,
            stage_name=stage.name,
            output_dir=self.root / stage.output_dir,
            dry_run=self.dry_run,
        )
        agent_cls = NoopAgent if self.dry_run else get_agent(stage.agent)

        try:
            result = agent_cls(ctx).run()
        except Exception as exc:  # agent crash must never corrupt state
            log.exception("stage %s crashed", stage.name)
            self.state.stage_failed(stage.name, str(exc))
            return False

        if result.usage:
            self.state.record_usage(stage.name, result.usage)

        if not result.ok:
            log.error("stage %-13s FAILED: %s", stage.name, result.summary)
            self.state.stage_failed(stage.name, result.summary)
            return False

        write_marker(self.root, stage)
        self.state.stage_done(stage.name)
        log.info("stage %-13s DONE: %s", stage.name, result.summary)
        self._auto_commit(stage)
        return True

    def _auto_commit(self, stage: Stage) -> None:
        if self.dry_run or not self.config.auto_commit:
            return
        try:
            branch = subprocess.run(
                ["git", "symbolic-ref", "--short", "HEAD"],
                cwd=self.root, capture_output=True, text=True, check=True,
            ).stdout.strip()
            if branch in ("main", "master"):
                log.warning("auto-commit skipped: on '%s' (pre-commit blocks it)", branch)
                return
            subprocess.run(["git", "add", "-A"], cwd=self.root, check=True, capture_output=True)
            diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=self.root)
            if diff.returncode == 0:
                return  # nothing staged
            subprocess.run(
                ["git", "commit", "-m", f"pipeline: {stage.name} stage complete"],
                cwd=self.root, check=True, capture_output=True, text=True,
            )
            log.info("  auto-committed stage %s", stage.name)
        except subprocess.CalledProcessError as exc:
            log.warning("auto-commit failed (non-fatal): %s", exc.stderr or exc)
