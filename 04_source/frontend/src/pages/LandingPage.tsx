import { Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

// Renders the initial impression zone with centered layout per UI spec.
// Semantic h1 ensures axe-core passes without custom components.
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <Typography.Title level={1}>My Local Agent App</Typography.Title>
      <Button type="primary" onClick={() => navigate('/onboarding')} aria-label="Get Started">
        Get Started
      </Button>
    </div>
  );
}
