import { useState } from 'react';
import { Card, Form, Input, Button, Alert } from 'antd';
import { createAgent } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    try {
      await createAgent(values);
      navigate('/agents');
    } catch (err: any) {
      if (err.status !== 400) {
        setError('Failed to create agent. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="centered-page">
      <span className="eyebrow">step 01 — register an agent</span>
      <Card style={{ marginTop: 16 }}>
        <h2>Onboarding</h2>
        {error && <Alert message={error} type="error" showIcon />}
        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="name"
            label="Agent name *"
            rules={[{ required: true, message: 'Agent name is required.' }]}
          >
            <Input placeholder="Enter agent name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Optional details about this agent" rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Agent
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
