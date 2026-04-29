# 01_requirements/

Structured, machine-readable requirements derived from `00_input/` or live discovery.

| Property | Value |
|---|---|
| **Goes here** | `REQ_DATA.json`, `TASK-BREAKDOWN.json`, `discovered/` (from discovery-agent) |
| **Produced by** | Ingestion Agent, Requirements Analyzer Agent, discovery-agent |
| **Consumed by** | Product Agent (writes the Gherkin backlog from these) |
| **Advances when** | `02_specs/.status_done` is written |

## Files you'll see here

| File | Origin | Schema |
|---|---|---|
| `RAW-PARSED-<filename>.json` | Document Parser | Per-source-file parse tree (sections, tables, metadata) |
| `REQ_DATA.json` | Ingestion Agent | Functional + non-functional requirements |
| `TASK-BREAKDOWN.json` | Requirements Analyzer | Decomposed tasks with dependencies, complexity, gaps |
| `discovered/` | discovery-agent | Inferred tickets from a live URL — see subdirectory README |

## The `discovered/` subdirectory

Populated by [discovery-agent](https://github.com/fankh/discovery-agent) when you crawl an existing app instead of starting from a doc. Layout:

```
discovered/
├── tickets/TICKET-NNN.md       # one Gherkin-bound ticket per UI behaviour
├── screenshots/*.png           # what the agent saw
├── inventory.json              # raw DOM extract per page
└── SUMMARY.md                  # index + per-page rollup
```

The Product Agent merges these into `02_specs/PRODUCT_BACKLOG.md` after human review — discovery-agent is not authoritative; it's a draft generator.

## Empty?

Means the Ingestion Agent hasn't run yet, or you haven't run discovery-agent. Both paths lead here.
