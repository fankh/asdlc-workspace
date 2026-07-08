import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.agent.deleteMany()
  const seeds = [
    { name: 'Code Reviewer', description: 'Automatically reviews pull requests.', status: 'idle' },
    { name: 'Task Optimizer', description: 'Prioritizes sprint backlog items.', status: 'active' },
    { name: 'Log Analyzer', description: null, status: 'paused' },
    { name: 'Backup Runner', description: 'Runs nightly database and file backups.', status: 'active' },
    { name: 'Dependency Auditor', description: 'Scans dependencies for known vulnerabilities.', status: 'idle' },
    { name: 'Deploy Bot', description: 'Handles staging and production deployments.', status: 'active' },
    { name: 'Metric Collector', description: 'Gathers host and app metrics every minute.', status: 'active' },
    { name: 'Cert Renewer', description: 'Renews TLS certificates before expiry.', status: 'idle' },
    { name: 'Cleanup Worker', description: 'Purges temp files and stale artifacts.', status: 'paused' },
    { name: 'Alert Router', description: 'Routes alerts to the on-call channel.', status: 'active' },
    { name: 'Doc Indexer', description: 'Indexes internal docs for search.', status: 'idle' },
    { name: 'Uptime Monitor', description: 'Pings critical endpoints and records status.', status: 'active' },
  ]
  for (const s of seeds) {
    await prisma.agent.create({ data: s })
  }
  console.log(`Seed data inserted (${seeds.length} agents).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
