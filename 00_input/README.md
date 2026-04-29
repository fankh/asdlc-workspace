# 00_input/

Raw, human-supplied source material that kicks off the pipeline.

| Property | Value |
|---|---|
| **Goes here** | RFPs, HWP/DOCX specs, PDFs, requirement spreadsheets, screenshots of competitor UIs |
| **Produced by** | Humans (PM, customer, sales) |
| **Consumed by** | Document Parser → Ingestion Agent |
| **Advances when** | `01_requirements/.status_done` is written |

## Conventions

- One file per source document. Don't merge.
- Filename should hint at content: `rfp-acme-corp-2026-q2.pdf`, not `doc1.pdf`.
- HWP files are parsed natively; no need to convert to PDF first.
- If you have only verbal requirements, write them as a markdown file here — the Ingestion Agent will treat it as input the same way.

## Empty?

If this directory only has this README, the pipeline can't start. Either:

- Drop a real input file here, OR
- Run [`discovery-agent`](https://github.com/fankh/discovery-agent) against a live URL — it writes inferred tickets directly to `01_requirements/discovered/`, bypassing this phase.
