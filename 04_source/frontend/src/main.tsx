import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import koKR from 'antd/locale/ko_KR';
import jaJP from 'antd/locale/ja_JP';
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { makeAppTheme, ThemeModeContext, type ThemeMode } from './theme';
import { LangContext, translate, type Lang } from './i18n';
import './styles.css';

// '' at root, '/agents' when built with VITE_BASE=/agents/ (subpath deploys)
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

const ANTD_LOCALE = { en: enUS, ko: koKR, ja: jaJP };
const HTML_LANG = { en: 'en', ko: 'ko', ja: 'ja' };

function Root() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('theme') as ThemeMode) || 'dark',
  );
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('lang') as Lang) || 'en',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = mode; // drives the CSS variables
    localStorage.setItem('theme', mode);
  }, [mode]);
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
    localStorage.setItem('lang', lang);
  }, [lang]);

  const toggle = () => setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  const langValue = useMemo(
    () => ({ lang, setLang, t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v) }),
    [lang],
  );

  return (
    <BrowserRouter basename={basename}>
      <ConfigProvider theme={makeAppTheme(mode)} locale={ANTD_LOCALE[lang]}>
        <ThemeModeContext.Provider value={{ mode, toggle }}>
          <LangContext.Provider value={langValue}>
            <App />
          </LangContext.Provider>
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
