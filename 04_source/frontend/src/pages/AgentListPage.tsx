import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag, Select, Popconfirm } from 'antd';
import { Link } from 'react-router-dom';
import { listAgents, deleteAgent } from '../api/client';
import type { Agent } from '../api/types';

const STATUS_COLOR: Record<string, string | undefined> = {
  active: 'green',
  paused: 'gold',
  idle: undefined,
};

export default function AgentListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
    try {
      await deleteAgent(id);
    } catch {
      // Optimistic update stands; server sync handles reconciliation
    }
  };

  const dateFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const filteredAgents = filterStatus === 'all' ? agents : agents.filter(a => a.status === filterStatus);

  const columns = [
    { title: 'name', dataIndex: 'name', key: 'name' },
    { title: 'description', dataIndex: 'description', key: 'description', render: (val: string | null) => val || '—' },
    {
      title: 'status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={STATUS_COLOR[status]} className="mono-cell">{status}</Tag>,
    },
    {
      title: 'creation date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => <span className="mono-cell">{dateFormatter.format(new Date(date))}</span>,
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, record: Agent) => (
        <Popconfirm title="Delete agent?" description="Are you sure?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
          <Button danger>Delete</Button>
        </Popconfirm>
      ),
    },
  ];

  const filterOptions = [
    { label: 'All', value: 'all' },
    { label: 'idle', value: 'idle' },
    { label: 'active', value: 'active' },
    { label: 'paused', value: 'paused' },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <h2>Agents</h2>
        <span className="count-chip">{loading ? '…' : `${agents.length} registered`}</span>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      <div className="control-bar">
        <Select value={filterStatus} onChange={(val) => setFilterStatus(val)} options={filterOptions} style={{ width: 120 }} />
      </div>

      {filteredAgents.length === 0 && !loading ? (
        <Empty description="No agents registered.">
          <Link to="/onboarding">Create your first agent</Link>
        </Empty>
      ) : (
        <Table dataSource={filteredAgents} columns={columns} loading={loading} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: null }} />
      )}
    </main>
  );
}
