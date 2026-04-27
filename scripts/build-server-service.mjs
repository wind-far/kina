import fs from 'node:fs/promises'
import path from 'node:path'
import { build as buildWithEsbuild } from 'esbuild'

// 统一读取项目根目录。
const rootDir = process.cwd()

// 后端服务构建输出目录。
const outputDir = path.resolve(rootDir, 'dist-service')

// 编译后的后端入口输出目录。
const serverOutputDir = path.resolve(outputDir, 'server')

// 后端服务 TypeScript 入口文件。
const serverEntryPath = path.resolve(rootDir, 'server/index.ts')

// 需要复制到服务包中的 Prisma 目录。
const prismaSourceDir = path.resolve(rootDir, 'prisma')

// Prisma CLI 配置文件路径。
const prismaConfigSourcePath = path.resolve(rootDir, 'prisma.config.ts')

// 生成后的服务启动脚本路径。
const startScriptPath = path.resolve(outputDir, 'start-production.mjs')

// 生成后的服务包描述文件路径。
const packageJsonPath = path.resolve(outputDir, 'package.json')

// 运行期真正需要的依赖清单。
const RUNTIME_DEPENDENCY_NAMES = [
  '@aws-sdk/client-s3',
  '@prisma/adapter-mariadb',
  '@prisma/client',
  'dotenv',
  'prisma',
]

// 读取根目录 package.json，复用版本声明。
const readRootPackageJson = async () => {
  const packageJsonFile = path.resolve(rootDir, 'package.json')
  const content = await fs.readFile(packageJsonFile, 'utf8')
  return JSON.parse(content)
}

// 仅挑选后端服务运行时所需依赖，避免把前端依赖装到服务器。
const pickRuntimeDependencies = (packageJson) => {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  return RUNTIME_DEPENDENCY_NAMES.reduce((result, dependencyName) => {
    const version = dependencies[dependencyName] || devDependencies[dependencyName]

    if (!version) {
      throw new Error(`缺少后端服务依赖版本声明：${dependencyName}`)
    }

    result[dependencyName] = version
    return result
  }, {})
}

// 生成独立后端服务的 package.json。
const createServicePackageJson = (packageJson) => ({
  name: `${packageJson.name}-server-service`,
  private: true,
  version: packageJson.version,
  description: 'CanvasMind 独立后端服务运行包',
  type: 'module',
  engines: packageJson.engines,
  scripts: {
    start: 'node start-production.mjs',
    'start:server': 'node server/index.js',
    'prisma:migrate:deploy': 'prisma migrate deploy',
  },
  dependencies: pickRuntimeDependencies(packageJson),
})

// 生成服务启动脚本，启动前先执行 Prisma 迁移。
const createStartScript = () => [
  "import fs from 'node:fs/promises'",
  "import path from 'node:path'",
  "import { spawn } from 'node:child_process'",
  '',
  '// 以继承标准输入输出的方式运行命令。',
  'const runCommand = (command, args) => {',
  '  return new Promise((resolve, reject) => {',
  '    // 启动子进程并透传日志到当前终端。',
  '    const child = spawn(command, args, {',
  "      stdio: 'inherit',",
  "      shell: process.platform === 'win32',",
  '      env: process.env,',
  '    })',
  '',
  '    // 监听命令执行失败场景。',
  "    child.on('error', reject)",
  '',
  '    // 根据退出码判断命令是否成功。',
  "    child.on('close', (code) => {",
  '      if (code === 0) {',
  '        resolve()',
  '        return',
  '      }',
  '',
  "      reject(new Error(`${command} ${args.join(' ')} 执行失败，退出码: ${code}`))",
  '    })',
  '  })',
  '}',
  '',
  '// 判断生产环境配置文件是否存在。',
  'const hasProductionEnvFile = async () => {',
  '  try {',
  "    await fs.access(path.resolve(process.cwd(), '.env.production'))",
  '    return true',
  '  } catch {',
  '    return false',
  '  }',
  '}',
  '',
  '// 启动生产环境应用。',
  'const start = async () => {',
  '  // 先执行数据库迁移，确保表结构已就绪。',
  "  await runCommand('npx', ['prisma', 'migrate', 'deploy'])",
  '',
  '  // 根据运行环境决定是否显式加载 .env.production。',
  '  const serverArgs = await hasProductionEnvFile()',
  "    ? ['--env-file=.env.production', 'server/index.js']",
  "    : ['server/index.js']",
  '',
  '  // 再启动正式后端服务，由后端统一承载 API 与静态前端。',
  "  await runCommand('node', serverArgs)",
  '}',
  '',
  '// 执行启动流程，并在失败时返回非零退出码。',
  'start().catch((error) => {',
  '  // 输出启动失败原因，便于排查部署问题。',
  "  console.error('[start-production] 启动失败', error)",
  '  process.exit(1)',
  '})',
  '',
].join('\n')

// 确保输出目录为干净状态。
const prepareOutputDir = async () => {
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(serverOutputDir, { recursive: true })
}

// 将后端源码编译为单入口 JS，运行期仅保留真正需要的 node_modules 依赖。
const buildServerBundle = async () => {
  await buildWithEsbuild({
    entryPoints: [serverEntryPath],
    outfile: path.resolve(serverOutputDir, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    packages: 'external',
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'info',
  })
}

// 复制运行时所需的 Prisma 目录和配置文件。
const copyRuntimeFiles = async () => {
  await fs.cp(prismaSourceDir, path.resolve(outputDir, 'prisma'), { recursive: true })

  // Prisma 7 运行命令优先读取 prisma.config.ts，这里一并带入服务包。
  try {
    await fs.cp(prismaConfigSourcePath, path.resolve(outputDir, 'prisma.config.ts'))
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error
    }
  }
}

// 写入服务包的 package.json 与启动脚本。
const writeRuntimeMetaFiles = async (packageJson) => {
  const servicePackageJson = createServicePackageJson(packageJson)
  await fs.writeFile(packageJsonPath, `${JSON.stringify(servicePackageJson, null, 2)}\n`, 'utf8')
  await fs.writeFile(startScriptPath, createStartScript(), 'utf8')
}

// 执行服务打包。
const build = async () => {
  const packageJson = await readRootPackageJson()

  await prepareOutputDir()
  await buildServerBundle()
  await copyRuntimeFiles()
  await writeRuntimeMetaFiles(packageJson)

  console.log('[build-server-service] 后端服务运行包已生成:', outputDir)
}

build().catch((error) => {
  console.error('[build-server-service] 构建失败', error)
  process.exit(1)
})
