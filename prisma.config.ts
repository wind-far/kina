import { loadPrismaEnv } from './prisma/load-env'
import { defineConfig } from 'prisma/config'

loadPrismaEnv()

// prisma generate 不需要真实数据库连接；为首次安装提供不可用的本地占位地址。
// 服务运行时仍由 server/db/prisma.ts 强制检查真实 DATABASE_URL。
const databaseUrl = String(process.env.DATABASE_URL || '').trim()
  || 'mysql://root:placeholder@127.0.0.1:3306/canana_mind'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
})
