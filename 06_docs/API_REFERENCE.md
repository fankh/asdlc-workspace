# API Reference

## Protocol & Content Negotiation
All endpoints operate over HTTP/1.1 or HTTP/2. Clients must set `Content-Type: application/json` for POST requests.

## Endpoints

### List Agents
Retrieves all registered agents.

- **Method:** `GET`
- **Path:** `/api/agents`
- **Response (200):** Array of `Agent` objects.

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Data Processor Agent",
    "description": "Processes incoming CSV files",
    "status": "active",
    "createdAt": "2023-10-25T14:30:00Z"
  }
]
```

### Create Agent
Registers a new agent record. Returns the created resource and `Location` header.

- **Method:** `POST`
- **Path:** `/api/agents`
- **Request Body:** `CreateAgentRequest`
- **Response (201):** Created `Agent` object + `Location` header.

```http
POST /api/agents HTTP/1.1
Content-Type: application/json

{
  "name": "Log Watcher",
  "description": "Monitors system logs for errors"
}
```

```http
HTTP/1.1 201 Created
Location: /api/agents/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Log Watcher",
  "description": "Monitors system logs for errors",
  "status": "idle",
  "createdAt": "2023-10-26T09:15:00Z"
}
```

### Delete Agent
Removes an agent by UUID. Returns `204 No Content` on success.

- **Method:** `DELETE`
- **Path:** `/api/agents/{agentId}`
- **Parameters:** `agentId` (string, format: uuid) — required path parameter.
- **Response (204):** Empty body.

```http
DELETE /api/agents/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

```http
HTTP/1.1 204 No Content
```

## Error Envelope
All failures return a unified JSON payload matching the `ErrorEnvelope` schema. Use HTTP semantics (`400` for validation, `404` for missing entities, `500` for server faults). Never expect raw stack traces.

- **Structure:**
```json
{
  "code": "VALIDATION_FAILED",
  "message": "Agent name is required."
}
```
- **Behavior Rules:**
  - Validation failures (`400`) include a machine-readable `code` and human-readable `message`.
  - Missing entities (`404`) return the same envelope with `"code": "NOT_FOUND"`.
  - Unhandled server faults (`500`) return `"code": "INTERNAL_ERROR"` and a generic message.
- **Examples:**
```json
{"code": "VALIDATION_FAILED", "message": "name is a required field."}
{"code": "NOT_FOUND", "message": "Agent with specified ID does not exist."}
{"code": "INTERNAL_ERROR", "message": "An unexpected error occurred. Please try again."}
```
