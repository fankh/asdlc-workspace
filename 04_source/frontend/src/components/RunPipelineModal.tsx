import { useEffect, useRef, useState } from 'react';
import { Modal, Input, Button, Tag, Empty, Alert, Space } from 'antd';
import { startPipelineRun, listPipelineRuns, getPipelineRun } from '../api/client';
import type { Pipeline, PipelineRun, PipelineStepRun } from '../api/types';

const STATUS_COLOR: Record<string, string | undefined> = {
  pending: undefined,
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
  skipped: undefined,
};

const fmtDur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

function StepRow({ step }: { step: PipelineStepRun }) {
  return (
    <div className="run-history-item">
      <Space size="small">
        <Tag color={STATUS_COLOR[step.status]}>{step.status}</Tag>
        <b>{step.order + 1}. {step.agentName}</b>
        {step.model && <span className="run-meta mono-cell">{step.model}</span>}
        {step.durationMs > 0 && <span className="run-meta">{fmtDur(step.durationMs)}</span>}
      </Space>
      {step.instruction && <div className="run-history-task">{step.instruction}</div>}
      {step.status === 'failed'
        ? <div className="run-history-error">{step.error}</div>
        : step.output && <div className="run-history-output">{step.output}</div>}
    </div>
  );
}

interface Props {
  pipeline: Pipeline | null;
  onClose: () => void;
}

// Run an agent chain against a task; each step's live status streams in via
// polling until the run leaves `running`.
export default function RunPipelineModal({ pipeline, onClose }: Props) {
  const [task, setTask] = useState('');
  const [active, setActive] = useState<PipelineRun | null>(null);
  const [history, setHistory] = useState<PipelineRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const running = active?.status === 'running';

  const loadHistory = async (pipelineId: string) => {
    try { setHistory(await listPipelineRuns(pipelineId)); } catch { /* non-fatal */ }
  };

  useEffect(() => {
    setTask(''); setActive(null); setError(null); setHistory([]);
    if (pipeline) loadHistory(pipeline.id);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [pipeline?.id]);

  useEffect(() => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    if (!active || active.status !== 'running') return;
    poll.current = setInterval(async () => {
      try {
        const updated = await getPipelineRun(active.id);
        setActive(updated);
        if (updated.status !== 'running' && pipeline) loadHistory(pipeline.id);
      } catch { /* keep polling */ }
    }, 1500);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, [active?.id, active?.status]);

  const run = async () => {
    if (!pipeline || !task.trim()) return;
    setError(null);
    try {
      setActive(await startPipelineRun(pipeline.id, task.trim()));
    } catch (e: any) {
      setError(e?.message || 'Failed to start the pipeline run.');
    }
  };

  return (
    <Modal
      title={pipeline ? `Run ${pipeline.name}` : 'Run pipeline'}
      open={!!pipeline}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={680}
    >
      {pipeline && (
        <>
          <div className="run-model-hint">
            chain: {pipeline.steps.map(s => s.agentName).join(' → ') || '(no steps)'}
          </div>

          <Input.TextArea
            rows={3}
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Describe the task for this pipeline…"
            aria-label="Pipeline task"
            disabled={running}
          />
          <div style={{ margin: '10px 0 4px' }}>
            <Button type="primary" onClick={run} loading={running} disabled={!task.trim()}>
              {running ? 'Running…' : 'Run pipeline'}
            </Button>
          </div>

          {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}

          {active && (
            <div className="run-result">
              <Space>
                <Tag color={STATUS_COLOR[active.status]}>{active.status}</Tag>
                {active.status !== 'running' && <span className="run-meta">{fmtDur(active.durationMs)}</span>}
              </Space>
              {active.error && <Alert type="error" showIcon message={active.error} style={{ margin: '8px 0' }} />}
              <div style={{ marginTop: 8 }}>
                {active.steps.map(s => <StepRow key={s.id} step={s} />)}
              </div>
              {active.status === 'succeeded' && (
                <>
                  <h4 className="run-history-title">Final output</h4>
                  <pre className="run-output">{active.output || '(no output)'}</pre>
                </>
              )}
            </div>
          )}

          <h4 className="run-history-title">History</h4>
          {history.length === 0
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No runs yet" />
            : history.map(h => (
                <div className="run-history-item" key={h.id}>
                  <Space size="small">
                    <Tag color={STATUS_COLOR[h.status]}>{h.status}</Tag>
                    {h.trigger !== 'manual' && <Tag color={h.trigger === 'interval' ? 'geekblue' : 'purple'}>⚡ {h.trigger}</Tag>}
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
