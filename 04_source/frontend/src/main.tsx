import { ConfigProvider } from 'antd';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { makeAppTheme, ThemeModeContext, type ThemeMode } from './theme';
import './styles.css';

// '' at root, '/agents' when built with VITE_BASE=/agents/ (subpath deploys)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

function Root() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('theme') as ThemeMode) || 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = mode; // drives the CSS variables
    localStorage.setItem('theme', mode);
  }, [mode]);
  const toggle = () => setMode(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter basename={basename}>
      <ConfigProvider theme={makeAppTheme(mode)}>
        <ThemeModeContext.Provider value={{ mode, toggle }}>
          <App />
        </ThemeModeContext.Provider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
