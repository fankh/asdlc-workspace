import { createContext } from 'react';
import { theme, type ThemeConfig } from 'antd';

// Dark "agent ops console" theme (default) + a light counterpart.
// All colors live here or in styles.css variables (no hex in components).
// Every text/background pair clears WCAG AA 4.5:1 — verified by the
// axe-core scenarios in e2e/.

export type ThemeMode = 'dark' | 'light';

export const makeAppTheme = (mode: ThemeMode): ThemeConfig =>
  mode === 'dark'
    ? {
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#2DD4A7',
          colorLink: '#4CC2FF',
          colorBgBase: '#0B1016',
          colorBgLayout: '#0B1016',
          colorBgContainer: '#111823',
          colorTextBase: '#E8EEF4',
          colorTextSecondary: '#A9B7C6',
          colorTextDescription: '#A9B7C6',
          colorTextPlaceholder: '#8A96A4',
          colorBorder: '#243244',
          colorBorderSecondary: '#1B2635',
          colorError: '#F26663',
          borderRadius: 10,
          fontSize: 14,
        },
        components: {
          // dark text on the bright primary button (white would fail contrast)
          Button: { primaryColor: '#08110D', fontWeight: 600 },
          Table: { headerBg: '#111823', rowHoverBg: '#16202E' },
          Tag: { defaultBg: '#16202E' },
        },
      }
    : {
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2DD4A7',
          colorLink: '#0B78C2',
          colorBgBase: '#FFFFFF',
          colorBgLayout: '#F4F6F9',
          colorBgContainer: '#FFFFFF',
          colorTextBase: '#17222D',
          colorTextSecondary: '#3D4C5A',
          colorTextDescription: '#3D4C5A',
          colorTextPlaceholder: '#75808C',
          colorBorder: '#D6DDE5',
          colorBorderSecondary: '#E4EAF0',
          colorError: '#B3261E', // AA on white (the antd default red is 4.37:1)
          borderRadius: 10,
          fontSize: 14,
        },
        components: {
          Button: { primaryColor: '#08110D', fontWeight: 600 },
          Table: { headerBg: '#F7F9FB', rowHoverBg: '#EEF2F6' },
          Tag: { defaultBg: '#EEF2F6' },
        },
      };

export const ThemeModeContext = createContext<{
  mode: ThemeMode;
  toggle: () => void;
}>({ mode: 'dark', toggle: () => {} });

// Second (and last) font family: monospace for technical accents only.
export const mono =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace";
