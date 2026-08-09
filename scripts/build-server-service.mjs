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
const postgresImportSourcePath = path.resolve(rootDir, 'scripts/database-migration/import-postgres.mjs')

// 生成后的服务启动脚本路径。
const startScriptPath = path.resolve(outputDir, 'start-production.mjs')

// 生产启动脚本由源码直接复制，避免构建脚本维护第二份易漂移实现。
const startScriptSourcePath = path.resolve(rootDir, 'scripts/start-production.mjs')

// 生成后的服务包描述文件路径。
const packageJsonPath = path.resolve(outputDir, 'package.json')

// 运行期真正需要的依赖清单。
const RUNTIME_DEPENDENCY_NAMES = [
  '@aws-sdk/client-s3',
  '@prisma/adapter-pg',
  '@prisma/client',
  'dotenv',
  // Redis 运行时由服务端直接导入，必须随独立服务包一起安装。
  'ioredis',
  'pg',
  'prisma',
  'sharp',
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
  await fs.mkdir(path.resolve(outputDir, 'database-migration'), { recursive: true })
  await fs.copyFile(postgresImportSourcePath, path.resolve(outputDir, 'database-migration/import-postgres.mjs'))

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
  await fs.copyFile(startScriptSourcePath, startScriptPath)
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
