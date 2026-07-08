import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AgentListPage from './pages/AgentListPage';

export default function App() {
  const { pathname } = useLocation();
  const cls = (p: string) => 'nav-item' + (pathname === p ? ' active' : '');
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-brand">My Local Agent App</Link>
        <nav className="top-nav" aria-label="Main navigation">
          <Link to="/" className={cls('/')}>Home</Link>
          <Link to="/onboarding" className={cls('/onboarding')}>Register agent</Link>
          <Link to="/agents" className={cls('/agents')}>Agents</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/agents" element={<AgentListPage />} />
      </Routes>
    </>
  );
}
