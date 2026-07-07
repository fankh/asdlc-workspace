# Data Model

## Agent
Core entity mapping to `/api/agents` endpoints. No external relations required for initial backlog.

| Field       | Type     | Constraints & Defaults                          | Notes                                  |
|-------------|----------|-------------------------------------------------|----------------------------------------|
| `id`        | `String` | `@id`, `@default(uuid())`                       | Primary key, immutable.                |
| `name`      | `String` | `@unique`, required                             | Bound to form validation & UI label.   |
| `description`| `String?`| Optional, nullable                              | Truncated in list view if > 80 chars.  |
| `status`    | `Enum`   | `@default(STATUS_IDLE)`, values: `[IDLE, ACTIVE, PAUSED]` | Maps to Ant Design `<Tag color={...}>` |
| `createdAt` | `DateTime`| `@default(now())`                               | Indexed for list sorting.              |

### Migration Notes
- Prisma resolves SQLite types automatically (`UUID` → `TEXT(36)`, `DateTime` → `DATETIME`).
- No cascade deletes or soft deletes required per current Gherkin scope.
- Status enum values are lowercase in DTO responses to match UI copy requirements.
