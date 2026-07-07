import { theme, type ThemeConfig } from 'antd';

// Dark "agent ops console" theme. All colors live here (no hex in components).
// Every text/background pair below clears WCAG AA 4.5:1 — verified by the
// axe-core scenarios in e2e/.
export const appTheme: ThemeConfig = {
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
};

// Second (and last) font family: monospace for technical accents only.
export const mono =
  "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace";
