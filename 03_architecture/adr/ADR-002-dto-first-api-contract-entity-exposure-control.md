# ADR-002: DTO-First API Contract & Entity Exposure Control
## Status: Accepted
## Context: Direct Prisma entity serialization risks leaking internal state, violating the anti-pattern rule "no direct entity exposure", and creating tight coupling between DB schema and UI contract.
## Decision: Define explicit DTO schemas in `openapi_yaml` components. Backend controllers must map Prisma results to plain objects before serialization. Error responses follow a unified `ErrorEnvelope` shape.
## Consequences:
- Database schema changes require only controller/mapper updates, not OpenAPI spec rewrites if DTOs remain stable.
- Enforces the `ValidationError → ErrorEnvelope` contract documented in CODING_PATTERNS §6.
- Prevents accidental exposure of Prisma internals (e.g., `_count`, relation fields) via strict TypeScript compilation on response objects.
