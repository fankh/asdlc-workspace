# Data Model

## Model: `Agent`
Represents a registered agent instance managed by the application. Maps directly to the `Agent` DTO schema.

| Field | Prisma Type | Default | Description |
|---|---|---|---|
| `id` | String | Auto-generated UUID (`@default(uuid())`) | Primary key, immutable identifier |
| `name` | String | Required | Display name for the agent (validated on create) |
| `description` | String? | `null` | Optional contextual details about the agent |
| `status` | AgentStatus | `IDLE` (`@default(IDLE)`) | Current lifecycle state (`IDLE`, `ACTIVE`, `PAUSED`) |
| `createdAt` | DateTime | Creation timestamp (`@default(now())`) | UTC datetime when the record was persisted |

### Enum: `AgentStatus`
Values: `IDLE`, `ACTIVE`, `PAUSED`. Controls UI rendering in the status column and client-side filter dropdown. Defaults to `IDLE` on creation per STORY-002 acceptance criteria.

### Relations
Single-table domain for this phase. No foreign keys or cascade rules required.
