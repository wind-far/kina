import { prisma } from '../server/db/prisma'

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  )
  console.log('TABLES')
  console.log(JSON.stringify(tables.map(item => item.table_name), null, 2))

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at'
    )
    console.log('MIGRATIONS')
    console.log(JSON.stringify(rows, null, 2))
  } catch {
    console.log('MIGRATIONS')
    console.log('NO_MIGRATIONS_TABLE')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
