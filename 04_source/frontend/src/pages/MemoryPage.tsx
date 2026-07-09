import { useEffect, useMemo, useRef, useState } from 'react';
import { Input, Select, Tag, Alert, Empty, Button, Popconfirm, Progress, Space } from 'antd';
import { getMemory, forgetMemory, forgetAgentMemory } from '../api/client';
import type { MemoryView } from '../api/types';
import { useT } from '../i18n';

// Stored semantic memory: what memory-enabled agents remember, and a live
// semantic search over the vector store (query -> KNN -> ranked snippets).
export default function MemoryPage() {
  const [q, setQ] = useState('');
  const [agentId, setAgentId] = useState<string | undefined>();
  const [view, setView] = useState<MemoryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo(() => ({ agentId, q: q.trim() || undefined, limit: 100 }), [agentId, q]);

  const load = async () => {
    setLoading(true);
    try {
      setView(await getMemory(query));
      setError(null);
    } catch {
      setError('Failed to load memory store.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const removeOne = async (rowid: number) => {
    setView(v => v && { ...v, memories: v.memories.filter(m => m.rowid !== rowid), total: Math.max(0, v.total - 1) });
    try { await forgetMemory(rowid); } catch { load(); }
  };

  const clearAgent = async (id: string) => {
    try { await forgetAgentMemory(id); } finally { setAgentId(undefined); load(); }
  };

  const agentOptions = (view?.byAgent ?? []).map(a => ({ label: `${a.agentName} (${a.count})`, value: a.agentId }));

  return (
    <main className="page-container">
      <div className="page-header">
        <h1>{t('memory.title')}</h1>
        <span className="count-chip">{loading ? '…' : t('memory.count', { n: view?.total ?? 0 })}</span>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      {view && !view.enabled ? (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={t('memory.unavailable')}
          description="The embedding model or sqlite-vec isn't available, so agents fall back to recency-based recall. Stored semantic memory will appear here once it's running."
        />
      ) : null}

      {/* per-agent summary */}
      {view && view.byAgent.length > 0 && (
        <div className="mem-summary">
          {view.byAgent.map(a => (
            <button
              key={a.agentId}
              className={'mem-chip' + (agentId === a.agentId ? ' active' : '')}
              onClick={() => setAgentId(agentId === a.agentId ? undefined : a.agentId)}
            >
              {a.agentName} <span className="mem-chip-n">{a.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="log-controls">
        <Input.Search
          allowClear
          placeholder={t('memory.search')}
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label={t('common.search')}
          style={{ maxWidth: 460 }}
        />
        <Select
          allowClear placeholder={t('memory.agent')} value={agentId} onChange={setAgentId} style={{ minWidth: 200 }}
          aria-label={t('memory.agent')} options={agentOptions} showSearch optionFilterProp="label"
        />
        {agentId && (
          <Popconfirm title="Forget this agent's memories?" okText="Forget" okButtonProps={{ danger: true }}
            onConfirm={() => clearAgent(agentId)}>
            <Button danger>{t('memory.clear')}</Button>
          </Popconfirm>
        )}
      </div>

      {view && view.searched && (
        <p className="run-meta" style={{ marginTop: -6, marginBottom: 12 }}>
          Ranked by semantic relevance to “{q.trim()}”.
        </p>
      )}

      {view && view.memories.length === 0 && !loading ? (
        <Empty description={q ? t('memory.nomatch') : t('memory.empty')} />
      ) : (
        <div className="mem-list">
          {view?.memories.map(m => (
            <div className="mem-item" key={m.rowid}>
              <div className="mem-item-head">
                <Tag className="mono-cell">{m.agentName}</Tag>
                {m.relevance != null && (
                  <span className="mem-relevance" title={`distance ${m.distance?.toFixed(3)}`}>
                    <Progress percent={Math.round(m.relevance * 100)} size="small" showInfo={false}
                      style={{ width: 90 }} />
                    <span className="run-meta">{Math.round(m.relevance * 100)}%</span>
                  </span>
                )}
                <Space style={{ marginLeft: 'auto' }}>
                  <Popconfirm title="Forget this memory?" okText="Forget" okButtonProps={{ danger: true }}
                    onConfirm={() => removeOne(m.rowid)}>
                    <Button size="small" type="text" danger aria-label="Forget memory">✕</Button>
                  </Popconfirm>
                </Space>
              </div>
              <div className="mem-snippet">{m.snippet}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
