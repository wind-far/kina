import { loadPrismaEnv } from './prisma/load-env'
import { defineConfig } from 'prisma/config'

loadPrismaEnv()

// prisma generate 不需要真实数据库连接；为首次安装提供不可用的本地占位地址。
// 服务运行时仍由 server/db/prisma.ts 强制检查真实 DATABASE_URL。
const databaseUrl = String(process.env.DATABASE_URL || '').trim()
  || 'postgresql://canvasmind:placeholder@127.0.0.1:5432/canvasmind'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // 旧 MySQL 迁移保留在 prisma/migrations 作为审计档案；生产只执行 PostgreSQL 基线与后续迁移。
    path: 'prisma/migrations-postgresql',
  },
  datasource: {
    url: databaseUrl,
  },
})
