import { useEffect, useState } from 'react';
import { Modal, Input, Button, Select, Alert, Space } from 'antd';
import { createPipeline, updatePipeline } from '../api/client';
import type { Agent, Pipeline } from '../api/types';

interface StepDraft {
  agentId?: string;
  instruction: string;
}

interface Props {
  open: boolean;
  pipeline: Pipeline | null; // null = create
  agents: Agent[];
  onClose: () => void;
  onSaved: (saved: Pipeline) => void;
}

// Build or edit an agent chain: ordered steps, each an agent plus an optional
// per-step instruction that frames the input it receives from the previous step.
export default function PipelineEditorModal({ open, pipeline, agents, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([{ instruction: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(pipeline?.name ?? '');
    setDescription(pipeline?.description ?? '');
    setSteps(pipeline
      ? pipeline.steps.map(s => ({ agentId: s.agentId, instruction: s.instruction }))
      : [{ instruction: '' }]);
  }, [open, pipeline?.id]);

  const agentOptions = agents.map(a => ({ label: a.name, value: a.id }));

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setSteps(prev => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim()) { setError('Pipeline name is required.'); return; }
    if (steps.length === 0 || steps.some(s => !s.agentId)) {
      setError('Every step needs an agent.'); return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        steps: steps.map(s => ({ agentId: s.agentId!, instruction: s.instruction.trim() || undefined })),
      };
      const saved = pipeline
        ? await updatePipeline(pipeline.id, payload)
        : await createPipeline(payload);
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save the pipeline.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={pipeline ? `Edit ${pipeline.name}` : 'New pipeline'}
      open={open}
      onCancel={onClose}
      onOk={save}
      okText={pipeline ? 'Save changes' : 'Create pipeline'}
      confirmLoading={saving}
      width={640}
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      <div className="pipe-field">
        <label htmlFor="pipe-name">Name</label>
        <Input id="pipe-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Draft then review" />
      </div>
      <div className="pipe-field">
        <label htmlFor="pipe-desc">Description</label>
        <Input id="pipe-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What this chain does (optional)" />
      </div>

      <div className="pipe-steps-head">Steps — each step receives the previous step's output</div>
      {steps.map((s, i) => (
        <div className="pipe-step" key={i}>
          <div className="pipe-step-row">
            <span className="pipe-step-no">{i + 1}</span>
            <Select
              aria-label={`Step ${i + 1} agent`}
              placeholder="Select agent"
              value={s.agentId}
              onChange={v => setStep(i, { agentId: v })}
              options={agentOptions}
              style={{ flex: 1 }}
              showSearch
              optionFilterProp="label"
            />
            <Space size={4}>
              <Button size="small" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
              <Button size="small" aria-label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</Button>
              <Button size="small" danger aria-label={`Remove step ${i + 1}`} disabled={steps.length === 1} onClick={() => removeStep(i)}>✕</Button>
            </Space>
          </div>
          <Input
            aria-label={`Step ${i + 1} instruction`}
            value={s.instruction}
            onChange={e => setStep(i, { instruction: e.target.value })}
            placeholder="Optional instruction, e.g. “Rewrite the input as one crisp sentence.”"
          />
        </div>
      ))}
      <Button
        onClick={() => setSteps(prev => [...prev, { instruction: '' }])}
        disabled={steps.length >= 10}
        style={{ marginTop: 4 }}
      >
        Add step
      </Button>
    </Modal>
  );
}
