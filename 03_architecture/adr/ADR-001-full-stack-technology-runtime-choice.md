# ADR-001: Full-Stack Technology & Runtime Choice
## Status: Accepted
## Context: The project requires rapid refinement loops, strict type safety across layers, and a lightweight local-first storage strategy before potential migration to PostgreSQL in deployment.
## Decision: 
- **Frontend:** React + TypeScript (Vite) for fast HMR and tree-shaking.
- **Backend:** Express + TypeScript (Node 20 LTS) for shared type generation with OpenAPI tooling.
- **Database:** SQLite via Prisma ORM for zero-config local development, transactional safety, and schema migration compatibility.
- **Contract:** REST over HTTP with OpenAPI 3.1 as the single source of truth for frontend API clients.
## Consequences:
- Zero config overhead; `npm run dev` starts full stack locally.
- Prisma provides runtime type generation (`prisma generate`) preventing DTO drift between backend and Vite client.
- SQLite limits concurrent write throughput but is fully sufficient for single-user B2B console use cases.
- REST + OpenAPI 3.1 simplifies codegen validation and avoids GraphQL complexity for linear CRUD workflows.
