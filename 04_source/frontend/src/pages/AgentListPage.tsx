import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { listAgents, deleteAgent } from '../api/client';
import type { Agent } from '../api/types';

// Status semantics use Ant preset tag palettes (dark-algorithm aware).
const STATUS_COLOR: Record<string, string | undefined> = {
  active: 'green',
  paused: 'gold',
  idle: undefined, // default neutral
};

export default function AgentListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      const data = await listAgents();
      setAgents(data);
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
    await deleteAgent(id).catch(() => {
      fetchAgents();
    });
  };

  const dateFormatter = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (val: string | null) => val || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLOR[status]} className="mono-cell">{status}</Tag>
      ),
    },
    {
      title: 'Creation date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span className="mono-cell">{dateFormatter.format(new Date(date))}</span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, record: Agent) => (
        <Button danger onClick={() => handleDelete(record.id)}>Delete</Button>
      ),
    },
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

      {agents.length === 0 && !loading ? (
        <Empty description="No data available">
          <Link to="/onboarding">Add agent</Link>
        </Empty>
      ) : (
        <Table dataSource={agents} columns={columns} loading={loading} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />
      )}
    </main>
  );
}
