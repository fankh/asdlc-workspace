import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AgentListPage from './pages/AgentListPage';

export default function App() {
  return (
    <ConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/agents" element={<AgentListPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
