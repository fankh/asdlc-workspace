"""Frontend coder agent: UI specs + OpenAPI -> Vite+React+TS+AntD app.

The build scaffold (package.json, configs, entry point) is deterministic —
pinned versions, port 3000 to match the Playwright oracle, /api proxy to the
backend. The LLM generates only feature code (App, pages, api client),
returned via the FILES_SCHEMA protocol and sandboxed to 04_source/frontend.
"""

from __future__ import annotations

import json

from . import register
from .base import FILES_SCHEMA, Agent, AgentResult

FRONTEND = "04_source/frontend"
BACKEND_DEV_PORT = 3001

PROMPT = """You are the frontend Coder agent in an automated software delivery
pipeline. The build scaffold already exists — Vite + React 18 + TypeScript +
Ant Design 5 + react-router-dom 6, dev server on port 3000, `/api/*` proxied
to the backend. Entry point `src/main.tsx` renders `<App />` from `src/App.tsx`
inside BrowserRouter and Ant ConfigProvider (do NOT generate main.tsx).

Generate ONLY the feature source files, paths relative to the frontend root
(e.g. "src/App.tsx", "src/pages/HomePage.tsx", "src/api/client.ts"):
- src/App.tsx with the route table.
- One page component per screen in the UI specs.
- A typed API client wrapping fetch per the OpenAPI spec and the error
  handling pattern in CODING_PATTERNS.md.
Rules (enforced by the validator): Ant Design components and tokens only, no
inline styles, no hex colors, no !important, visible copy must match the
Gherkin steps VERBATIM (headings, button labels, URLs). Use semantic HTML
inside Ant components so axe-core passes (one h1 per page, labelled inputs).
In `notes`, list anything the backend must provide."""


# -- deterministic scaffold -------------------------------------------------

PACKAGE_JSON = {
    "name": "frontend",
    "version": "0.1.0",
    "private": True,
    "scripts": {
        "dev": "vite --port 3000 --strictPort",
        "build": "tsc -b && vite build",
        "preview": "vite preview --port 3000 --strictPort",
        "test:e2e": "playwright test",
        "test:e2e:ui": "playwright test --ui",
    },
    "dependencies": {
        "antd": "^5.21.0",
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.0",
    },
    "devDependencies": {
        "@axe-core/playwright": "^4.9.0",
        "@playwright/test": "^1.48.0",
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.0",
        "typescript": "^5.5.0",
        "vite": "^5.4.0",
    },
}

VITE_CONFIG = f"""import react from '@vitejs/plugin-react';
import {{ defineConfig }} from 'vite';

export default defineConfig({{
  plugins: [react()],
  server: {{
    port: 3000,
    strictPort: true,
    proxy: {{
      '/api': 'http://localhost:{BACKEND_DEV_PORT}',
    }},
  }},
}});
"""

TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
"""

INDEX_HTML = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Local Agent App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"""

PLAYWRIGHT_CONFIG = """import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../../05_test_reports/playwright', open: 'never' }],
    ['json', { outputFile: '../../05_test_reports/results.json' }],
    ['junit', { outputFile: '../../05_test_reports/junit.xml' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: process.env.NO_WEB_SERVER
    ? undefined
    : [
        {
          command: 'npm run dev',
          cwd: '../backend',
          url: 'http://localhost:3001/api/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
"""

MAIN_TSX = """import { ConfigProvider } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
"""


@register("coder_frontend")
class FrontendCoderAgent(Agent):
    extra_write_roots = (FRONTEND,)

    def run(self) -> AgentResult:
        root = self.ctx.root
        context_parts = [
            ("Product backlog", root / "02_specs" / "PRODUCT_BACKLOG.md"),
            ("OpenAPI spec", root / "03_architecture" / "openapi.yaml"),
        ]
        user_parts = []
        for label, path in context_parts:
            if path.exists():
                user_parts.append(f"# {label}\n\n{path.read_text(encoding='utf-8')}")
        for spec in sorted((root / "03_architecture" / "ui").glob("*.md")):
            user_parts.append(f"# UI spec {spec.name}\n\n{spec.read_text(encoding='utf-8')}")
        if not user_parts:
            return AgentResult(ok=False, summary="no backlog/specs to implement")

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user="\n\n---\n\n".join(user_parts),
            schema=FILES_SCHEMA,
            max_tokens=32000,
        )
        files = result.parsed["files"]
        if not any(f["path"].endswith("App.tsx") for f in files):
            return AgentResult(ok=False, usage=result.usage,
                               summary="LLM output missing src/App.tsx")

        self._write_scaffold()
        for entry in files:
            rel = entry["path"].lstrip("/").removeprefix("04_source/frontend/")
            self.write_file(f"{FRONTEND}/{rel}", entry["content"].rstrip() + "\n")

        return AgentResult(
            ok=True, usage=result.usage,
            summary=f"scaffold + {len(files)} generated file(s)",
            details={"notes": result.parsed["notes"]},
        )

    def _write_scaffold(self) -> None:
        self.write_file(f"{FRONTEND}/package.json",
                        json.dumps(PACKAGE_JSON, indent=2) + "\n")
        self.write_file(f"{FRONTEND}/vite.config.ts", VITE_CONFIG)
        self.write_file(f"{FRONTEND}/playwright.config.ts", PLAYWRIGHT_CONFIG)
        self.write_file(f"{FRONTEND}/tsconfig.json", TSCONFIG)
        self.write_file(f"{FRONTEND}/index.html", INDEX_HTML)
        self.write_file(f"{FRONTEND}/src/main.tsx", MAIN_TSX)
