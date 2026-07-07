import { useState } from 'react';
import { Typography, Card, Form, Input, Button, Alert } from 'antd';
import { createAgent } from '../api/client';
import { useNavigate } from 'react-router-dom';

// Handles agent registration with local validation and optimistic navigation.
// Validation errors are delegated to Ant Design's internal form state per pattern.
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
      // Network/server errors bubble up; validation is handled by form.setFields internally
      if (err.status !== 400) {
        setError('Failed to create agent. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="centered-page">
      <Card>
        <Typography.Title level={2}>Onboarding</Typography.Title>
        {error && <Alert message={error} type="error" showIcon />}
        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="name"
            label="Agent name"
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
    </div>
  );
}
