import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag, Space, Switch } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listPipelines, deletePipeline, updatePipeline } from '../api/client';
import type { Pipeline } from '../api/types';
import RunPipelineModal from '../components/RunPipelineModal';
import { useT } from '../i18n';

function triggerTag(p: Pipeline) {
  if (p.triggerType === 'interval') {
    const label = p.intervalSec >= 60 && p.intervalSec % 60 === 0
      ? `every ${p.intervalSec / 60}m` : `every ${p.intervalSec}s`;
    return <Tag color="geekblue" className="mono-cell">⚡ {label}</Tag>;
  }
  if (p.triggerType === 'webhook') return <Tag color="purple" className="mono-cell">⚡ webhook</Tag>;
  return <Tag className="mono-cell">manual</Tag>;
}

const RUN_COLOR: Record<string, string | undefined> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};

// Multi-agent pipelines: ordered chains where each agent's output feeds the
// next. Create a chain from registered agents, then run it against a task.
export default function PipelinesPage() {
  const navigate = useNavigate();
  const { t } = useT();
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

  // Flip enabled without touching anything else (update is full-replace, so
  // rebuild the whole graph payload from the DTO we already hold).
  const toggleEnabled = async (p: Pipeline, enabled: boolean) => {
    setPipelines(prev => prev.map(x => (x.id === p.id ? { ...x, enabled } : x)));
    try {
      const idxById = new Map(p.steps.map((s, i) => [s.id, i]));
      await updatePipeline(p.id, {
        name: p.name,
        description: p.description || undefined,
        triggerType: p.triggerType,
        intervalSec: p.intervalSec,
        defaultTask: p.defaultTask || undefined,
        enabled,
        steps: p.steps.map(s => ({
          nodeType: s.nodeType,
          agentId: s.agentId ?? undefined,
          instruction: s.instruction || undefined,
          config: s.config,
          posX: s.posX,
          posY: s.posY,
        })),
        edges: p.edges.map(e => ({
          from: idxById.get(e.fromId)!,
          to: idxById.get(e.toId)!,
          ...(e.branch ? { branch: e.branch } : {}),
        })),
      });
    } catch {
      setPipelines(prev => prev.map(x => (x.id === p.id ? { ...x, enabled: !enabled } : x)));
      setError('Failed to update the pipeline.');
    }
  };

  const columns = [
    { title: t('agents.col.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('pipes.col.chain'), key: 'chain',
      render: (_: unknown, p: Pipeline) => (
        <span className="pipe-chain">{p.steps.map(s => s.agentName).join(' → ') || '—'}</span>
      ),
    },
    { title: t('pipes.col.trigger'), key: 'trigger', render: (_: unknown, p: Pipeline) => triggerTag(p) },
    {
      title: t('pipes.col.enabled'), key: 'enabled',
      render: (_: unknown, p: Pipeline) => (
        <Switch size="small" checked={p.enabled} aria-label={`${p.name} enabled`}
                onChange={v => toggleEnabled(p, v)} />
      ),
    },
    {
      title: t('pipes.col.lastrun'), key: 'lastRun',
      render: (_: unknown, p: Pipeline) => p.lastRun
        ? <Tag color={RUN_COLOR[p.lastRun.status]} className="mono-cell">{p.lastRun.status}</Tag>
        : <span className="run-meta">{t('pipes.never')}</span>,
    },
    {
      title: '', key: 'action', width: 220,
      render: (_: unknown, p: Pipeline) => (
        <Space>
          <Button size="small" type="primary" onClick={() => setRunning(p)}>{t('common.run')}</Button>
          <Button size="small" onClick={() => openEdit(p)}>{t('common.edit')}</Button>
          <Button size="small" danger onClick={() => handleDelete(p.id)}>{t('common.delete')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>{t('pipes.title')}</h1>
        <span className="count-chip">{loading ? '…' : t('pipes.count', { n: pipelines.length })}</span>
        <Button type="primary" style={{ marginLeft: 'auto' }} onClick={openCreate}>{t('pipes.new')}</Button>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      {pipelines.length === 0 && !loading ? (
        <Empty description={t('pipes.empty')}>
          <Button type="primary" onClick={openCreate}>{t('pipes.createfirst')}</Button>
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
