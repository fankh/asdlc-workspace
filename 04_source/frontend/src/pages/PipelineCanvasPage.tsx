import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, InputNumber, Select, Switch, Alert, Tag, Modal, Space } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  listAgents, listPipelines, createPipeline, updatePipeline,
  startPipelineRun, getPipelineRun,
} from '../api/client';
import type { Agent, Pipeline, PipelineRun, TriggerType } from '../api/types';

// n8n-style canvas editor: agent nodes on a pannable/zoomable grid, wired with
// bezier connections. The drawn chain IS the execution order — save derives
// steps by walking the single path from the start node.

const NODE_W = 200;
const NODE_H = 88;
const MAX_NODES = 10;
const TRIG_W = 168;
const TRIG_H = 64;

interface TriggerSettings { type: TriggerType; intervalSec: number; defaultTask: string; enabled: boolean }

function triggerLabel(trig: TriggerSettings): string {
  if (trig.type === 'interval') {
    return trig.intervalSec >= 60 && trig.intervalSec % 60 === 0
      ? `every ${trig.intervalSec / 60}m` : `every ${trig.intervalSec}s`;
  }
  return trig.type === 'webhook' ? 'on webhook' : 'manual (Run button)';
}

const STATUS_STROKE: Record<string, string> = {
  pending: '#3a4653',
  running: '#3B82F6',
  succeeded: '#37B24D',
  failed: '#F26663',
};
const RUN_COLOR: Record<string, string | undefined> = { running: 'blue', succeeded: 'green', failed: 'red' };

interface NodeDraft { key: string; agentId?: string; instruction: string; x: number; y: number }
interface Edge { from: string; to: string }

const newKey = () => Math.random().toString(36).slice(2, 10);

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2); // d3 linkHorizontal-style curve
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// Walk the drawn graph: exactly one start, one edge per port, all nodes on one path.
function deriveOrder(nodes: NodeDraft[], edges: Edge[]): { order?: string[]; error?: string } {
  if (nodes.length === 0) return { error: 'Add at least one agent node.' };
  const out = new Map<string, string>();
  const inc = new Map<string, string>();
  for (const e of edges) {
    if (out.has(e.from) || inc.has(e.to)) return { error: 'Each node can have only one connection per side.' };
    out.set(e.from, e.to);
    inc.set(e.to, e.from);
  }
  const starts = nodes.filter(n => !inc.has(n.key));
  if (starts.length !== 1) return { error: 'Connect the nodes into a single chain (one start, no branches).' };
  const order: string[] = [];
  let cur: string | undefined = starts[0].key;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    order.push(cur);
    cur = out.get(cur);
  }
  if (order.length !== nodes.length) return { error: 'Connect the nodes into a single chain (one start, no branches).' };
  return { order };
}

export default function PipelineCanvasPage() {
  const { pipelineId } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<NodeDraft[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const [tempEdge, setTempEdge] = useState<{ from: string; x: number; y: number; reverse?: boolean } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [trig, setTrig] = useState<TriggerSettings>({ type: 'manual', intervalSec: 300, defaultTask: '', enabled: true });
  const [trigOpen, setTrigOpen] = useState(false);
  const [webhookPath, setWebhookPath] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [task, setTask] = useState('');
  const [run, setRun] = useState<PipelineRun | null>(null);
  const orderKeys = useRef<string[]>([]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const drag = useRef<
    | { mode: 'node'; key: string; dx: number; dy: number; moved: number }
    | { mode: 'pan'; sx: number; sy: number; tx: number; ty: number }
    | { mode: 'connect'; from: string; reverse?: boolean }
    | null
  >(null);

  const agentById = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const nodeByKey = useMemo(() => new Map(nodes.map(n => [n.key, n])), [nodes]);
  const running = run?.status === 'running';

  // -- load ------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [ags, pipes] = await Promise.all([listAgents(), listPipelines()]);
        setAgents(ags);
        if (pipelineId) {
          const p = pipes.find(x => x.id === pipelineId);
          if (!p) { setMsg({ kind: 'error', text: 'Pipeline not found.' }); return; }
          loadPipeline(p);
        }
      } catch {
        setMsg({ kind: 'error', text: 'Failed to load. Please refresh.' });
      }
    })();
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [pipelineId]);

  const loadPipeline = (p: Pipeline) => {
    setName(p.name);
    setDescription(p.description);
    setTrig({
      type: p.triggerType,
      intervalSec: p.intervalSec || 300,
      defaultTask: p.defaultTask,
      enabled: p.enabled,
    });
    setWebhookPath(p.webhookPath);
    const unplaced = p.steps.every(s => s.posX === 0 && s.posY === 0);
    const ns = p.steps.map((s, i) => ({
      key: newKey(),
      agentId: s.agentId,
      instruction: s.instruction,
      x: unplaced ? 80 + i * 260 : s.posX,
      y: unplaced ? 160 : s.posY,
    }));
    setNodes(ns);
    setEdges(ns.slice(1).map((n, i) => ({ from: ns[i].key, to: n.key })));
  };

  // -- coordinate helpers ------------------------------------------------------
  const toWorld = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - t.x) / t.k, y: (clientY - r.top - t.y) / t.k };
  };

  // -- canvas interactions ------------------------------------------------------
  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, tx: t.x, ty: t.y };
    setSelected(null);
  };

  const onNodeDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    const n = nodeByKey.get(key)!;
    drag.current = { mode: 'node', key, dx: w.x - n.x, dy: w.y - n.y, moved: 0 };
  };

  const onOutPortDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    drag.current = { mode: 'connect', from: key };
    setTempEdge({ from: key, x: w.x, y: w.y });
  };

  // Wiring works from either end, n8n-style: dragging from an in-port connects
  // backwards (drop on the upstream node).
  const onInPortDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    drag.current = { mode: 'connect', from: key, reverse: true };
    setTempEdge({ from: key, x: w.x, y: w.y, reverse: true });
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      setT(prev => ({ ...prev, x: d.tx + (e.clientX - d.sx), y: d.ty + (e.clientY - d.sy) }));
    } else if (d.mode === 'node') {
      const w = toWorld(e.clientX, e.clientY);
      d.moved += 1;
      setNodes(prev => prev.map(n => (n.key === d.key ? { ...n, x: w.x - d.dx, y: w.y - d.dy } : n)));
    } else if (d.mode === 'connect') {
      const w = toWorld(e.clientX, e.clientY);
      setTempEdge({ from: d.from, x: w.x, y: w.y, reverse: d.reverse });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === 'node' && d.moved < 3) setSelected(d.key);
    if (d.mode === 'connect') {
      setTempEdge(null);
      const w = toWorld(e.clientX, e.clientY);
      // Drop anywhere on the target node (padded to include its ports) — a
      // 24px-of-the-port bullseye is too precise for a real mouse hand.
      const target = nodes.find(n =>
        n.key !== d.from &&
        w.x >= n.x - 24 && w.x <= n.x + NODE_W + 24 &&
        w.y >= n.y - 16 && w.y <= n.y + NODE_H + 16);
      if (target) {
        setEdges(prev => d.reverse
          ? [...prev.filter(x => x.from !== target.key && x.to !== d.from),
             { from: target.key, to: d.from }]
          : [...prev.filter(x => x.from !== d.from && x.to !== target.key),
             { from: d.from, to: target.key }]);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    setT(prev => {
      const k = Math.min(2.5, Math.max(0.35, prev.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      return { k, x: mx - ((mx - prev.x) / prev.k) * k, y: my - ((my - prev.y) / prev.k) * k };
    });
  };

  // -- graph edits ---------------------------------------------------------------
  const addNode = () => {
    if (nodes.length >= MAX_NODES) return;
    const last = nodes[nodes.length - 1];
    const key = newKey();
    setNodes(prev => [...prev, {
      key, instruction: '',
      x: last ? last.x + 260 : 80,
      y: last ? last.y : 160,
    }]);
    setSelected(key);
  };

  const removeNode = (key: string) => {
    setNodes(prev => prev.filter(n => n.key !== key));
    setEdges(prev => prev.filter(e => e.from !== key && e.to !== key));
    setSelected(null);
  };

  const patchNode = (key: string, patch: Partial<NodeDraft>) =>
    setNodes(prev => prev.map(n => (n.key === key ? { ...n, ...patch } : n)));

  // -- save / run ------------------------------------------------------------------
  const save = async (): Promise<Pipeline | null> => {
    if (!name.trim()) { setMsg({ kind: 'error', text: 'Pipeline name is required.' }); return null; }
    if (nodes.some(n => !n.agentId)) { setMsg({ kind: 'error', text: 'Every node needs an agent.' }); return null; }
    const { order, error } = deriveOrder(nodes, edges);
    if (error) { setMsg({ kind: 'error', text: error }); return null; }
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerType: trig.type,
        intervalSec: trig.type === 'interval' ? trig.intervalSec : 0,
        defaultTask: trig.defaultTask.trim() || undefined,
        enabled: trig.enabled,
        steps: order!.map(k => {
          const n = nodeByKey.get(k)!;
          return {
            agentId: n.agentId!,
            instruction: n.instruction.trim() || undefined,
            posX: Math.round(n.x),
            posY: Math.round(n.y),
          };
        }),
      };
      const saved = pipelineId
        ? await updatePipeline(pipelineId, payload)
        : await createPipeline(payload);
      orderKeys.current = order!;
      setWebhookPath(saved.webhookPath);
      setMsg({ kind: 'ok', text: 'Saved.' });
      if (!pipelineId) navigate(`/pipelines/${saved.id}`, { replace: true });
      return saved;
    } catch (e: any) {
      setMsg({ kind: 'error', text: e?.message || 'Failed to save the pipeline.' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openRun = async () => {
    const saved = await save();
    if (saved) { setTask(''); setRun(null); setTaskOpen(true); }
  };

  const startRun = async () => {
    if (!task.trim() || !pipelineId) return;
    setTaskOpen(false);
    try {
      const r = await startPipelineRun(pipelineId, task.trim());
      setRun(r);
    } catch (e: any) {
      setMsg({ kind: 'error', text: e?.message || 'Failed to start the run.' });
    }
  };

  useEffect(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    if (!run || run.status !== 'running') return;
    poll.current = setInterval(async () => {
      try { setRun(await getPipelineRun(run.id)); } catch { /* keep polling */ }
    }, 1500);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [run?.id, run?.status]);

  const nodeStatus = (key: string): string | null => {
    if (!run) return null;
    const idx = orderKeys.current.indexOf(key);
    return idx >= 0 ? run.steps[idx]?.status ?? null : null;
  };

  const selectedNode = selected ? nodeByKey.get(selected) : null;
  const agentOptions = agents.map(a => ({ label: a.name, value: a.id }));

  // Chain start (unique node without an incoming edge) — the trigger node
  // attaches there, n8n-style.
  const startNode = useMemo(() => {
    const targets = new Set(edges.map(e => e.to));
    const starts = nodes.filter(n => !targets.has(n.key));
    return starts.length === 1 ? starts[0] : null;
  }, [nodes, edges]);

  // -- render ----------------------------------------------------------------------
  return (
    <main className="canvas-page">
      <div className="canvas-topbar">
        <Link to="/pipelines" className="canvas-back">← Pipelines</Link>
        <Input aria-label="Pipeline name" placeholder="Pipeline name" value={name}
          onChange={e => setName(e.target.value)} style={{ width: 220 }} />
        <Input aria-label="Pipeline description" placeholder="Description (optional)" value={description}
          onChange={e => setDescription(e.target.value)} style={{ width: 260 }} />
        <Button onClick={addNode} disabled={nodes.length >= MAX_NODES}>Add agent node</Button>
        <Button onClick={() => setTrigOpen(true)}>
          ⚡ {trig.enabled ? triggerLabel(trig) : 'disabled'}
        </Button>
        <Button onClick={save} loading={saving}>Save</Button>
        <Button type="primary" onClick={openRun} loading={running} disabled={nodes.length === 0}>
          {running ? 'Running…' : 'Run'}
        </Button>
        {msg && <span className={msg.kind === 'error' ? 'canvas-msg-err' : 'canvas-msg-ok'}>{msg.text}</span>}
      </div>

      <svg
        ref={svgRef}
        className="canvas-svg"
        role="application"
        aria-label="Pipeline canvas — drag nodes, connect ports to chain agents"
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#20293380" />
          </pattern>
        </defs>
        <rect className="canvas-bg" width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {edges.map(e => {
            const a = nodeByKey.get(e.from);
            const b = nodeByKey.get(e.to);
            if (!a || !b) return null;
            const d = edgePath(a.x + NODE_W, a.y + NODE_H / 2, b.x, b.y + NODE_H / 2);
            return (
              <g key={`${e.from}-${e.to}`}>
                <path d={d} className="pedge" />
                <path d={d} className="pedge-hit" onClick={() =>
                  setEdges(prev => prev.filter(x => !(x.from === e.from && x.to === e.to)))}>
                  <title>Click to remove this connection</title>
                </path>
              </g>
            );
          })}
          {tempEdge && (() => {
            const a = nodeByKey.get(tempEdge.from);
            if (!a) return null;
            const d = tempEdge.reverse
              ? edgePath(tempEdge.x, tempEdge.y, a.x, a.y + NODE_H / 2)
              : edgePath(a.x + NODE_W, a.y + NODE_H / 2, tempEdge.x, tempEdge.y);
            return <path className="pedge pedge-temp" d={d} />;
          })()}

          {startNode && (() => {
            const tx = startNode.x - TRIG_W - 70;
            const ty = startNode.y + (NODE_H - TRIG_H) / 2;
            return (
              <g transform={`translate(${tx},${ty})`}
                 onPointerDown={e => { e.stopPropagation(); setTrigOpen(true); }}
                 style={{ cursor: 'pointer' }}>
                <path className="pedge ptrig-edge"
                      d={edgePath(TRIG_W, TRIG_H / 2, startNode.x - tx, startNode.y + NODE_H / 2 - ty)} />
                <rect width={TRIG_W} height={TRIG_H} rx={TRIG_H / 2}
                      className={'ptrig' + (trig.enabled ? '' : ' ptrig-off')} />
                <text x={18} y={26} className="pnode-title">⚡ Trigger</text>
                <text x={18} y={45} className="pnode-sub">
                  {trig.enabled ? triggerLabel(trig) : 'disabled'}
                </text>
                <circle cx={TRIG_W} cy={TRIG_H / 2} r={6} className="pport" />
              </g>
            );
          })()}

          {nodes.map((n, i) => {
            const agent = n.agentId ? agentById.get(n.agentId) : null;
            const st = nodeStatus(n.key);
            const stroke = st ? STATUS_STROKE[st] : (selected === n.key ? '#2dd4a7' : '#232D38');
            return (
              <g key={n.key} transform={`translate(${n.x},${n.y})`}
                 onPointerDown={e => onNodeDown(e, n.key)} style={{ cursor: 'grab' }}>
                <rect width={NODE_W} height={NODE_H} rx={10} className="pnode"
                      stroke={stroke} strokeWidth={st === 'running' ? 2.5 : 1.5} />
                <text x={14} y={26} className="pnode-title">
                  {(agent?.name ?? 'Choose agent…').slice(0, 22)}
                </text>
                <text x={14} y={45} className="pnode-sub">
                  {(agent?.model || 'qwen3.6 (default)').slice(0, 26)}
                </text>
                <text x={14} y={66} className="pnode-instr">
                  {(n.instruction || 'no instruction').slice(0, 28)}
                </text>
                {st
                  ? <text x={NODE_W - 2} y={-8} textAnchor="end" className="pnode-status" fill={STATUS_STROKE[st]}>{st}</text>
                  : <text x={NODE_W - 2} y={-8} textAnchor="end" className="pnode-sub">#{i + 1}</text>}
                {/* ports: big invisible hit-targets over small visible circles */}
                <circle cx={0} cy={NODE_H / 2} r={16} className="pport-hit" data-port={`in-${n.key}`}
                        onPointerDown={e => onInPortDown(e, n.key)}>
                  <title>Drag to the previous node to chain it before this one</title>
                </circle>
                <circle cx={0} cy={NODE_H / 2} r={7} className="pport" />
                <circle cx={NODE_W} cy={NODE_H / 2} r={16} className="pport-hit" data-port={`out-${n.key}`}
                        onPointerDown={e => onOutPortDown(e, n.key)}>
                  <title>Drag onto the next node to chain it after this one</title>
                </circle>
                <circle cx={NODE_W} cy={NODE_H / 2} r={7} className="pport pport-out" />
              </g>
            );
          })}

          {nodes.length === 0 && (
            <text x={90} y={140} className="canvas-hint">
              Click “Add agent node”, then drag from a node's right port to another node's left port to chain them.
            </text>
          )}
        </g>
      </svg>

      {selectedNode && (
        <aside className="canvas-panel">
          <h3>Node settings</h3>
          <label className="canvas-label" htmlFor="node-agent">Agent</label>
          <Select
            id="node-agent"
            aria-label="Node agent"
            placeholder="Select agent"
            value={selectedNode.agentId}
            onChange={v => patchNode(selectedNode.key, { agentId: v })}
            options={agentOptions}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          />
          <label className="canvas-label" htmlFor="node-instr">Instruction (optional)</label>
          <Input.TextArea
            id="node-instr"
            aria-label="Node instruction"
            rows={4}
            value={selectedNode.instruction}
            onChange={e => patchNode(selectedNode.key, { instruction: e.target.value })}
            placeholder="e.g. Rewrite the input as one crisp sentence."
          />
          <Button danger block style={{ marginTop: 12 }} onClick={() => removeNode(selectedNode.key)}>
            Delete node
          </Button>
        </aside>
      )}

      {run && (
        <div className="canvas-runbar">
          <Space size="small">
            <Tag color={RUN_COLOR[run.status]}>{run.status}</Tag>
            {run.durationMs > 0 && <span className="run-meta">{(run.durationMs / 1000).toFixed(1)}s</span>}
            <span className="run-meta">{run.task.slice(0, 60)}</span>
          </Space>
          {run.error && <Alert type="error" showIcon message={run.error} style={{ marginTop: 8 }} />}
          {run.status === 'succeeded' && <pre className="run-output">{run.output || '(no output)'}</pre>}
        </div>
      )}

      <Modal
        title="Trigger settings"
        open={trigOpen}
        onOk={() => setTrigOpen(false)}
        onCancel={() => setTrigOpen(false)}
        okText="Done"
        cancelButtonProps={{ style: { display: 'none' } }}
      >
        <div className="trig-row">
          <label htmlFor="trig-type">Trigger</label>
          <Select
            id="trig-type"
            value={trig.type}
            onChange={v => setTrig(prev => ({ ...prev, type: v }))}
            style={{ width: 220 }}
            options={[
              { value: 'manual', label: 'Manual — Run button only' },
              { value: 'interval', label: 'Interval — run on a timer' },
              { value: 'webhook', label: 'Webhook — run via HTTP POST' },
            ]}
          />
        </div>
        <div className="trig-row">
          <label htmlFor="trig-enabled">Enabled</label>
          <Switch id="trig-enabled" checked={trig.enabled}
                  onChange={v => setTrig(prev => ({ ...prev, enabled: v }))} />
        </div>
        {trig.type === 'interval' && (
          <div className="trig-row">
            <label htmlFor="trig-interval">Every (seconds)</label>
            <InputNumber id="trig-interval" min={10} max={604800} value={trig.intervalSec}
                         onChange={v => setTrig(prev => ({ ...prev, intervalSec: Number(v) || 10 }))} />
          </div>
        )}
        {trig.type !== 'manual' && (
          <>
            <label className="canvas-label" htmlFor="trig-task">
              Default task — what automated runs execute
            </label>
            <Input.TextArea
              id="trig-task"
              rows={3}
              value={trig.defaultTask}
              onChange={e => setTrig(prev => ({ ...prev, defaultTask: e.target.value }))}
              placeholder="e.g. Audit the latest logs and summarize anomalies."
            />
          </>
        )}
        {trig.type === 'webhook' && (
          <div className="trig-hook">
            {webhookPath
              ? <>POST <code>{`${window.location.origin}${webhookPath}`}</code>
                  <span className="run-meta"> — optional JSON body {'{"task": "..."}'} overrides the default task</span></>
              : <span className="run-meta">Save the pipeline to get its webhook URL.</span>}
          </div>
        )}
        <div className="run-meta" style={{ marginTop: 12 }}>
          Changes apply when you save the pipeline.
        </div>
      </Modal>

      <Modal
        title="Run pipeline"
        open={taskOpen}
        onOk={startRun}
        onCancel={() => setTaskOpen(false)}
        okText="Run"
        okButtonProps={{ disabled: !task.trim() }}
      >
        <Input.TextArea
          rows={3}
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="Describe the task for this pipeline…"
          aria-label="Pipeline task"
        />
      </Modal>
    </main>
  );
}
