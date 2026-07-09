import { useEffect, useState } from 'react';
import {
  Table, Button, Empty, Alert, Tag, Select, Space, Modal, Drawer,
  Descriptions, Form, Input,
} from 'antd';
import { Link } from 'react-router-dom';
import { listAgents, deleteAgent, updateAgent } from '../api/client';
import type { Agent, AgentInput } from '../api/types';
import AgentFormFields from '../components/AgentFormFields';
import RunAgentModal from '../components/RunAgentModal';
import { useT } from '../i18n';

const STATUS_COLOR: Record<string, string | undefined> = {
  active: 'green',
  paused: 'gold',
  idle: undefined,
};

const IMPORTANCE_COLOR: Record<string, string | undefined> = {
  critical: 'red',
  high: 'volcano',
  medium: 'blue',
  low: undefined,
};

export default function AgentListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editing, setEditing] = useState<Agent | null>(null);
  const [viewing, setViewing] = useState<Agent | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { t } = useT();

  const fetchAgents = async () => {
    try {
      const data = await listAgents();
      setAgents(data);
      setError(null);
    } catch {
      setError('Failed to load agents. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleDelete = async (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    try { await deleteAgent(id); } catch { /* optimistic update stands */ }
  };

  const openEdit = (agent: Agent) => {
    setViewing(null);
    setEditing(agent);
    form.setFieldsValue({ ...agent, description: agent.description ?? undefined });
  };

  const submitEdit = async () => {
    const values = (await form.validateFields()) as AgentInput;
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await updateAgent(editing.id, values);
      setAgents(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      setEditing(null);
    } catch {
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const dateFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const filteredAgents = filterStatus === 'all' ? agents : agents.filter(a => a.status === filterStatus);

  const columns = [
    { title: t('agents.col.name'), dataIndex: 'name', key: 'name' },
    { title: t('agents.col.description'), dataIndex: 'description', key: 'description', render: (v: string | null) => v || '—' },
    {
      title: t('agents.col.status'), dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]} className="mono-cell">{s}</Tag>,
    },
    {
      title: t('agents.col.created'), dataIndex: 'createdAt', key: 'createdAt',
      render: (d: string) => <span className="mono-cell">{dateFormatter.format(new Date(d))}</span>,
    },
    { title: t('agents.col.role'), dataIndex: 'role', key: 'role', render: (v: string) => v || '—' },
    {
      title: t('agents.col.importance'), dataIndex: 'importance', key: 'importance',
      render: (v: string) => <Tag color={IMPORTANCE_COLOR[v]} className="mono-cell">{v}</Tag>,
    },
    {
      title: '', key: 'action', width: 220,
      render: (_: unknown, record: Agent) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" type="primary" onClick={() => setRunning(record)}>{t('common.run')}</Button>
          <Button size="small" onClick={() => openEdit(record)}>{t('common.edit')}</Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>{t('common.delete')}</Button>
        </Space>
      ),
    },
  ];

  const filterOptions = [
    { label: t('common.all'), value: 'all' },
    { label: 'idle', value: 'idle' },
    { label: 'active', value: 'active' },
    { label: 'paused', value: 'paused' },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>{t('agents.title')}</h1>
        <span className="count-chip">{loading ? '…' : t('agents.count', { n: agents.length })}</span>
        <Link to="/onboarding" style={{ marginLeft: 'auto' }}>
          <Button type="primary">{t('agents.add')}</Button>
        </Link>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      <div className="control-bar">
        <Select value={filterStatus} onChange={setFilterStatus} options={filterOptions} style={{ width: 120 }} aria-label={t('agents.filter')} />
      </div>

      {filteredAgents.length === 0 && !loading ? (
        <Empty description="No data available">
          <Link to="/onboarding">Add agent</Link>
        </Empty>
      ) : (
        <Table
          key={`agent-table-${agents.length}`}
          dataSource={filteredAgents}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: null }}
          onRow={(record) => ({ onClick: () => setViewing(record), style: { cursor: 'pointer' } })}
        />
      )}

      {/* Edit modal — full management of all attributes */}
      <Modal
        title={editing ? `Edit ${editing.name}` : 'Edit agent'}
        open={!!editing}
        onOk={submitEdit}
        confirmLoading={saving}
        onCancel={() => setEditing(null)}
        okText="Save changes"
        width={560}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Agent name" rules={[{ required: true, message: 'Agent name is required.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <AgentFormFields includeStatus />
        </Form>
      </Modal>

      {/* Read-only detail drawer (row click) */}
      <Drawer
        title={viewing?.name}
        open={!!viewing}
        onClose={() => setViewing(null)}
        width={460}
        extra={viewing ? (
          <Space>
            <Button type="primary" onClick={() => { const a = viewing; setViewing(null); setRunning(a); }}>Run</Button>
            <Button onClick={() => openEdit(viewing)}>Edit</Button>
          </Space>
        ) : null}
      >
        {viewing && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Role">{viewing.role || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[viewing.status]}>{viewing.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="Importance"><Tag color={IMPORTANCE_COLOR[viewing.importance]}>{viewing.importance}</Tag></Descriptions.Item>
            <Descriptions.Item label="Persona">{viewing.persona || '—'}</Descriptions.Item>
            <Descriptions.Item label="Skills">
              {viewing.skills.length ? viewing.skills.map(s => <Tag key={s}>{s}</Tag>) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">{viewing.gender}</Descriptions.Item>
            <Descriptions.Item label="Model"><span className="mono-cell">{viewing.model || '—'}</span></Descriptions.Item>
            <Descriptions.Item label="Goal">{viewing.goal || '—'}</Descriptions.Item>
            <Descriptions.Item label="Context">{viewing.context || '—'}</Descriptions.Item>
            <Descriptions.Item label="Memory">{viewing.memory ? 'remembers recent runs' : 'off'}</Descriptions.Item>
            <Descriptions.Item label="Description">{viewing.description || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Run agent — task execution + history */}
      <RunAgentModal agent={running} onClose={() => setRunning(null)} />
    </main>
  );
}
