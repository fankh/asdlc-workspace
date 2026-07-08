import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag, Space } from 'antd';
import { listPipelines, deletePipeline, listAgents } from '../api/client';
import type { Agent, Pipeline } from '../api/types';
import PipelineEditorModal from '../components/PipelineEditorModal';
import RunPipelineModal from '../components/RunPipelineModal';

const RUN_COLOR: Record<string, string | undefined> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};

// Multi-agent pipelines: ordered chains where each agent's output feeds the
// next. Create a chain from registered agents, then run it against a task.
export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [running, setRunning] = useState<Pipeline | null>(null);

  const fetchAll = async () => {
    try {
      const [p, a] = await Promise.all([listPipelines(), listAgents()]);
      setPipelines(p);
      setAgents(a);
      setError(null);
    } catch {
      setError('Failed to load pipelines. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id: string) => {
    setPipelines(prev => prev.filter(p => p.id !== id));
    try { await deletePipeline(id); } catch { /* optimistic update stands */ }
  };

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (p: Pipeline) => { setEditing(p); setEditorOpen(true); };
  const onSaved = (saved: Pipeline) => {
    setPipelines(prev => {
      const exists = prev.some(p => p.id === saved.id);
      return exists ? prev.map(p => (p.id === saved.id ? saved : p)) : [saved, ...prev];
    });
  };

  const columns = [
    { title: 'name', dataIndex: 'name', key: 'name' },
    {
      title: 'chain', key: 'chain',
      render: (_: unknown, p: Pipeline) => (
        <span className="pipe-chain">{p.steps.map(s => s.agentName).join(' → ') || '—'}</span>
      ),
    },
    { title: 'description', dataIndex: 'description', key: 'description', render: (v: string) => v || '—' },
    {
      title: 'last run', key: 'lastRun',
      render: (_: unknown, p: Pipeline) => p.lastRun
        ? <Tag color={RUN_COLOR[p.lastRun.status]} className="mono-cell">{p.lastRun.status}</Tag>
        : <span className="run-meta">never</span>,
    },
    {
      title: '', key: 'action', width: 220,
      render: (_: unknown, p: Pipeline) => (
        <Space>
          <Button size="small" type="primary" onClick={() => setRunning(p)}>Run</Button>
          <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
          <Button size="small" danger onClick={() => handleDelete(p.id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>Pipelines</h1>
        <span className="count-chip">{loading ? '…' : `${pipelines.length} defined`}</span>
        <Button type="primary" style={{ marginLeft: 'auto' }} onClick={openCreate}>New pipeline</Button>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      {pipelines.length === 0 && !loading ? (
        <Empty description="No pipelines yet">
          <Button type="primary" onClick={openCreate}>Create your first pipeline</Button>
        </Empty>
      ) : (
        <Table
          dataSource={pipelines}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}

      <PipelineEditorModal
        open={editorOpen}
        pipeline={editing}
        agents={agents}
        onClose={() => setEditorOpen(false)}
        onSaved={onSaved}
      />
      <RunPipelineModal pipeline={running} onClose={() => setRunning(null)} />
    </main>
  );
}
