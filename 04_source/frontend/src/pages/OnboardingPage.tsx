import { useState } from 'react';
import { Card, Form, Input, Button, Alert } from 'antd';
import { createAgent } from '../api/client';
import { useNavigate } from 'react-router-dom';
import AgentFormFields from '../components/AgentFormFields';
import { useT } from '../i18n';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

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
      <span className="eyebrow">{t('onboarding.eyebrow')}</span>
      <Card style={{ marginTop: 16 }}>
        <h1>{t('onboarding.welcome')}</h1>
        {error && <Alert message={error} type="error" showIcon />}
        <Form
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          initialValues={{ gender: 'unspecified', importance: 'medium' }}
        >
          <Form.Item
            name="name"
            label={t('onboarding.namelabel')}
            rules={[{ required: true, message: t('onboarding.namereq') }]}
          >
            <Input placeholder={t('onboarding.nameph')} />
          </Form.Item>
          <Form.Item name="description" label={t('onboarding.description')}>
            <Input.TextArea placeholder={t('onboarding.descph')} rows={4} />
          </Form.Item>
          <AgentFormFields />
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t('onboarding.submit')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </main>
  );
}
