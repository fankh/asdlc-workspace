"""Backend coder agent: OpenAPI spec -> Express+TS+Prisma+SQLite service.

Framework-pluggable: the prompt template is selected by
config.yaml agents.coder.backend.framework (only "express" is implemented;
adding spring-boot later means adding a template, not rewriting the agent).
Scaffold (package.json, tsconfig) is deterministic; the LLM generates the
Prisma schema, app wiring, routes, and seed script from the OpenAPI contract.
"""

from __future__ import annotations

import json

from . import register
from .base import FILES_SCHEMA, Agent, AgentResult

BACKEND = "04_source/backend"
DEV_PORT = 3001

EXPRESS_PROMPT = f"""You are the backend Coder agent in an automated software
delivery pipeline. The build scaffold already exists — Express 4 + TypeScript
(run with tsx), Prisma + SQLite (DATABASE_URL="file:./dev.db"), zod, cors.
The server must listen on port {DEV_PORT} (or process.env.PORT).

Generate ONLY these files, paths relative to the backend root:
- prisma/schema.prisma implementing the data model (SQLite provider,
  DATABASE_URL from env).
- prisma/seed.ts inserting a small set of realistic seed rows.
- src/app.ts building the Express app: json body parser, cors, routes mounted
  under /api exactly as in the OpenAPI spec, error middleware implementing the
  error envelope from CODING_PATTERNS.md, and GET /api/health returning
  {{"status":"ok"}}.
- src/index.ts starting the server (import app from './app').
- src/routes/*.ts + src/services/*.ts per resource: validate request bodies
  with zod (DTOs, never raw Prisma entities in responses), correct status
  codes per the OpenAPI spec.
Every OpenAPI path must be implemented. No placeholder TODOs — complete,
compiling code. In `notes`, list the npm commands needed before first run."""

SPRING_PROMPT = None  # not implemented; config selects express for this project


PACKAGE_JSON = {
    "name": "backend",
    "version": "0.1.0",
    "private": True,
    "scripts": {
        "dev": "tsx watch src/index.ts",
        "start": "tsx src/index.ts",
        "build": "tsc -b",
        "db:push": "prisma db push",
        "db:seed": "tsx prisma/seed.ts",
        "test": "vitest run",
    },
    "prisma": {"seed": "tsx prisma/seed.ts"},
    "dependencies": {
        "@prisma/client": "^5.20.0",
        "cors": "^2.8.5",
        "express": "^4.21.0",
        "zod": "^3.23.0",
    },
    "devDependencies": {
        "@types/cors": "^2.8.17",
        "@types/express": "^4.17.21",
        "@types/node": "^20.16.0",
        "prisma": "^5.20.0",
        "tsx": "^4.19.0",
        "typescript": "^5.5.0",
        "vitest": "^2.1.0",
    },
}

TSCONFIG = """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "prisma"]
}
"""

ENV_FILE = 'DATABASE_URL="file:./dev.db"\nPORT=3001\n'


@register("coder_backend")
class BackendCoderAgent(Agent):
    extra_write_roots = (BACKEND,)

    def run(self) -> AgentResult:
        framework = (
            self.ctx.config.agents.get("coder", {})
            .get("backend", {})
            .get("framework", "express")
        )
        if framework != "express":
            return AgentResult(ok=False, summary=f"backend framework '{framework}' has "
                               "no prompt template yet (implemented: express)")

        root = self.ctx.root
        openapi = root / "03_architecture" / "openapi.yaml"
        if not openapi.exists():
            return AgentResult(ok=False, summary="03_architecture/openapi.yaml missing")
        data_model = root / "03_architecture" / "DATA_MODEL.md"

        user = f"# OpenAPI contract\n\n{openapi.read_text(encoding='utf-8')}"
        if data_model.exists():
            user += f"\n\n# Data model\n\n{data_model.read_text(encoding='utf-8')}"

        result = self.ctx.llm.complete(
            system=self.system_blocks(EXPRESS_PROMPT),
            user=user,
            schema=FILES_SCHEMA,
            max_tokens=32000,
        )
        files = result.parsed["files"]
        required = ("schema.prisma", "app.ts", "index.ts")
        missing = [name for name in required
                   if not any(f["path"].endswith(name) for f in files)]
        if missing:
            return AgentResult(ok=False, usage=result.usage,
                               summary=f"LLM output missing required file(s): {missing}")

        self.write_file(f"{BACKEND}/package.json", json.dumps(PACKAGE_JSON, indent=2) + "\n")
        self.write_file(f"{BACKEND}/tsconfig.json", TSCONFIG)
        self.write_file(f"{BACKEND}/.env", ENV_FILE)
        for entry in files:
            rel = entry["path"].lstrip("/").removeprefix("04_source/backend/")
            self.write_file(f"{BACKEND}/{rel}", entry["content"].rstrip() + "\n")

        return AgentResult(
            ok=True, usage=result.usage,
            summary=f"scaffold + {len(files)} generated file(s) (express)",
            details={"notes": result.parsed["notes"]},
        )
