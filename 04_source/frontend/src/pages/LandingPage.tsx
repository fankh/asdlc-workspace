import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

// Renders the initial impression zone with centered layout per UI spec.
// Semantic h1 ensures axe-core passes without custom components.
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: '32px' }}>My Local Agent App</h1>
      <Button type="primary" onClick={() => navigate('/onboarding')} aria-label="Get Started">
        Get Started
      </Button>
    </div>
  );
}
