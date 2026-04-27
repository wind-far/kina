import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

// 以继承标准输入输出的方式运行命令。
const runCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    // 启动子进程并透传日志到当前终端。
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    })

    // 监听命令执行失败场景。
    child.on('error', reject)

    // 根据退出码判断命令是否成功。
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} 执行失败，退出码: ${code}`))
    })
  })
}

// 判断生产环境配置文件是否存在。
const hasProductionEnvFile = async () => {
  try {
    await fs.access(path.resolve(process.cwd(), '.env.production'))
    return true
  } catch {
    return false
  }
}

// 启动生产环境应用。
const start = async () => {
  // 先执行数据库迁移，确保表结构已就绪。
  await runCommand('npx', ['prisma', 'migrate', 'deploy'])

  // 根据运行环境决定是否显式加载 .env.production。
  const serverArgs = await hasProductionEnvFile()
    ? ['--env-file=.env.production', 'dist-service/server/index.js']
    : ['dist-service/server/index.js']

  // 再启动正式后端服务，由后端统一承载 API 与静态前端。
  await runCommand('node', serverArgs)
}

// 执行启动流程，并在失败时返回非零退出码。
start().catch((error) => {
  // 输出启动失败原因，便于排查部署问题。
  console.error('[start-production] 启动失败', error)
  process.exit(1)
})
