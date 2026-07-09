import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';

// In-app manual for building AI-automated development workflows with the
// console: concepts, worked recipes, the API surface, and troubleshooting.

interface Section { id: string; title: string }
const SECTIONS: Section[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'quickstart', title: '1 · Quick start' },
  { id: 'agents', title: '2 · Agents' },
  { id: 'pipelines', title: '3 · Pipelines' },
  { id: 'triggers', title: '4 · Triggers & automation' },
  { id: 'context', title: '5 · Context & memory' },
  { id: 'recipes', title: '6 · Recipes' },
  { id: 'observability', title: '7 · Logs & memory' },
  { id: 'api', title: '8 · API reference' },
  { id: 'troubleshooting', title: '9 · Troubleshooting' },
];

// Code block with a copy button.
function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="doc-code">
      <button className="doc-copy" onClick={copy} aria-label="Copy code">
        {copied ? '✓ copied' : 'copy'}
      </button>
      <pre className="run-output">{children}</pre>
    </div>
  );
}

export default function ManualPage() {
  const [active, setActive] = useState('overview');

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
              themselves on a <b>trigger</b> — a timer or a webhook. Everything
              runs locally against your own model, no cloud dependency.
            </p>
            <p className="manual-flow">
              register agents → chain them into a pipeline → give it a trigger →
              it runs on its own → review in Logs &amp; Memory → refine
            </p>
            <p className="doc-note">
              New here? Do the <a href="#quickstart">quick start</a>, then copy a{' '}
              <a href="#recipes">recipe</a> and adapt it.
            </p>
          </section>

          <section id="quickstart">
            <h2>1 · Quick start</h2>
            <ol>
              <li><Link to="/onboarding">Register an agent</Link> — name, role,
                persona, goal. Set its <b>model</b> to a locally-installed one
                (e.g. <code>qwen3.6</code>). Cloud model names (<code>claude-*</code>,{' '}
                <code>gpt-*</code>) fail with a clear message on a local build.</li>
              <li>Open <Link to="/agents">Agents</Link> → <b>Run</b> → type a task
                → watch it execute with its persona and goal in context.</li>
              <li>On <Link to="/pipelines">Pipelines</Link> → <b>New</b>, add a
                couple of nodes, wire them, and <b>Run</b>.</li>
              <li>Set the pipeline’s trigger to <b>Interval</b> or <b>Webhook</b>{' '}
                so it runs without you.</li>
            </ol>
          </section>

          <section id="agents">
            <h2>2 · Agents</h2>
            <p>
              An agent is a reusable worker defined by its attributes. Running it
              sends persona + goal + your task to the model and records the
              result.
            </p>
            <ul>
              <li><b>Model</b> — the local model that powers it (blank = default).</li>
              <li><b>Context</b> — standing knowledge injected into <i>every</i>{' '}
                run: system docs, output formats, house rules. Write it once
                instead of repeating it per task.</li>
              <li><b>Memory</b> — when on, the agent remembers its recent runs and
                recalls the most <i>relevant</i> ones on new tasks. Off by
                default so automations stay reproducible; only successful runs
                are stored.</li>
            </ul>
            <p className="doc-tip">
              <b>Tip:</b> give an agent a tight <b>Context</b> (“You review Python
              diffs. Reply only with a bulleted list of issues, most severe
              first.”) and its every run stays on-format without re-prompting.
            </p>
          </section>

          <section id="pipelines">
            <h2>3 · Pipelines</h2>
            <p>
              A pipeline is a graph of nodes; each node’s output flows into the
              next. Node types:
            </p>
            <ul>
              <li><b>🤖 Agent</b> — run a registered agent on the flowing text.</li>
              <li><b>✨ Skill</b> — a persona-less transform: summarize, translate,
                extract key points, classify severity, or a custom instruction.</li>
              <li><b>⑂ Logic (IF)</b> — branch on the text (contains / not
                contains / regex / longer-than). Two output ports:{' '}
                <span className="doc-ok">✓ true</span> and{' '}
                <span className="doc-bad">✗ false</span>. The untaken branch is
                marked <i>skipped</i>; the text passes through unchanged.</li>
              <li><b>🌐 HTTP</b> — call an external URL (GET, or POST which sends{' '}
                <code>{'{ "input": … }'}</code>); the response becomes the flowing
                text. The integration escape hatch.</li>
            </ul>
            <h4>Canvas controls</h4>
            <ul>
              <li><b>Add a node</b> — “Add node ▾” in the topbar.</li>
              <li><b>Move</b> — drag a node. <b>Pan</b> — drag empty space.{' '}
                <b>Zoom</b> — mouse wheel.</li>
              <li><b>Connect</b> — drag from a node’s right port onto another
                node. <b>Remove a connection</b> — click the line.</li>
              <li><b>Configure</b> — click a node to open its settings panel.</li>
            </ul>
            <p>
              Save validates the graph (exactly one start node, everything
              reachable, no cycles). Hit <b>Run</b> and each node colours live as
              it executes: <span className="doc-run">running</span> →{' '}
              <span className="doc-ok">succeeded</span> /{' '}
              <span className="doc-bad">failed</span>, untaken branches dimmed.
            </p>
          </section>

          <section id="triggers">
            <h2>4 · Triggers &amp; automation</h2>
            <p>
              The ⚡ trigger (its node docks to the start of a pipeline, or use
              the topbar button) is what makes development <i>automated</i>:
            </p>
            <ul>
              <li><b>Manual</b> — runs only when you press Run.</li>
              <li><b>Interval</b> — the built-in scheduler runs the pipeline’s{' '}
                <i>default task</i> every N seconds. It never overlaps a run
                that’s still going.</li>
              <li><b>Webhook</b> — fire it with an HTTP POST from CI, cron, or any
                tool (<a href="#api">API</a>). A disabled pipeline rejects the
                webhook.</li>
            </ul>
            <p>
              Every run records what fired it, shown as a ⚡ tag in{' '}
              <Link to="/logs">Logs</Link> and run history.
            </p>
            <p className="doc-note">
              On a local CPU model each run can take a minute or more — keep
              intervals comfortably above your pipeline’s runtime. The no-overlap
              guard protects you, but back-to-back firing keeps the model busy.
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
                agent’s most relevant past runs are injected via vector search,
                so recurring workflows build on experience.</li>
            </ul>
            <p>
              Turn memory on from <Link to="/agents">Agents → Edit</Link>, then
              run the agent — records appear in <Link to="/memory">Memory</Link>{' '}
              (see <a href="#troubleshooting">Troubleshooting</a> if it stays
              empty).
            </p>
          </section>

          <section id="recipes">
            <h2>6 · Recipes</h2>
            <p>Concrete workflows to copy and adapt.</p>

            <h4>A · Nightly service health-check &amp; triage</h4>
            <p>Poll a service, branch on health, escalate only when unhealthy.</p>
            <ol>
              <li><b>🌐 HTTP</b> GET <code>https://your-service/health</code></li>
              <li><b>⑂ Logic</b> — <i>contains</i> <code>ok</code></li>
              <li><span className="doc-ok">✓ true</span> → <b>✨ Skill: Summarize</b>{' '}
                (a one-line “all clear”)</li>
              <li><span className="doc-bad">✗ false</span> → <b>🤖 Agent</b>{' '}
                “Incident Responder” — “Investigate this health output and propose
                the first mitigation step.”</li>
              <li><b>Trigger:</b> Interval, e.g. every 1800s, default task{' '}
                <code>go</code>.</li>
            </ol>

            <h4>B · Draft → review chain</h4>
            <p>Two agents refine each other’s work; the trail keeps the ask in view.</p>
            <ol>
              <li><b>🤖 Agent</b> “Writer” — “Answer the task in two sentences.”</li>
              <li><b>🤖 Agent</b> “Reviewer” — “Rewrite the input as one crisp,
                correct sentence.”</li>
              <li><b>Run</b> with any question as the task.</li>
            </ol>

            <h4>C · Log summarizer on a webhook</h4>
            <p>Let CI post logs and get back a triage.</p>
            <ol>
              <li><b>✨ Skill: Extract key points</b> → <b>✨ Skill: Classify
                severity</b></li>
              <li><b>Trigger:</b> Webhook. Post the logs as the task:</li>
            </ol>
            <Code>{`curl -X POST http://localhost:8088/api/hooks/<key> \\
  -H 'Content-Type: application/json' \\
  -d '{"task": "<paste log excerpt>"}'`}</Code>
          </section>

          <section id="observability">
            <h2>7 · Logs &amp; memory</h2>
            <p>
              <Link to="/logs">Logs</Link> is one searchable feed of every agent
              and pipeline run — filter by kind or status, search task/output
              text, click a row for full detail.
            </p>
            <p>
              <Link to="/memory">Memory</Link> shows what memory-enabled agents
              have stored and lets you <i>semantically search</i> the store to see
              exactly how recall ranks — the same mechanism the agents use.
            </p>
          </section>

          <section id="api">
            <h2>8 · API reference</h2>
            <p>
              Every action has a REST endpoint under <code>/api</code> (on the
              hosted instance, prefixed with the app path, e.g.{' '}
              <code>/agents/api/…</code>). Runs are asynchronous: starting one
              returns immediately; poll until the status leaves{' '}
              <code>running</code>.
            </p>
            <h4>Run an agent, then poll</h4>
            <Code>{`# start (returns 202 + the run)
curl -X POST http://localhost:8088/api/agents/<id>/runs \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'

# poll until status != "running"
curl http://localhost:8088/api/runs/<runId>`}</Code>
            <h4>Fire a pipeline by webhook</h4>
            <Code>{`curl -X POST http://localhost:8088/api/hooks/<webhookKey> \\
  -H 'Content-Type: application/json' -d '{"task": "..."}'
# body optional — omit it to use the pipeline's default task`}</Code>
            <p className="run-meta">
              Get the webhook URL from a pipeline’s trigger settings (set trigger
              = Webhook, then Save).
            </p>
            <h4>Search</h4>
            <Code>{`GET /api/logs?q=&status=&kind=      # unified run search
GET /api/memory?q=                  # semantic memory search`}</Code>
          </section>

          <section id="troubleshooting">
            <h2>9 · Troubleshooting</h2>
            <dl className="doc-faq">
              <dt>A run failed with “… is a cloud model”.</dt>
              <dd>The agent’s model is a cloud name (<code>claude-*</code>,{' '}
                <code>gpt-*</code>) but this is a local build. Edit the agent and
                set the model to a locally-installed one (e.g.{' '}
                <code>qwen3.6</code>).</dd>

              <dt>The Memory page is empty.</dt>
              <dd>Two things must both be true: the agent has <b>Memory</b> on{' '}
                (off by default), and it has <b>succeeded</b> at a run — only
                successful runs are stored. Failed runs record nothing.</dd>

              <dt>A run is stuck on “running” for a while.</dt>
              <dd>Local models are slow, especially on CPU — a task can take a
                minute or more. Watch it in <Link to="/logs">Logs</Link>; the page
                polls automatically.</dd>

              <dt>Save on the canvas says the graph is invalid.</dt>
              <dd>A pipeline needs exactly one start node, every node reachable
                from it, and no cycles. Connect the nodes into a single flow.</dd>

              <dt>An agent node in a pipeline errors with “no longer exists”.</dt>
              <dd>The agent was deleted after the pipeline was built. Open the
                pipeline and pick a current agent for that node.</dd>

              <dt>A webhook returns 409.</dt>
              <dd>The pipeline is disabled. Enable it (the toggle on{' '}
                <Link to="/pipelines">Pipelines</Link> or in trigger settings).</dd>
            </dl>
          </section>
        </article>
      </div>
    </main>
  );
}
