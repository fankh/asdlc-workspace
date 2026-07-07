import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.agent.deleteMany()
  const seeds = [
    { name: 'Code Reviewer', description: 'Automatically reviews pull requests.', status: 'idle' },
    { name: 'Task Optimizer', description: 'Prioritizes sprint backlog items.', status: 'active' },
    { name: 'Log Analyzer', description: null, status: 'paused' },
  ]
  for (const s of seeds) {
    await prisma.agent.create({ data: s })
  }
  console.log('Seed data inserted.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
