import { prisma } from '../db/prisma'
import { createHash } from 'node:crypto'
import { lookup as lookupHostname } from 'node:dns/promises'
import { isIP } from 'node:net'
import { deleteUploadedStorageFile, saveUploadedBuffer, type StoredUploadReference } from '../storage/service'

const normalizeSlug = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
const MAX_PLUGIN_PACKAGE_BYTES = 2 * 1024 * 1024

const isPrivateOrReservedIp = (address: string) => {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number)
    return first === 0 || first === 10 || first === 127 || first >= 224
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 198 && (second === 18 || second === 19))
      || (first === 192 && second === 0)
      || (first === 198 && second === 51)
      || (first === 203 && second === 0)
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase()
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')
  }
  return true
}

const configuredRegistryHosts = (environment: NodeJS.ProcessEnv) => new Set(
  String(environment.CANVAS_PLUGIN_REGISTRY_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean),
)

/** 仅接受显式配置的可信注册表域名，且拒绝解析到内网的地址。 */
export const assertTrustedCanvasPluginPackageUrl = async (
  value: unknown,
  options: {
    environment?: NodeJS.ProcessEnv
    resolveHostname?: (host: string) => Promise<Array<{ address: string }>>
  } = {},
) => {
  const raw = String(value || '').trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('插件包地址无效')
  }
  if (url.protocol !== 'https:') throw new Error('插件包地址必须使用 HTTPS')
  if (url.username || url.password || url.port) throw new Error('插件包地址不能包含认证信息或自定义端口')
  if (isIP(url.hostname)) throw new Error('插件包地址必须使用受信注册表域名，不能直接使用 IP')
  const allowedHosts = configuredRegistryHosts(options.environment || process.env)
  if (!allowedHosts.size) throw new Error('未配置受信插件注册表域名（CANVAS_PLUGIN_REGISTRY_HOSTS）')
  if (!allowedHosts.has(url.hostname.toLowerCase())) throw new Error('插件包地址不属于受信注册表域名')
  const resolved = await (options.resolveHostname || (host => lookupHostname(host, { all: true, verbatim: true })))(url.hostname)
  if (!resolved.length || resolved.some(item => isPrivateOrReservedIp(item.address))) {
    throw new Error('插件包地址解析到了受限网络地址')
  }
  return url.href
}
const assertIntegrity = (value: unknown) => {
  const hash = String(value || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('插件必须提供 64 位 SHA-256 完整性值')
  return hash
}

const SUPPORTED_CANVAS_PLUGIN_CAPABILITIES = new Set([
  'canvas.read', 'canvas.propose', 'nodes', 'inspector', 'toolbar',
  'serialization', 'migration', 'generation',
])

/** 管理员注册表只接受明确且可审计的能力声明，未知能力不会进入运行时。 */
export const normalizeCanvasPluginManifest = (value: unknown) => {
  const manifest = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const entry = String(manifest.entry || '').trim().slice(0, 500)
  if (!entry) throw new Error('插件 manifest 必须声明 entry')
  const rawCapabilities = manifest.capabilities === undefined ? [] : manifest.capabilities
  if (!Array.isArray(rawCapabilities) || rawCapabilities.length > SUPPORTED_CANVAS_PLUGIN_CAPABILITIES.size) {
    throw new Error('插件 manifest capabilities 格式不合法')
  }
  const capabilities = [...new Set(rawCapabilities.map(item => String(item || '').trim()))]
  if (capabilities.some(capability => !SUPPORTED_CANVAS_PLUGIN_CAPABILITIES.has(capability))) {
    throw new Error('插件 manifest 包含不受支持的能力')
  }
  return { ...manifest, entry, capabilities }
}

type PluginPackageResponse = {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null
  arrayBuffer(): Promise<ArrayBuffer>
}

/** 下载大小受限的 HTML 插件入口，并在落盘前确认管理员登记的 SHA-256。 */
export const downloadAndVerifyCanvasPluginPackage = async (
  packageUrl: string,
  integritySha256: string,
  fetchImpl: (url: string, init: RequestInit) => Promise<PluginPackageResponse> = fetch as any,
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(packageUrl, { redirect: 'error', signal: controller.signal })
    if (!response.ok) throw new Error(`插件包下载失败（HTTP ${response.status}）`)
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('text/html')) throw new Error('插件包必须是 text/html 入口文件')
    const contentLength = Number(response.headers.get('content-length') || '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_PLUGIN_PACKAGE_BYTES) throw new Error('插件包超过 2MB 限制')
    const chunks: Buffer[] = []
    let size = 0
    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        size += value.byteLength
        if (size > MAX_PLUGIN_PACKAGE_BYTES) throw new Error('插件包超过 2MB 限制')
        chunks.push(Buffer.from(value))
      }
    } else {
      const body = Buffer.from(await response.arrayBuffer())
      if (body.byteLength > MAX_PLUGIN_PACKAGE_BYTES) throw new Error('插件包超过 2MB 限制')
      chunks.push(body)
    }
    const buffer = Buffer.concat(chunks)
    const actualHash = createHash('sha256').update(buffer).digest('hex')
    if (actualHash !== integritySha256) throw new Error('插件包 SHA-256 校验失败')
    return buffer
  } finally {
    clearTimeout(timeout)
  }
}

export interface CanvasPluginPublishDependencies {
  environment?: NodeJS.ProcessEnv
  resolveHostname?: (host: string) => Promise<Array<{ address: string }>>
  fetchImpl?: (url: string, init: RequestInit) => Promise<PluginPackageResponse>
  savePackage?: typeof saveUploadedBuffer
  deletePackage?: (input: StoredUploadReference) => Promise<unknown>
  repository?: CanvasPluginPublishRepository
}

/** 让发布链路可用内存仓储测试，而无需为每个镜像场景写入真实数据库。 */
export interface CanvasPluginPublishRepository {
  upsertPlugin(input: { slug: string; name: string; description: string | null; manifest: Record<string, unknown> }): Promise<{ id: string; [key: string]: unknown }>
  findRelease(input: { pluginId: string; version: string }): Promise<Record<string, unknown> | null>
  upsertRelease(input: Record<string, unknown>): Promise<Record<string, unknown>>
}

const defaultCanvasPluginPublishRepository: CanvasPluginPublishRepository = {
  upsertPlugin: async ({ slug, name, description, manifest }) => await (prisma as any).canvasPlugin.upsert({
    where: { slug },
    create: { slug, name, description, manifestJson: manifest, isEnabled: true },
    update: { name, description, manifestJson: manifest, isEnabled: true },
  }),
  findRelease: async ({ pluginId, version }) => await (prisma as any).canvasPluginRelease.findUnique({
    where: { pluginId_version: { pluginId, version } },
  }),
  upsertRelease: async (input) => {
    const { pluginId, version, ...data } = input as { pluginId: string; version: string; [key: string]: unknown }
    return await (prisma as any).canvasPluginRelease.upsert({
      where: { pluginId_version: { pluginId, version } },
      create: { pluginId, version, ...data },
      update: data,
    })
  },
}

export const listCanvasPluginsForUser = async (userId: string) => {
  const plugins = await (prisma as any).canvasPlugin.findMany({
    where: { isEnabled: true },
    include: { releases: { orderBy: { createdAt: 'desc' }, take: 1 }, installs: { where: { userId }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  return plugins.map((plugin: any) => ({
    id: plugin.id,
    slug: plugin.slug,
    name: plugin.name,
    description: plugin.description || '',
    manifest: plugin.manifestJson,
    release: plugin.releases[0] ? {
      id: plugin.releases[0].id,
      version: plugin.releases[0].version,
      packageUrl: plugin.releases[0].packageUrl,
      integritySha256: plugin.releases[0].integritySha256,
      manifest: plugin.releases[0].manifestJson,
      isMirrored: Boolean(plugin.releases[0].packageStoragePath),
    } : null,
    installation: plugin.installs[0] ? { enabled: plugin.installs[0].isEnabled, releaseId: plugin.installs[0].releaseId } : null,
  }))
}

/** 后台查看完整注册表；源地址只对管理员可见，普通用户永远只拿镜像 URL。 */
export const listCanvasPluginsForAdmin = async () => {
  const plugins = await (prisma as any).canvasPlugin.findMany({
    include: { releases: { orderBy: { createdAt: 'desc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  return plugins.map((plugin: any) => ({
    id: plugin.id,
    slug: plugin.slug,
    name: plugin.name,
    description: plugin.description || '',
    isEnabled: Boolean(plugin.isEnabled),
    manifest: plugin.manifestJson,
    releases: plugin.releases.map((release: any) => ({
      id: release.id,
      version: release.version,
      sourcePackageUrl: release.sourcePackageUrl || '',
      packageUrl: release.packageUrl,
      integritySha256: release.integritySha256,
      isTrusted: Boolean(release.isTrusted),
      isMirrored: Boolean(release.packageStoragePath),
      createdAt: release.createdAt,
    })),
  }))
}

export const installCanvasPlugin = async (userId: string, pluginId: string, enabled = true) => {
  const plugin = await (prisma as any).canvasPlugin.findFirst({ where: { id: pluginId, isEnabled: true }, include: { releases: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  const release = plugin?.releases?.[0]
  if (!plugin || !release?.isTrusted || !release.packageStoragePath) throw new Error('插件不存在、未通过审核或尚未完成完整性镜像')
  return await (prisma as any).canvasPluginInstall.upsert({
    where: { userId_pluginId: { userId, pluginId } },
    create: { userId, pluginId, releaseId: release.id, isEnabled: Boolean(enabled) },
    update: { releaseId: release.id, isEnabled: Boolean(enabled) },
  })
}

export const uninstallCanvasPlugin = async (userId: string, pluginId: string) => {
  await (prisma as any).canvasPluginInstall.deleteMany({ where: { userId, pluginId } })
  return { pluginId, deleted: true }
}

export const publishTrustedCanvasPlugin = async (payload: any, adminUserId: string, dependencies: CanvasPluginPublishDependencies = {}) => {
  const slug = normalizeSlug(payload?.slug)
  const name = String(payload?.name || '').trim().slice(0, 100)
  const version = String(payload?.version || '').trim().slice(0, 50)
  if (!slug || !name || !version) throw new Error('缺少插件 slug、名称或版本')
  const integritySha256 = assertIntegrity(payload?.integritySha256)
  const manifest = normalizeCanvasPluginManifest(payload?.manifest)
  const sourcePackageUrl = await assertTrustedCanvasPluginPackageUrl(payload?.packageUrl, dependencies)
  const packageBuffer = await downloadAndVerifyCanvasPluginPackage(sourcePackageUrl, integritySha256, dependencies.fetchImpl)
  const storedPackage = await (dependencies.savePackage || saveUploadedBuffer)({
    buffer: packageBuffer,
    filename: `${slug}-${version}.html`,
    mimeType: 'text/html; charset=utf-8',
    category: `canvas-plugin/${slug}/${version}`,
  })
  const repository = dependencies.repository || defaultCanvasPluginPublishRepository
  const description = String(payload?.description || '').trim().slice(0, 255) || null
  let previousRelease: any = null
  try {
    const plugin = await repository.upsertPlugin({ slug, name, description, manifest })
    previousRelease = await repository.findRelease({ pluginId: plugin.id, version })
    const release = await repository.upsertRelease({
      pluginId: plugin.id, version, packageUrl: storedPackage.publicUrl, sourcePackageUrl,
      packageStoragePath: storedPackage.relativePath, packageStorageType: storedPackage.storageType,
      packageStorageCode: storedPackage.storageCode, integritySha256, manifestJson: manifest, isTrusted: true, publishedById: adminUserId,
    })
    if (previousRelease?.packageStoragePath && previousRelease.packageStoragePath !== storedPackage.relativePath) {
      await (dependencies.deletePackage || deleteUploadedStorageFile)({
        relativePath: previousRelease.packageStoragePath,
        storageType: previousRelease.packageStorageType,
        storageCode: previousRelease.packageStorageCode || undefined,
      }).catch(() => undefined)
    }
    return { plugin, release }
  } catch (error) {
    await (dependencies.deletePackage || deleteUploadedStorageFile)({
      relativePath: storedPackage.relativePath,
      storageType: storedPackage.storageType,
      storageCode: storedPackage.storageCode || undefined,
    }).catch(() => undefined)
    throw error
  }
}
