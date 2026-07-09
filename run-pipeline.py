#!/usr/bin/env python
"""ASDLC pipeline orchestrator CLI.

  python run-pipeline.py run                  # advance through all stages
  python run-pipeline.py run --stop-after specs
  python run-pipeline.py run --stage qa       # run one stage regardless of order
  python run-pipeline.py run --dry-run        # walk stages as no-ops (writes markers)
  python run-pipeline.py status               # stage/marker/cost table
  python run-pipeline.py reset                # clear markers + state.json
"""

from __future__ import annotations

import argparse
import logging
import sys

from pipeline.config import load_config
from pipeline.orchestrator import Orchestrator
from pipeline.stages import clear_markers
from pipeline.state import State


def main() -> int:
    parser = argparse.ArgumentParser(prog="run-pipeline", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    run_p = sub.add_parser("run", help="advance the pipeline")
    run_p.add_argument("--stage", help="run exactly one stage (incl. on-demand: "
                       "discover, audit, browsertest)")
    run_p.add_argument("--stop-after", help="halt after this stage or phase alias "
                                            "(specs|architecture|code|test)")
    run_p.add_argument("--dry-run", action="store_true", help="no-op agents, real markers")

    sub.add_parser("status", help="show stage table")
    sub.add_parser("reset", help="clear .status_done markers and reset state.json")

    watch_p = sub.add_parser("watch", help="automatic development loop: react to "
                                           "input/ticket changes, run, optionally deploy")
    watch_p.add_argument("--interval", type=int, default=300,
                         help="seconds between checks (default 300)")
    watch_p.add_argument("--deploy", action="store_true",
                         help="docker compose up --build -d after a green run")
    watch_p.add_argument("--once", action="store_true",
                         help="single check instead of looping (for cron/tests)")

    imp_p = sub.add_parser("improve", help="self-improvement loop: audit the deployed "
                                           "app, auto-fix problems, redeploy on green")
    imp_p.add_argument("--target", default="http://localhost:8088",
                       help="URL of the running app to audit (default :8088)")
    imp_p.add_argument("--interval", type=int, default=1800,
                       help="seconds between cycles (default 1800)")
    imp_p.add_argument("--max-cycles", type=int, default=None,
                       help="stop after N cycles (default: run forever)")
    imp_p.add_argument("--no-deploy", action="store_true",
                       help="fix and verify but do not redeploy the container")
    imp_p.add_argument("--once", action="store_true",
                       help="run a single cycle then exit")

    serve_p = sub.add_parser("serve", help="web control panel: view stage status, "
                                           "trigger runs, manage the loops")
    serve_p.add_argument("--port", type=int, default=8099,
                         help="port for the dashboard (default 8099)")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    config = load_config()
    state = State(config.root / ".pipeline" / "state.json")

    if args.command == "watch":
        # daemon-friendly: also log to a file with timestamps
        file_handler = logging.FileHandler(config.root / ".pipeline" / "watch.log",
                                           encoding="utf-8")
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logging.getLogger("pipeline").addHandler(file_handler)
        from pipeline.watcher import Watcher
        Watcher(config, deploy=args.deploy).watch(args.interval, once=args.once)
        return 0

    if args.command == "improve":
        file_handler = logging.FileHandler(config.root / ".pipeline" / "improve.log",
                                           encoding="utf-8")
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logging.getLogger("pipeline").addHandler(file_handler)
        from pipeline.improve import SelfImproveLoop
        SelfImproveLoop(config, target=args.target, deploy=not args.no_deploy).loop(
            args.interval, max_cycles=args.max_cycles, once=args.once)
        return 0

    if args.command == "serve":
        from pipeline.dashboard import serve
        serve(config, args.port)
        return 0

    if args.command == "status":
        print(Orchestrator(config, state).status_table())
        return 0

    if args.command == "reset":
        removed = clear_markers(config.root)
        state.reset()
        print(f"reset: removed {len(removed)} marker(s), state.json cleared")
        return 0

    orch = Orchestrator(config, state, dry_run=args.dry_run)
    ok = orch.run(only_stage=args.stage, stop_after=args.stop_after)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
