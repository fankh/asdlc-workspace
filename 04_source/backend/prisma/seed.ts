import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // idempotent: only seed an empty DB so restarts never wipe existing agents
  const existing = await prisma.agent.count()
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} agents already present.`)
    return
  }
  // skills is comma-separated in storage (DTO exposes string[])
  const seeds = [
    { name: 'Code Reviewer', description: 'Automatically reviews pull requests.', status: 'idle', role: 'Reviewer', persona: 'Meticulous senior engineer, concise and direct.', skills: 'code-review,static-analysis,style-linting', gender: 'non-binary', importance: 'high', model: 'claude-opus-4-8', goal: 'Catch defects and style issues before merge.' },
    { name: 'Task Optimizer', description: 'Prioritizes sprint backlog items.', status: 'active', role: 'Planner', persona: 'Pragmatic product-minded strategist.', skills: 'prioritization,estimation,scheduling', gender: 'female', importance: 'medium', model: 'claude-sonnet-4-6', goal: 'Maximize sprint value within capacity.' },
    { name: 'Log Analyzer', description: null, status: 'paused', role: 'Analyst', persona: 'Calm forensic investigator.', skills: 'log-parsing,anomaly-detection,correlation', gender: 'male', importance: 'high', model: 'qwen3.6', goal: 'Surface anomalies from raw logs.' },
    { name: 'Backup Runner', description: 'Runs nightly database and file backups.', status: 'active', role: 'Operator', persona: 'Dependable, by-the-book.', skills: 'backup,scheduling,storage', gender: 'unspecified', importance: 'critical', model: 'llama3', goal: 'Guarantee recoverable nightly backups.' },
    { name: 'Dependency Auditor', description: 'Scans dependencies for known vulnerabilities.', status: 'idle', role: 'Security', persona: 'Skeptical, risk-averse auditor.', skills: 'sca,cve-matching,sbom', gender: 'female', importance: 'high', model: 'claude-opus-4-8', goal: 'Keep the dependency tree free of known CVEs.' },
    { name: 'Deploy Bot', description: 'Handles staging and production deployments.', status: 'active', role: 'Release', persona: 'Careful, checklist-driven.', skills: 'ci-cd,rollout,rollback', gender: 'non-binary', importance: 'critical', model: 'claude-sonnet-4-6', goal: 'Ship safely with fast rollback.' },
    { name: 'Metric Collector', description: 'Gathers host and app metrics every minute.', status: 'active', role: 'Telemetry', persona: 'Quiet and constant.', skills: 'metrics,scraping,aggregation', gender: 'unspecified', importance: 'medium', model: 'qwen3.6', goal: 'Provide accurate real-time metrics.' },
    { name: 'Cert Renewer', description: 'Renews TLS certificates before expiry.', status: 'idle', role: 'Operator', persona: 'Punctual and precise.', skills: 'tls,acme,automation', gender: 'male', importance: 'high', model: 'llama3', goal: 'Never let a certificate expire.' },
    { name: 'Cleanup Worker', description: 'Purges temp files and stale artifacts.', status: 'paused', role: 'Maintenance', persona: 'Tidy minimalist.', skills: 'gc,retention-policy,disk-mgmt', gender: 'unspecified', importance: 'low', model: 'qwen3.6', goal: 'Reclaim disk from stale artifacts.' },
    { name: 'Alert Router', description: 'Routes alerts to the on-call channel.', status: 'active', role: 'Notifier', persona: 'Urgent but not noisy.', skills: 'routing,dedup,escalation', gender: 'female', importance: 'critical', model: 'claude-sonnet-4-6', goal: 'Get the right alert to the right person fast.' },
    { name: 'Doc Indexer', description: 'Indexes internal docs for search.', status: 'idle', role: 'Librarian', persona: 'Organized and thorough.', skills: 'embeddings,indexing,search', gender: 'non-binary', importance: 'medium', model: 'claude-opus-4-8', goal: 'Make internal knowledge instantly searchable.' },
    { name: 'Uptime Monitor', description: 'Pings critical endpoints and records status.', status: 'active', role: 'Watchdog', persona: 'Ever-vigilant sentinel.', skills: 'health-checks,synthetics,sla', gender: 'male', importance: 'high', model: 'llama3', goal: 'Detect outages within seconds.' },
  ]
  for (const s of seeds) {
    await prisma.agent.create({ data: s })
  }
  console.log(`Seed data inserted (${seeds.length} agents).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
