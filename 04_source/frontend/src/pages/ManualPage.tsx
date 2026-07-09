import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// In-app manual for building AI-automated development workflows with the
// console. Static content — a guide from "register an agent" to "let it run
// itself on a trigger", with the API surface for external automation.

interface Section { id: string; title: string }
const SECTIONS: Section[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'quickstart', title: '1 · Quick start' },
  { id: 'agents', title: '2 · Agents' },
  { id: 'pipelines', title: '3 · Pipelines' },
  { id: 'triggers', title: '4 · Automating with triggers' },
  { id: 'context', title: '5 · Context & memory' },
  { id: 'observability', title: '6 · Logs & memory views' },
  { id: 'api', title: '7 · API for external automation' },
];

export default function ManualPage() {
  const [active, setActive] = useState('overview');

  // highlight the section currently in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    );
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <main className="page-container manual-page">
      <div className="page-header">
        <h1>Manual</h1>
        <span className="count-chip">AI-automated development</span>
      </div>

      <div className="manual-layout">
        <nav className="manual-toc" aria-label="Manual contents">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'active' : ''}>{s.title}</a>
          ))}
        </nav>

        <article className="manual-body doc">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              This console turns registered AI <b>agents</b> into automated
              development workflows. You define agents, wire them into{' '}
              <b>pipelines</b> on a visual canvas, and let those pipelines run
              themselves on a <b>trigger</b> (a timer or a webhook). Everything
              runs locally against your own model — no cloud dependency.
            </p>
            <p>The loop of AI-automated development here is:</p>
            <p className="manual-flow">
              register agents → chain them into a pipeline → give it a trigger →
              it runs on its own → review in Logs & Memory → refine.
            </p>
          </section>

          <section id="quickstart">
            <h2>1 · Quick start</h2>
            <ol>
              <li><Link to="/onboarding">Register an agent</Link> — give it a
                name, role, persona, and a goal. Set its <b>model</b> to a
                locally-installed one (e.g. <code>qwen3.6</code>); cloud model
                names fail with a clear message on a local build.</li>
              <li>Open <Link to="/agents">Agents</Link>, click <b>Run</b> on the
                agent, type a task, and watch it execute against the model with
                its persona and goal in context.</li>
              <li>Chain agents into a flow on <Link to="/pipelines">Pipelines</Link>,
                then give the flow a trigger so it runs without you.</li>
            </ol>
          </section>

          <section id="agents">
            <h2>2 · Agents</h2>
            <p>
              An agent is a reusable worker defined by its attributes — role,
              persona, skills, model, and a standing goal. Running an agent
              sends its persona + goal + your task to the model and records the
              result.
            </p>
            <ul>
              <li><b>Model</b> — the local model that powers it. Leave blank to
                use the default.</li>
              <li><b>Context</b> — standing knowledge injected into <i>every</i>{' '}
                run (system docs, formats, house rules). Write it once instead of
                re-explaining per task.</li>
              <li><b>Memory</b> — when on, the agent remembers its recent runs
                and recalls the most relevant ones on new tasks (semantic
                search). Off by default so automations stay reproducible.</li>
            </ul>
          </section>

          <section id="pipelines">
            <h2>3 · Pipelines</h2>
            <p>
              A pipeline is a graph of nodes on a canvas; each node’s output
              flows into the next. Drag from a node’s right port onto another
              node to connect them. Node types:
            </p>
            <ul>
              <li><b>🤖 Agent</b> — run a registered agent on the flowing text.</li>
              <li><b>✨ Skill</b> — a persona-less transform: summarize,
                translate, extract key points, classify severity, or a custom
                instruction.</li>
              <li><b>⑂ Logic (IF)</b> — branch on the text (contains / regex /
                longer-than). Two ports: <span className="doc-ok">✓ true</span>{' '}
                and <span className="doc-bad">✗ false</span>. The untaken branch
                is marked <i>skipped</i>.</li>
              <li><b>🌐 HTTP</b> — call an external URL; the response becomes the
                flowing text. The integration escape hatch.</li>
            </ul>
            <p>
              Save validates the graph (one start node, everything reachable).
              Hit <b>Run</b> and each node lights up live as it executes.
            </p>
          </section>

          <section id="triggers">
            <h2>4 · Automating with triggers</h2>
            <p>
              The ⚡ trigger node (docked to the start of a pipeline, or the
              topbar button) is what makes development <i>automated</i> rather
              than manual:
            </p>
            <ul>
              <li><b>Manual</b> — runs only when you press Run.</li>
              <li><b>Interval</b> — the built-in scheduler runs the pipeline’s{' '}
                <i>default task</i> every N seconds. It never overlaps a run
                that’s still going.</li>
              <li><b>Webhook</b> — fire the pipeline with an HTTP POST from CI,
                cron, or any tool (see the API section).</li>
            </ul>
            <p className="doc-note">
              On a local CPU model each run can take a minute or more — keep
              intervals comfortably above your pipeline’s runtime. The
              no-overlap guard protects you, but back-to-back firing keeps the
              model busy.
            </p>
          </section>

          <section id="context">
            <h2>5 · Context &amp; memory</h2>
            <p>Three layers give agents more than a cold prompt each run:</p>
            <ul>
              <li><b>Standing context</b> — the agent’s Context field, in every run.</li>
              <li><b>Pipeline trail</b> — inside a chain, each step also sees the
                original task and a digest of earlier steps, not just the
                previous output.</li>
              <li><b>Episodic memory</b> — with Memory on, summaries of the
                agent’s most <i>relevant</i> past runs are injected (vector
                search), so recurring workflows build on experience.</li>
            </ul>
            <p>
              Memory is opt-in per agent and only records <i>successful</i> runs.
              Turn it on from <Link to="/agents">Agents → Edit</Link>.
            </p>
          </section>

          <section id="observability">
            <h2>6 · Logs &amp; memory views</h2>
            <p>
              <Link to="/logs">Logs</Link> is one searchable feed of every agent
              run and pipeline run — filter by kind or status, search the task
              and output text, click a row for the full detail.
            </p>
            <p>
              <Link to="/memory">Memory</Link> shows what memory-enabled agents
              have stored, and lets you <i>semantically search</i> the store to
              see exactly how recall ranks — the same mechanism the agents use.
            </p>
          </section>

          <section id="api">
            <h2>7 · API for external automation</h2>
            <p>
              Every action has a REST endpoint under <code>/api</code>, so CI or
              scripts can drive the same workflows. Runs are asynchronous:
              starting one returns immediately; poll until the status leaves{' '}
              <code>running</code>.
            </p>
            <h4>Run an agent</h4>
            <pre className="run-output">{`POST /api/agents/{id}/runs   { "task": "..." }   -> 202 + run
GET  /api/runs/{runId}                          -> poll for status`}</pre>
            <h4>Fire a pipeline by webhook (a real trigger)</h4>
            <pre className="run-output">{`POST /api/hooks/{webhookKey}   { "task": "..." }   # optional body;
                                                   # else the default task`}</pre>
            <p className="run-meta">
              Get a pipeline’s webhook URL from its trigger settings (set
              trigger = Webhook, then Save).
            </p>
            <h4>Search activity</h4>
            <pre className="run-output">{`GET /api/logs?q=&status=&kind=      # unified run search
GET /api/memory?q=                  # semantic memory search`}</pre>
          </section>
        </article>
      </div>
    </main>
  );
}
