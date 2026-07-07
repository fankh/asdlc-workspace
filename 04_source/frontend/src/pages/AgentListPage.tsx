import { useEffect, useState } from 'react';
import { Table, Button, Empty, Alert, Tag, Popconfirm } from 'antd';
import { Link } from 'react-router-dom';
import { listAgents, deleteAgent } from '../api/client';
import type { Agent } from '../api/types';

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
    { title: 'name', dataIndex: 'name', key: 'name' },
    { title: 'description', dataIndex: 'description', key: 'description', render: (val: string | null) => val || '' },
    { title: 'status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
    {
      title: 'creation date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dateFormatter.format(new Date(date)),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, record: Agent) => (
        <Popconfirm title="Delete agent?" description="Are you sure?" okText="Yes" cancelText="No">
          <Button danger onClick={() => handleDelete(record.id)}>Delete</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page-container">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: '16px' }}>Agents</h2>
      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      {agents.length === 0 && !loading ? (
        <Empty description="No data available">
          <Link to="/onboarding">Create your first agent</Link>
        </Empty>
      ) : (
        <Table dataSource={agents} columns={columns} loading={loading} rowKey="id" pagination={false} />
      )}
    </div>
  );
}
