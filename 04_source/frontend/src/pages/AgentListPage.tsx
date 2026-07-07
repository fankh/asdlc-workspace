import { useEffect, useState } from 'react';
import { Typography, Table, Button, Empty, Alert, Tag, Popconfirm, Link } from 'antd';
import { listAgents, deleteAgent } from '../api/client';
import type { Agent } from '../api/types';

// Displays registered agents with inline deletion and contextual empty state.
// Date formatting uses locale-aware formatter to guarantee YYYY-MM-DD output.
export default function AgentListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAgents() {
      try {
        const data = await listAgents();
        if (!cancelled) setAgents(data);
      } catch (err: any) {
        if (!cancelled) setError('Failed to load agents. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAgents();
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    // Optimistic row removal ensures zero page reloads per spec.
    setAgents(prev => prev.filter(a => a.id !== id));
    await deleteAgent(id).catch(() => {
      // Revert on failure to maintain consistency
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
      <Typography.Title level={2}>Agents</Typography.Title>
      {error && (
        <Alert message={error} type="error" showIcon action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      )}

      {agents.length === 0 && !loading ? (
        <Empty description="No agents registered.">
          <Link to="/onboarding">Create your first agent</Link>
        </Empty>
      ) : (
        <Table dataSource={agents} columns={columns} loading={loading} rowKey="id" pagination={false} />
      )}
    </div>
  );
}
