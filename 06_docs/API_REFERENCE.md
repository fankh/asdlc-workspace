# api_reference

Base URL: `http://localhost:3001/api`

## Endpoints

### GET /api/agents
Retrieve all registered agents.

**Request**
No body required. Include standard headers if needed for authentication or content negotiation.

**Response 200 OK**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "DataProcessor",
    "description": "Batch ETL pipeline orchestrator",
    "status": "active",
    "createdAt": "2024-05-12T09:15:00Z"
  }
]
```

**Response Default (Error Envelope)**
See `ErrorEnvelope` schema. Returns `4xx` or `5xx` status with unified JSON payload.

---

### POST /api/agents
Register a new agent.

**Request Body**
```json
{
  "name": "DataProcessor",
  "description": "Batch ETL pipeline orchestrator"
}
```
- `name`: Required string. Minimum length 1.
- `description`: Optional string. Maximum length 500. Nullable.

**Response 201 Created**
Returns the persisted agent DTO and a `Location` header pointing to the new resource.
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "DataProcessor",
  "description": "Batch ETL pipeline orchestrator",
  "status": "idle",
  "createdAt": "2024-05-12T09:15:00Z"
}
```

**Response Default (Error Envelope)**
Returns `400` on validation failure.
```json
{
  "code": "VALIDATION_FAILED",
  "message": "Agent name is required."
}
```

---

### DELETE /api/agents/{agentId}
Remove an agent by ID.

**Path Parameters**
- `agentId`: string (UUID format). Required.

**Response 204 No Content**
Empty body on successful deletion.

**Response Default (Error Envelope)**
Returns `404` if the agent does not exist, or `4xx/5xx` on internal failures.
```json
{
  "code": "NOT_FOUND",
  "message": "Agent with the specified ID was not found."
}
```

---

## Schemas & Error Handling

### Agent
Serialized DTO bound to UI fields.
```json
{
  "id": "string (UUID)",
  "name": "string",
  "description": "string | null",
  "status": "idle | active | paused",
  "createdAt": "string (ISO 8601 date-time)"
}
```

### ErrorEnvelope
Standardized payload for all API failures.
```json
{
  "code": "VALIDATION_FAILED",
  "message": "Human-readable explanation of the failure."
}
```
- `code`: Machine-readable identifier (e.g., `VALIDATION_FAILED`, `NOT_FOUND`).
- `message`: User-facing description. Never contains stack traces or internal field names.
