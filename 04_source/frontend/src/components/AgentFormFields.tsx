import { Form, Input, Select, Switch } from 'antd';

// Shared AI-agent attribute inputs, rendered inside an antd <Form>.
// Used by the create form (Onboarding) and the edit modal (Agents list).
// `includeStatus` shows the status control (edit only; create defaults to idle).

export const GENDER_OPTIONS = [
  { label: 'Unspecified', value: 'unspecified' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non-binary' },
];

export const IMPORTANCE_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

export const STATUS_OPTIONS = [
  { label: 'idle', value: 'idle' },
  { label: 'active', value: 'active' },
  { label: 'paused', value: 'paused' },
];

const MODEL_OPTIONS = [
  'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5',
  'gpt-4o', 'llama3', 'qwen3.6',
].map((m) => ({ label: m, value: m }));

const SKILL_SUGGESTIONS = [
  'code-review', 'static-analysis', 'anomaly-detection', 'ci-cd', 'security',
  'scheduling', 'monitoring', 'search', 'routing', 'automation',
].map((s) => ({ label: s, value: s }));

export default function AgentFormFields({ includeStatus = false }: { includeStatus?: boolean }) {
  return (
    <>
      <Form.Item name="role" label="Role">
        <Input placeholder="e.g. Reviewer, Analyst, Orchestrator" />
      </Form.Item>
      <Form.Item name="persona" label="Persona">
        <Input.TextArea rows={2} placeholder="Character / voice, e.g. 'concise senior engineer'" />
      </Form.Item>
      <Form.Item name="skills" label="Skills">
        <Select mode="tags" allowClear placeholder="Add skills and press Enter" options={SKILL_SUGGESTIONS} />
      </Form.Item>
      <Form.Item name="gender" label="Gender">
        <Select options={GENDER_OPTIONS} placeholder="Persona gender" />
      </Form.Item>
      <Form.Item name="importance" label="Importance">
        <Select options={IMPORTANCE_OPTIONS} placeholder="Operational importance" />
      </Form.Item>
      <Form.Item name="model" label="Model">
        <Select showSearch allowClear placeholder="LLM powering this agent" options={MODEL_OPTIONS} />
      </Form.Item>
      <Form.Item name="goal" label="Goal">
        <Input.TextArea rows={2} placeholder="What this agent is meant to achieve" />
      </Form.Item>
      <Form.Item name="context" label="Context"
        tooltip="Standing knowledge injected into every run: system docs, formats, house rules">
        <Input.TextArea rows={3} placeholder="Standing knowledge this agent should always have" />
      </Form.Item>
      <Form.Item name="memory" label="Memory" valuePropName="checked"
        tooltip="Inject compact summaries of this agent's recent runs into new runs">
        <Switch />
      </Form.Item>
      {includeStatus && (
        <Form.Item name="status" label="Status">
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
      )}
    </>
  );
}
