"""Pipeline management dashboard — a local web control panel.

`run-pipeline.py serve` starts a small stdlib HTTP server (127.0.0.1) that
exposes the pipeline's live state and a safe, whitelisted set of controls:

  GET  /                -> the dashboard page
  GET  /api/status      -> stages, markers, cost, mode, loops, tickets, reports
  GET  /api/log?name=.. -> tail of a job/loop log
  POST /api/action      -> {"name": "<whitelisted action>"} spawns the CLI

Only whitelisted commands run; one job at a time; bound to localhost.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import yaml

from pipeline import loopcfg, loopmetrics
from pipeline.config import VALID_PROJECT_TYPES, Config, load_config
from pipeline.stages import STAGES, marker_path
from pipeline.state import State

log = logging.getLogger("pipeline")

# .env values whose keys look secret are masked in the browser; a save that
# leaves the mask in place keeps the original secret.
_SECRET_KEY = re.compile(r"(_KEY|_TOKEN|_SECRET|PASSWORD)$")
_ENV_MASK = "********"
_ENV_LINE = re.compile(r"^([A-Za-z0-9_]+)=(.*)$")


def _mask_env(text: str) -> str:
    out = []
    for line in text.splitlines():
        m = _ENV_LINE.match(line)
        if m and _SECRET_KEY.search(m.group(1)) and m.group(2) and "REPLACE_ME" not in m.group(2):
            out.append(f"{m.group(1)}={_ENV_MASK}")
        else:
            out.append(line)
    return "\n".join(out)


def _unmask_env(new: str, original: str) -> str:
    orig = {m.group(1): m.group(2) for line in original.splitlines()
            if (m := _ENV_LINE.match(line))}
    out = []
    for line in new.splitlines():
        m = _ENV_LINE.match(line)
        if m and m.group(2) == _ENV_MASK and m.group(1) in orig:
            out.append(f"{m.group(1)}={orig[m.group(1)]}")
        else:
            out.append(line)
    return "\n".join(out)

# name -> argv passed to run-pipeline.py. Only these can be triggered.
ACTIONS: dict[str, list[str]] = {
    "run": ["run"],
    "run-specs": ["run", "--stop-after", "specs"],
    "run-architecture": ["run", "--stop-after", "architecture"],
    "run-code": ["run", "--stop-after", "code"],
    "run-test": ["run", "--stop-after", "test"],
    "audit": ["run", "--stage", "audit"],
    "discover": ["run", "--stage", "discover"],
    "reset": ["reset"],
    "watch-start": ["watch", "--interval", "300", "--deploy"],
    "improve-start": ["improve", "--interval", "1800"],
}
LOOP_ACTIONS = {"watch-start": "watch", "improve-start": "improve"}


def _pid_alive(pid: int) -> bool:
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                         capture_output=True, text=True)
    return str(pid) in out.stdout


class Dashboard:
    def __init__(self, config: Config):
        self.config = config
        self.root = config.root
        self.job: subprocess.Popen | None = None
        self.job_name: str | None = None
        self.job_log = self.root / ".pipeline" / "job.log"
        self._lock = threading.Lock()

    # -- status -----------------------------------------------------------

    def status(self) -> dict:
        self._refresh_config()  # reflect any config edits made in the browser
        state = State(self.root / ".pipeline" / "state.json")
        stages = []
        for s in STAGES:
            has_marker = marker_path(self.root, s).exists()
            stages.append({
                "name": s.name,
                "folder": s.output_dir,
                "marker": ("n/a" if not s.writes_marker else ("yes" if has_marker else "-")),
                "state": state.stage_status(s.name),
            })
        return {
            "project": self.config.project.get("name", "app"),
            "provider": self.config.llm_provider,
            "mode": self.config.mode,
            "stages": stages,
            "refinement_loops": state.data.get("refinement_loops", 0),
            "max_loops": self.config.max_refinement_loops,
            "total_cost_usd": state.data.get("total_cost_usd", 0.0),
            "human_intervention": bool(state.data.get("human_intervention_required")),
            "human_reason": state.data.get("human_intervention_reason", ""),
            "loops": {
                "watch": self._loop_state("watch"),
                "improve": self._loop_state("improve"),
            },
            "tickets": self._count("01_requirements/discovered/tickets"),
            "deferred": self._count("01_requirements/discovered/deferred"),
            "reports": self._reports(),
            "job": {"running": self._job_running(), "name": self.job_name},
        }

    def _loop_state(self, name: str) -> dict:
        lock = self.root / ".pipeline" / f"{name}.lock"
        running = False
        if lock.exists():
            try:
                running = _pid_alive(int(lock.read_text(encoding="utf-8").strip()))
            except (ValueError, OSError):
                running = False
        return {"running": running}

    def _count(self, rel: str) -> int:
        d = self.root / rel
        return len(list(d.glob("PROBLEM-*.md"))) if d.exists() else 0

    def _reports(self) -> dict:
        out: dict = {}
        qa = self.root / "05_test_reports" / "report.json"
        if qa.exists():
            try:
                r = json.loads(qa.read_text(encoding="utf-8"))
                e = r.get("e2e", {})
                out["qa"] = {"ok": r.get("ok"), "passed": e.get("passed"), "total": e.get("total")}
            except (json.JSONDecodeError, KeyError):
                pass
        audit = self.root / "05_test_reports" / "audit" / "findings.json"
        if audit.exists():
            try:
                out["audit"] = {"findings": json.loads(audit.read_text(encoding="utf-8")).get("total")}
            except (json.JSONDecodeError, KeyError):
                pass
        return out

    # -- page data --------------------------------------------------------

    def _read(self, rel: str) -> str:
        p = self.root / rel
        return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""

    def report_files(self) -> dict:
        security = None
        secp = self.root / "05_test_reports" / "security" / "report.json"
        if secp.exists():
            try:
                security = json.loads(secp.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
        return {
            "qa_md": self._read("05_test_reports/REPORT.md"),
            "audit_md": self._read("05_test_reports/audit/AUDIT.md"),
            "security": security,
        }

    def ticket_files(self) -> dict:
        def load(rel: str) -> list[dict]:
            d = self.root / rel
            return [{"name": p.name, "content": p.read_text(encoding="utf-8")}
                    for p in sorted(d.glob("PROBLEM-*.md"))] if d.exists() else []
        return {
            "tickets": load("01_requirements/discovered/tickets"),
            "deferred": load("01_requirements/discovered/deferred"),
        }

    def backlog(self) -> str:
        return self._read("02_specs/PRODUCT_BACKLOG.md")

    # -- config edit ------------------------------------------------------

    def config_get(self) -> dict:
        return {
            "config_yaml": self._read(".pipeline/config.yaml"),
            "env": _mask_env(self._read(".env")),
            "project_types": sorted(VALID_PROJECT_TYPES),
            "loops": loopcfg.load(self.root),
        }

    def config_save(self, config_yaml: str | None, env: str | None,
                    loops: dict | None = None) -> dict:
        saved = []
        if loops is not None:
            ok, msg = loopcfg.save(self.root, loops)
            if not ok:
                return {"ok": False, "message": msg}
            saved.append("loop settings")
        if config_yaml is not None:
            try:
                parsed = yaml.safe_load(config_yaml)
            except yaml.YAMLError as exc:
                return {"ok": False, "message": f"config.yaml is not valid YAML: {exc}"}
            if not isinstance(parsed, dict):
                return {"ok": False, "message": "config.yaml must be a mapping"}
            (self.root / ".pipeline" / "config.yaml").write_text(config_yaml, encoding="utf-8")
            saved.append("config.yaml")
        if env is not None:
            merged = _unmask_env(env, self._read(".env"))
            if not merged.endswith("\n"):
                merged += "\n"
            (self.root / ".env").write_text(merged, encoding="utf-8")
            saved.append(".env")
        warn = ""
        try:
            self.config = load_config(self.root)  # apply immediately
        except Exception as exc:
            warn = f" — but the pipeline won't load yet: {exc}"
        return {"ok": True, "message": "saved " + " + ".join(saved) + warn}

    def _refresh_config(self) -> None:
        try:
            self.config = load_config(self.root)
        except Exception:
            pass  # keep last-good config for the status panel

    # -- loop metrics (feedback for tuning timers/priority) ---------------

    def loop_metrics(self) -> dict:
        settings = loopcfg.load(self.root)
        order = settings["priority"]
        now = loopmetrics.now()
        out: dict = {"priority": order, "reachable": self._reachable(settings)}
        for name in ("watch", "improve"):
            m = loopmetrics.summary(self.root, name)
            running = loopcfg.loop_running(self.root, name)
            interval = settings[name]["interval"]
            eta = None
            if running and m.get("last_run_ts"):
                eta = max(0, round(m["last_run_ts"] + interval - now))
            m.update({
                "running": running,
                "interval": interval,
                "next_eta_s": eta,
                "priority_rank": order.index(name) + 1 if name in order else None,
                "yielding_to": loopcfg.should_yield(self.root, name) if running else None,
            })
            out[name] = m
        return out

    def _reachable(self, settings: dict) -> dict:
        import requests  # lazy: keep status polling free of network cost
        def ping(url: str) -> bool:
            try:
                return requests.get(url, timeout=1.5).status_code < 500
            except Exception:
                return False
        result = {}
        if self.config.llm_provider == "ollama":
            host = self.config.env.get("OLLAMA_HOST", "http://localhost:11434")
            result["ollama"] = ping(f"{host}/api/tags")
        else:
            result["ollama"] = None  # not used
        result["target"] = ping(settings["improve"]["target"])
        return result

    # -- jobs -------------------------------------------------------------

    def _job_running(self) -> bool:
        return self.job is not None and self.job.poll() is None

    def trigger(self, name: str) -> dict:
        if name not in ACTIONS:
            return {"ok": False, "message": f"unknown action '{name}'"}
        with self._lock:
            if self._job_running():
                return {"ok": False, "message": f"a job is already running ({self.job_name})"}
            if name in LOOP_ACTIONS:
                loop = LOOP_ACTIONS[name]
                if loopcfg.loop_running(self.root, loop):
                    return {"ok": False, "message": f"{loop} loop already running"}
                # build args from saved loop settings, not the frozen defaults
                spec = loopcfg.watch_argv(self.root) if loop == "watch" \
                    else loopcfg.improve_argv(self.root)
                argv = [sys.executable, str(self.root / "run-pipeline.py"), *spec]
                # loops manage their own lock/log; fire-and-forget
                subprocess.Popen(argv, cwd=self.root,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"ok": True, "message": f"started {loop} loop"}
            argv = [sys.executable, str(self.root / "run-pipeline.py"), *ACTIONS[name]]
            logf = open(self.job_log, "w", encoding="utf-8")
            self.job = subprocess.Popen(argv, cwd=self.root, stdout=logf,
                                        stderr=subprocess.STDOUT, text=True)
            self.job_name = name
            return {"ok": True, "message": f"started {name}"}

    def stop_loop(self, name: str) -> dict:
        lock = self.root / ".pipeline" / f"{name}.lock"
        if not lock.exists():
            return {"ok": False, "message": f"{name} loop not running"}
        try:
            pid = int(lock.read_text(encoding="utf-8").strip())
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
            lock.unlink(missing_ok=True)
            return {"ok": True, "message": f"stopped {name} loop"}
        except (ValueError, OSError) as exc:
            return {"ok": False, "message": str(exc)}

    def tail_log(self, name: str, lines: int = 60) -> str:
        path = {
            "job": self.job_log,
            "watch": self.root / ".pipeline" / "watch.log",
            "improve": self.root / ".pipeline" / "improve.log",
        }.get(name)
        if not path or not path.exists():
            return ""
        text = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(text[-lines:])


def _make_handler(dash: Dashboard):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):  # quiet
            pass

        def _send(self, code: int, body: bytes, ctype: str):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _json(self, obj, code=200):
            self._send(code, json.dumps(obj).encode(), "application/json")

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send(200, PAGE.encode(), "text/html; charset=utf-8")
            elif parsed.path == "/api/status":
                self._json(dash.status())
            elif parsed.path == "/api/log":
                q = parse_qs(parsed.query)
                self._json({"log": dash.tail_log(q.get("name", ["job"])[0], lines=400)})
            elif parsed.path == "/api/reports":
                self._json(dash.report_files())
            elif parsed.path == "/api/tickets":
                self._json(dash.ticket_files())
            elif parsed.path == "/api/backlog":
                self._json({"content": dash.backlog()})
            elif parsed.path == "/api/config":
                self._json(dash.config_get())
            elif parsed.path == "/api/loop-metrics":
                self._json(dash.loop_metrics())
            else:
                self._send(404, b"not found", "text/plain")

        def do_POST(self):
            path = urlparse(self.path).path
            if path not in ("/api/action", "/api/config"):
                return self._send(404, b"not found", "text/plain")
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self._json({"ok": False, "message": "bad json"}, 400)
            if path == "/api/config":
                return self._json(dash.config_save(payload.get("config_yaml"),
                                                    payload.get("env"),
                                                    payload.get("loops")))
            name = payload.get("name", "")
            if name.startswith("stop-"):
                self._json(dash.stop_loop(name[len("stop-"):]))
            else:
                self._json(dash.trigger(name))

    return Handler


def serve(config: Config, port: int) -> None:
    dash = Dashboard(config)
    server = ThreadingHTTPServer(("127.0.0.1", port), _make_handler(dash))
    log.info("pipeline dashboard: http://localhost:%d  (workspace: %s)", port, config.root)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


# -- the single-page dashboard (dark, self-contained, polls /api/status) -----

# the dashboard page lives in _page.html (kept out of this module)
PAGE = (Path(__file__).parent / "_page.html").read_text(encoding="utf-8")
