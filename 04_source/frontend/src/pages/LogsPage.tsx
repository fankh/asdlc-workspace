import { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Input, Select, Tag, Drawer, Alert, Space, Empty, Button } from 'antd';
import { searchLogs } from '../api/client';
import type { LogEntry, LogQuery } from '../api/types';

const STATUS_COLOR: Record<string, string | undefined> = {
  running: 'blue',
  succeeded: 'green',
  failed: 'red',
};
// AA-safe kind chip (antd's geekblue/purple presets fail contrast on dark)
const KindChip = ({ kind }: { kind: string }) => (
  <span className={`log-kind log-kind-${kind}`}>{kind}</span>
);

const fmtDur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

// Unified activity log: search across every agent run and pipeline run by text
// in the task/output, filtered by status and kind. The console's only global,
// searchable view of what the agents have actually done.
export default function LogsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LogQuery['status']>();
  const [kind, setKind] = useState<LogQuery['kind']>();
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<LogEntry | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo<LogQuery>(() => ({ q: q.trim() || undefined, status, kind, limit: 100 }),
    [q, status, kind]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        setRows(await searchLogs(query));
        setError(null);
      } catch {
        setError('Failed to search logs. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const columns = [
    {
      title: 'when', dataIndex: 'createdAt', key: 'createdAt', width: 170,
      render: (d: string) => <span className="mono-cell">{new Date(d).toLocaleString()}</span>,
    },
    {
      title: 'kind', dataIndex: 'kind', key: 'kind', width: 90,
      render: (k: string) => <KindChip kind={k} />,
    },
    { title: 'source', dataIndex: 'source', key: 'source', width: 180 },
    {
      title: 'task', dataIndex: 'task', key: 'task',
      render: (t: string) => <span className="log-cell">{t}</span>,
    },
    {
      title: 'status', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string, r: LogEntry) => (
        <Space size={4}>
          <Tag color={STATUS_COLOR[s]} className="mono-cell">{s}</Tag>
          {r.trigger !== 'manual' && <span className="run-meta">⚡</span>}
        </Space>
      ),
    },
    {
      title: 'took', dataIndex: 'durationMs', key: 'durationMs', width: 80,
      render: (ms: number) => <span className="run-meta">{ms > 0 ? fmtDur(ms) : '—'}</span>,
    },
  ];

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>Logs</h1>
        <span className="count-chip">{loading ? '…' : `${rows.length} entries`}</span>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <div className="log-controls">
        <Input.Search
          allowClear
          placeholder="Search task or output text…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search logs"
          style={{ maxWidth: 420 }}
        />
        <Select
          allowClear placeholder="Kind" value={kind} onChange={setKind} style={{ width: 130 }}
          aria-label="Filter by kind"
          options={[{ label: 'Agent runs', value: 'agent' }, { label: 'Pipeline runs', value: 'pipeline' }]}
        />
        <Select
          allowClear placeholder="Status" value={status} onChange={setStatus} style={{ width: 130 }}
          aria-label="Filter by status"
          options={[
            { label: 'succeeded', value: 'succeeded' },
            { label: 'failed', value: 'failed' },
            { label: 'running', value: 'running' },
          ]}
        />
      </div>

      {rows.length === 0 && !loading ? (
        <Empty description={q || status || kind ? 'No matching activity' : 'No runs yet'} />
      ) : (
        <Table
          dataSource={rows}
          columns={columns}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onClick: () => setViewing(r), style: { cursor: 'pointer' } })}
        />
      )}

      <Drawer
        title={viewing ? `${viewing.kind} run — ${viewing.source}` : 'Log entry'}
        open={!!viewing}
        onClose={() => setViewing(null)}
        width={560}
      >
        {viewing && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <KindChip kind={viewing.kind} />
              <Tag color={STATUS_COLOR[viewing.status]}>{viewing.status}</Tag>
              {viewing.trigger !== 'manual' && <Tag color="gold">⚡ {viewing.trigger}</Tag>}
              {viewing.model && <span className="run-meta mono-cell">{viewing.model}</span>}
              {viewing.durationMs > 0 && <span className="run-meta">{fmtDur(viewing.durationMs)}</span>}
              <span className="run-meta">{new Date(viewing.createdAt).toLocaleString()}</span>
            </Space>
            <h4 className="run-history-title">Task</h4>
            <pre className="run-output">{viewing.task}</pre>
            <h4 className="run-history-title">Output</h4>
            <pre className="run-output">{viewing.output || '(none)'}</pre>
            <Button style={{ marginTop: 12 }} onClick={() => setViewing(null)}>Close</Button>
          </>
        )}
      </Drawer>
    </main>
  );
}
