import { useContext } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AgentListPage from './pages/AgentListPage';
import PipelinesPage from './pages/PipelinesPage';
import PipelineCanvasPage from './pages/PipelineCanvasPage';
import LogsPage from './pages/LogsPage';
import MemoryPage from './pages/MemoryPage';
import { ThemeModeContext } from './theme';

export default function App() {
  const { pathname } = useLocation();
  const { mode, toggle } = useContext(ThemeModeContext);
  const cls = (p: string) =>
    'nav-item' + ((p === '/' ? pathname === '/' : pathname.startsWith(p)) ? ' active' : '');
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-brand">My Local Agent App</Link>
        <nav className="top-nav" aria-label="Main navigation">
          <Link to="/" className={cls('/')}>Home</Link>
          <Link to="/onboarding" className={cls('/onboarding')}>Register agent</Link>
          <Link to="/agents" className={cls('/agents')}>Agents</Link>
          <Link to="/pipelines" className={cls('/pipelines')}>Pipelines</Link>
          <Link to="/logs" className={cls('/logs')}>Logs</Link>
          <Link to="/memory" className={cls('/memory')}>Memory</Link>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggle}
          aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={mode === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/agents" element={<AgentListPage />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
        <Route path="/pipelines/new" element={<PipelineCanvasPage />} />
        <Route path="/pipelines/:pipelineId" element={<PipelineCanvasPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/memory" element={<MemoryPage />} />
      </Routes>
    </>
  );
}
