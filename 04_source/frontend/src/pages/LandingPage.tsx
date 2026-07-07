import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="landing-container">
      <span className="eyebrow">agent ops console</span>
      <Typography.Title level={1}>My Local Agent App</Typography.Title>
      <Typography.Paragraph className="hero-sub" type="secondary">
        Register, monitor, and retire the automation agents running on your
        machines — one local console, no cloud dependency, data stays with you.
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => navigate('/onboarding')}>
        Get Started
      </Button>
      <div className="hero-meta" aria-hidden="true">
        <span>local-first runtime</span>
        <span>REST + OpenAPI 3.1</span>
        <span>zero-config SQLite</span>
      </div>
    </main>
  );
}
