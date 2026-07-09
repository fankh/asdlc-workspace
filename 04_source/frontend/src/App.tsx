import { useContext } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AgentListPage from './pages/AgentListPage';
import PipelinesPage from './pages/PipelinesPage';
import PipelineCanvasPage from './pages/PipelineCanvasPage';
import LogsPage from './pages/LogsPage';
import MemoryPage from './pages/MemoryPage';
import ManualPage from './pages/ManualPage';
import { ThemeModeContext } from './theme';
import { LANGS, useT } from './i18n';

export default function App() {
  const { pathname } = useLocation();
  const { mode, toggle } = useContext(ThemeModeContext);
  const { lang, setLang, t } = useT();
  const cls = (p: string) =>
    'nav-item' + ((p === '/' ? pathname === '/' : pathname.startsWith(p)) ? ' active' : '');
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-brand">My Local Agent App</Link>
        <nav className="top-nav" aria-label="Main navigation">
          <Link to="/" className={cls('/')}>{t('nav.home')}</Link>
          <Link to="/onboarding" className={cls('/onboarding')}>{t('nav.register')}</Link>
          <Link to="/agents" className={cls('/agents')}>{t('nav.agents')}</Link>
          <Link to="/pipelines" className={cls('/pipelines')}>{t('nav.pipelines')}</Link>
          <Link to="/logs" className={cls('/logs')}>{t('nav.logs')}</Link>
          <Link to="/memory" className={cls('/memory')}>{t('nav.memory')}</Link>
          <Link to="/manual" className={cls('/manual')}>{t('nav.manual')}</Link>
        </nav>
        {/* native select on purpose: keeps the header light and avoids
            polluting antd's .ant-select selectors used elsewhere */}
        <select
          className="lang-select"
          value={lang}
          onChange={e => setLang(e.target.value as typeof lang)}
          aria-label={t('lang.label')}
        >
          {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
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
        <Route path="/manual" element={<ManualPage />} />
      </Routes>
    </>
  );
}
