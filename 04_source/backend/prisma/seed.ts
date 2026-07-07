import { PrismaClient, Status } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.agent.deleteMany()
  const seeds = [
    { name: 'Code Reviewer', description: 'Automatically reviews pull requests.', status: Status.IDLE },
    { name: 'Task Optimizer', description: 'Prioritizes sprint backlog items.', status: Status.ACTIVE },
    { name: 'Log Analyzer', description: null, status: Status.PAUSED },
  ]
  for (const s of seeds) {
    await prisma.agent.create({ data: s })
  }
  console.log('Seed data inserted.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
