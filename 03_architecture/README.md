# 03_architecture/

The technical contract — API, data, and decisions — that the coder agents will implement against.

| Property | Value |
|---|---|
| **Goes here** | `openapi.yaml`, `schema.sql`, `ADRs/*.md`, `tech-stack.md` |
| **Produced by** | Architect Agent |
| **Consumed by** | Coder Agent (frontend + backend) |
| **Advances when** | `04_source/.status_done` is written |

## Files you'll see here

| File | Description |
|---|---|
| `openapi.yaml` | OpenAPI 3.1 spec. Every endpoint must use the same auth, error envelope, and versioning pattern (enforced by Validator). |
| `schema.sql` | Relational schema (PostgreSQL by default, per `.pipeline/config.yaml`). Naming + normalization rules in `../CODING_PATTERNS.md`. |
| `ADRs/NNNN-<slug>.md` | Architecture Decision Records — one per significant choice (PostgreSQL vs MongoDB, REST vs GraphQL, etc.) with the *why*. |
| `project-skeleton.md` | Directory layout strategy for `04_source/` — what the Coder Agent should scaffold. |

## Conventions

- ADRs use the [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Context → Decision → Consequences. Keep them short.
- Number ADRs sequentially: `0001-use-postgresql.md`, `0002-rest-over-graphql.md`.
- The `openapi.yaml` is the contract — frontend Coder Agent generates client types from it; backend generates server stubs.

## Empty?

Means the Architect Agent hasn't run yet. Run after Product Agent has written the Gherkin backlog in `../02_specs/`.
