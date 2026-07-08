import { useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, Tag, Empty, Alert, Space } from 'antd';
import { startRun, listRuns, getRun } from '../api/client';
import type { Agent, AgentRun } from '../api/types';

const STATUS_COLOR: Record<string, string | undefined> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

// Run a single agent against a task. Execution is async on the server; we poll
// the active run until it leaves `running`, then refresh history.
export default function RunAgentModal({ agent, onClose }: Props) {
  const [task, setTask] = useState('');
  const [active, setActive] = useState<AgentRun | null>(null);
  const [history, setHistory] = useState<AgentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = active?.status === 'running';

  const loadHistory = async (agentId: string) => {
    try { setHistory(await listRuns(agentId)); } catch { /* non-fatal */ }
  };

  // Reset + load history whenever a different agent opens the modal.
  useEffect(() => {
    setTask(''); setActive(null); setError(null); setHistory([]);
    if (agent) loadHistory(agent.id);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [agent?.id]);

  // Poll the active run while it is running.
  useEffect(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    if (!active || active.status !== 'running') return;
    poll.current = setInterval(async () => {
      try {
        const updated = await getRun(active.id);
        setActive(updated);
        if (updated.status !== 'running' && agent) loadHistory(agent.id);
      } catch { /* keep polling */ }
    }, 1500);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [active?.id, active?.status]);

  const run = async () => {
    if (!agent || !task.trim()) return;
    setError(null);
    try {
      setActive(await startRun(agent.id, task.trim()));
    } catch (e: any) {
      setError(e?.message || 'Failed to start the run.');
    }
  };

  const fmtDur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

  return (
    <Modal
      title={agent ? `Run ${agent.name}` : 'Run agent'}
      open={!!agent}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={640}
    >
      {agent && (
        <>
          <div className="run-model-hint">
            model: <span className="mono-cell">{agent.model || 'qwen3.6:latest (default)'}</span>
            {agent.role && <> · role: {agent.role}</>}
          </div>

          <Input.TextArea
            rows={3}
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Describe the task for this agent…"
            aria-label="Task"
            disabled={running}
          />
          <div style={{ margin: '10px 0 4px' }}>
            <Button type="primary" onClick={run} loading={running} disabled={!task.trim()}>
              {running ? 'Running…' : 'Run agent'}
            </Button>
          </div>

          {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}

          {active && (
            <div className="run-result">
              <Space>
                <Tag color={STATUS_COLOR[active.status]}>{active.status}</Tag>
                {active.status !== 'running' && <span className="run-meta">{fmtDur(active.durationMs)}</span>}
              </Space>
              {active.status === 'failed'
                ? <Alert type="error" showIcon message={active.error} style={{ marginTop: 8 }} />
                : <pre className="run-output">{active.output || (running ? 'thinking…' : '(no output)')}</pre>}
            </div>
          )}

          <h4 className="run-history-title">History</h4>
          {history.length === 0
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No runs yet" />
            : history.map(h => (
                <div className="run-history-item" key={h.id}>
                  <Space size="small">
                    <Tag color={STATUS_COLOR[h.status]}>{h.status}</Tag>
                    <span className="run-meta">{new Date(h.createdAt).toLocaleString()}</span>
                    {h.durationMs > 0 && <span className="run-meta">{fmtDur(h.durationMs)}</span>}
                  </Space>
                  <div className="run-history-task">{h.task}</div>
                  {h.status === 'failed'
                    ? <div className="run-history-error">{h.error}</div>
                    : h.output && <div className="run-history-output">{h.output}</div>}
                </div>
              ))}
        </>
      )}
    </Modal>
  );
}
