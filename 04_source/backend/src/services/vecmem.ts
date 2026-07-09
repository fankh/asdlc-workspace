// Semantic run memory: sqlite-vec + local Ollama embeddings.
//
// Memory-enabled agents record each successful run as an embedded snippet;
// recall retrieves the runs most RELEVANT to the current task (vector KNN)
// rather than merely the most recent. Everything degrades gracefully — if the
// embedding model or vec store is unavailable, callers fall back to
// recency-based recall and runs are never failed by memory plumbing.
//
// Vectors live in their own SQLite file (vec.db, beside the Prisma DB) opened
// via better-sqlite3, so Prisma's connection/migrations stay untouched.

import path from 'node:path'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'

const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
const DIM = 768 // nomic-embed-text
const OVERFETCH = 32 // KNN k before filtering by agent (aux columns can't be MATCH-filtered)

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

function vecPath(): string {
  if (process.env.VEC_DB_PATH) return process.env.VEC_DB_PATH
  const raw = (process.env.DATABASE_URL || 'file:./dev.db').replace(/^file:/, '')
  const abs = path.isAbsolute(raw) ? raw : path.resolve('prisma', raw)
  return path.join(path.dirname(abs), 'vec.db')
}

let db: Database.Database | null = null
let disabled = false

function getDb(): Database.Database | null {
  if (db) return db
  if (disabled) return null
  try {
    db = new Database(vecPath())
    sqliteVec.load(db)
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS run_memory USING vec0(
      embedding FLOAT[${DIM}], +agent_id TEXT, +run_id TEXT, +snippet TEXT
    )`)
    return db
  } catch (e: any) {
    disabled = true // e.g. platform without a sqlite-vec build — recency fallback takes over
    console.error(`vecmem disabled: ${e?.message}`)
    return null
  }
}

export async function embed(text: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const v = data.embeddings?.[0]
    return Array.isArray(v) && v.length === DIM ? new Float32Array(v) : null
  } catch {
    return null
  }
}

export function memorySnippet(task: string, output: string): string {
  return `asked: ${oneLine(task).slice(0, 150)} -> did: ${oneLine(output).slice(0, 250)}`
}

// Record a successful run. Fire-and-forget: never throws.
export async function remember(agentId: string, runId: string, task: string, output: string): Promise<void> {
  try {
    const store = getDb()
    if (!store) return
    const snippet = memorySnippet(task, output)
    const v = await embed(snippet)
    if (!v) return
    store.prepare('INSERT INTO run_memory(embedding, agent_id, run_id, snippet) VALUES (?, ?, ?, ?)')
      .run(Buffer.from(v.buffer), agentId, runId, snippet)
  } catch (e: any) {
    console.error(`vecmem remember failed: ${e?.message}`)
  }
}

// Top-k runs most relevant to `query` for this agent, formatted for the
// prompt's recall block. Returns null when unavailable (callers fall back).
export async function semanticRecall(agentId: string, query: string, k = 3): Promise<string | null> {
  try {
    const store = getDb()
    if (!store) return null
    const v = await embed(query)
    if (!v) return null
    const rows = store.prepare(
      `SELECT agent_id, snippet, distance FROM run_memory
       WHERE embedding MATCH ? AND k = ? ORDER BY distance`,
    ).all(Buffer.from(v.buffer), OVERFETCH) as { agent_id: string; snippet: string; distance: number }[]
    const mine = rows.filter(r => r.agent_id === agentId).slice(0, k)
    if (!mine.length) return null
    return mine.map(r => `- ${r.snippet}`).join('\n')
  } catch (e: any) {
    console.error(`vecmem recall failed: ${e?.message}`)
    return null
  }
}

// Drop an agent's memories (called when the agent is deleted).
export function forget(agentId: string): void {
  try {
    getDb()?.prepare('DELETE FROM run_memory WHERE agent_id = ?').run(agentId)
  } catch { /* best-effort */ }
}
