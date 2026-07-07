# ADR-001 — Full-Stack Technology & Runtime Choice

## Context
The project requires a fast feedback loop for rapid iteration during the NEW phase, with a clear path to production deployment without framework fragmentation.

## Decision
Adopt a unified Node.js runtime (v20) across frontend build tooling (Vite), backend API server (Express), and development toolchain. Pair with TypeScript throughout to enforce type safety from data model to UI components. Persist data using SQLite via Prisma ORM for local-first simplicity during development, with a documented migration path to Postgres for production.

## Consequences
- **Pros:** Single debug context, shared type definitions (via generated Prisma client / OpenAPI spec), faster local iteration, lower operational overhead during early stages.
- **Cons:** SQLite limits concurrent writes under heavy load; requires explicit configuration to switch storage drivers later. Requires careful version pinning to ensure Node 20 LTS compatibility across tooling.
- **Mitigation:** Prisma's provider flexibility abstracts the database driver. OpenAPI/DTO enforcement prevents backend/frontend contract drift. Production deployment will swap SQLite for Postgres via Docker without code changes.
