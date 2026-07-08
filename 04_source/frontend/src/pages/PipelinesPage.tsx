import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listPipelines, deletePipeline } from '../api/client';
import type { Pipeline } from '../api/types';
import RunPipelineModal from '../components/RunPipelineModal';

const RUN_COLOR: Record<string, string | undefined> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};

// Multi-agent pipelines: ordered chains where each agent's output feeds the
// next. Create a chain from registered agents, then run it against a task.
export default function PipelinesPage() {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Pipeline | null>(null);

  const fetchAll = async () => {
    try {
      setPipelines(await listPipelines());
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

  const openCreate = () => navigate('/pipelines/new');
  const openEdit = (p: Pipeline) => navigate(`/pipelines/${p.id}`);

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

      <RunPipelineModal pipeline={running} onClose={() => setRunning(null)} />
    </main>
  );
}
