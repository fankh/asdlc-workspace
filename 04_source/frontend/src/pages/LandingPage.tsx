import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useT();

  return (
    <main className="landing-container">
      <span className="eyebrow">{t('landing.badge')}</span>
      <Typography.Title level={1}>My Local Agent App</Typography.Title>
      <Typography.Paragraph className="hero-sub" type="secondary">
        {t('landing.subtitle')}
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => navigate('/onboarding')}>
        {t('landing.cta')}
      </Button>
      <div className="hero-meta" aria-hidden="true">
        <span>local-first runtime</span>
        <span>REST + OpenAPI 3.1</span>
        <span>zero-config SQLite</span>
      </div>
    </main>
  );
}
