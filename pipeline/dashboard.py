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
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from pipeline.config import Config
from pipeline.stages import STAGES, marker_path
from pipeline.state import State

log = logging.getLogger("pipeline")

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

    # -- jobs -------------------------------------------------------------

    def _job_running(self) -> bool:
        return self.job is not None and self.job.poll() is None

    def trigger(self, name: str) -> dict:
        if name not in ACTIONS:
            return {"ok": False, "message": f"unknown action '{name}'"}
        with self._lock:
            if self._job_running():
                return {"ok": False, "message": f"a job is already running ({self.job_name})"}
            argv = [sys.executable, str(self.root / "run-pipeline.py"), *ACTIONS[name]]
            if name in LOOP_ACTIONS:
                # loops manage their own lock/log; fire-and-forget
                subprocess.Popen(argv, cwd=self.root,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"ok": True, "message": f"started {LOOP_ACTIONS[name]} loop"}
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
                self._json({"log": dash.tail_log(q.get("name", ["job"])[0])})
            else:
                self._send(404, b"not found", "text/plain")

        def do_POST(self):
            if urlparse(self.path).path != "/api/action":
                return self._send(404, b"not found", "text/plain")
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self._json({"ok": False, "message": "bad json"}, 400)
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

PAGE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ASDLC Pipeline Control</title>
<style>
:root{--bg:#0B0F14;--panel:#141A21;--border:#232D38;--text:#E6EDF3;--muted:#9BA8B4;
--blue:#3B82F6;--green:#37B24D;--gold:#E8A33D;--red:#F26663;--mono:ui-monospace,'JetBrains Mono',Consolas,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);
font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px}
.wrap{max-width:1100px;margin:0 auto;padding:24px 28px}
h1{font-size:22px;margin:0 0 2px}.sub{color:var(--muted);margin-bottom:20px}
.sub b{color:var(--text)}.grid{display:grid;gap:16px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px 18px}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 12px}
.stages{display:flex;flex-wrap:wrap;gap:8px}
.stage{border:1px solid var(--border);border-radius:8px;padding:8px 12px;min-width:112px}
.stage .n{font-weight:600}.stage .s{font-family:var(--mono);font-size:12px;color:var(--muted)}
.stage.done{border-color:var(--green)}.stage.done .s{color:var(--green)}
.stage.running{border-color:var(--blue)}.stage.running .s{color:var(--blue)}
.stage.failed{border-color:var(--red)}.stage.failed .s{color:var(--red)}
.row{display:flex;gap:24px;flex-wrap:wrap}
.stat{font-family:var(--mono)}.stat .v{font-size:22px;font-weight:700}.stat .l{color:var(--muted);font-size:12px}
button{background:#1C2530;color:var(--text);border:1px solid var(--border);border-radius:7px;
padding:8px 14px;font-size:13px;cursor:pointer}button:hover{border-color:var(--blue)}
button:disabled{opacity:.4;cursor:not-allowed}button.primary{background:var(--blue);border-color:var(--blue);color:#08110D;font-weight:600}
button.danger{border-color:var(--red);color:var(--red)}
.btns{display:flex;flex-wrap:wrap;gap:8px}
.pill{font-family:var(--mono);font-size:12px;border:1px solid var(--border);border-radius:999px;padding:2px 10px}
.pill.on{border-color:var(--green);color:var(--green)}.pill.off{color:var(--muted)}
.loop{display:flex;align-items:center;gap:10px;margin-bottom:8px}
pre{background:#0C1219;border:1px solid var(--border);border-radius:8px;padding:12px;
font-family:var(--mono);font-size:12px;max-height:280px;overflow:auto;white-space:pre-wrap;margin:0;color:#B9C6D3}
.warn{background:#2A1A1A;border-color:var(--red);color:#F2B8B6}
.mut{color:var(--muted)}.ok{color:var(--green)}.bad{color:var(--red)}
</style></head><body><div class="wrap">
<h1>ASDLC Pipeline Control</h1>
<div class="sub">workspace <b id="proj">…</b> · provider <b id="prov">…</b> · mode <b id="mode">…</b></div>
<div id="human" class="card warn" style="display:none;margin-bottom:16px"></div>
<div class="grid">
  <div class="card"><h2>Stages</h2><div class="stages" id="stages"></div></div>
  <div class="card"><h2>Run</h2>
    <div class="btns" id="runbtns">
      <button class="primary" data-a="run">Run full pipeline</button>
      <button data-a="run-specs">→ specs</button>
      <button data-a="run-architecture">→ architecture</button>
      <button data-a="run-code">→ code</button>
      <button data-a="run-test">→ QA gate</button>
      <button data-a="audit">Audit</button>
      <button data-a="discover">Discover</button>
      <button class="danger" data-a="reset">Reset</button>
    </div>
    <div class="mut" id="jobstate" style="margin-top:10px"></div>
  </div>
  <div class="row">
    <div class="card" style="flex:1;min-width:260px"><h2>Metrics</h2>
      <div class="row">
        <div class="stat"><div class="v" id="loops">0/0</div><div class="l">refine loops</div></div>
        <div class="stat"><div class="v" id="cost">$0</div><div class="l">llm cost</div></div>
        <div class="stat"><div class="v" id="tickets">0</div><div class="l">tickets</div></div>
        <div class="stat"><div class="v" id="deferred">0</div><div class="l">deferred</div></div>
        <div class="stat"><div class="v" id="qa">—</div><div class="l">last QA</div></div>
      </div>
    </div>
    <div class="card" style="flex:1;min-width:260px"><h2>Loops</h2>
      <div class="loop"><span>watch</span><span class="pill off" id="watch-pill">stopped</span>
        <button data-a="watch-start">Start</button><button class="danger" data-a="stop-watch">Stop</button></div>
      <div class="loop"><span>improve</span><span class="pill off" id="improve-pill">stopped</span>
        <button data-a="improve-start">Start</button><button class="danger" data-a="stop-improve">Stop</button></div>
      <div class="mut" style="font-size:12px">Run only one loop at a time.</div>
    </div>
  </div>
  <div class="card"><h2>Log <select id="logsel" style="background:#1C2530;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:2px 6px"><option value="job">job</option><option value="watch">watch</option><option value="improve">improve</option></select></h2>
    <pre id="log">—</pre></div>
</div></div>
<script>
const $=id=>document.getElementById(id);
async function post(name){const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});const j=await r.json();$('jobstate').textContent=j.message;refresh();}
document.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>post(b.dataset.a));
function stageClass(s){if(s.state==='running')return'running';if(s.state==='failed')return'failed';if(s.state==='done'||s.marker==='yes')return'done';return'';}
async function refresh(){
 let s;try{s=await(await fetch('/api/status')).json()}catch(e){return}
 $('proj').textContent=s.project;$('prov').textContent=s.provider;$('mode').textContent=s.mode;
 $('stages').innerHTML=s.stages.map(x=>`<div class="stage ${stageClass(x)}"><div class="n">${x.name}</div><div class="s">${x.state}${x.marker==='yes'?' ✓':''}</div></div>`).join('');
 $('loops').textContent=s.refinement_loops+'/'+s.max_loops;
 $('cost').textContent='$'+(s.total_cost_usd||0).toFixed(2);
 $('tickets').textContent=s.tickets;$('deferred').textContent=s.deferred;
 $('qa').innerHTML=s.reports.qa?`<span class="${s.reports.qa.ok?'ok':'bad'}">${s.reports.qa.passed}/${s.reports.qa.total}</span>`:'—';
 for(const k of ['watch','improve']){const on=s.loops[k].running;const p=$(k+'-pill');p.textContent=on?'running':'stopped';p.className='pill '+(on?'on':'off');}
 const running=s.job.running;$('runbtns').querySelectorAll('button').forEach(b=>b.disabled=running);
 $('jobstate').innerHTML=running?`<span class="ok">● running: ${s.job.name}</span>`:'<span class="mut">idle</span>';
 if(s.human_intervention){$('human').style.display='block';$('human').innerHTML='⚠ HUMAN_INTERVENTION_REQUIRED — '+(s.human_reason||'QA red after refinement. Fix, then Reset or re-run.');}else{$('human').style.display='none';}
}
async function refreshLog(){try{const j=await(await fetch('/api/log?name='+$('logsel').value)).json();$('log').textContent=j.log||'(empty)';}catch(e){}}
$('logsel').onchange=refreshLog;
refresh();refreshLog();setInterval(refresh,3000);setInterval(refreshLog,3000);
</script></body></html>"""
