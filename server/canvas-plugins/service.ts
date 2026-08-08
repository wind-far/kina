import { prisma } from '../db/prisma'

const normalizeSlug = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
const assertHttpsUrl = (value: unknown) => {
  const raw = String(value || '').trim()
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('插件包地址必须使用 HTTPS')
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
    release: plugin.releases[0] ? { id: plugin.releases[0].id, version: plugin.releases[0].version, packageUrl: plugin.releases[0].packageUrl, integritySha256: plugin.releases[0].integritySha256, manifest: plugin.releases[0].manifestJson } : null,
    installation: plugin.installs[0] ? { enabled: plugin.installs[0].isEnabled, releaseId: plugin.installs[0].releaseId } : null,
  }))
}

export const installCanvasPlugin = async (userId: string, pluginId: string, enabled = true) => {
  const plugin = await (prisma as any).canvasPlugin.findFirst({ where: { id: pluginId, isEnabled: true }, include: { releases: { orderBy: { createdAt: 'desc' }, take: 1 } } })
  const release = plugin?.releases?.[0]
  if (!plugin || !release?.isTrusted) throw new Error('插件不存在或尚未通过审核')
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

export const publishTrustedCanvasPlugin = async (payload: any, adminUserId: string) => {
  const slug = normalizeSlug(payload?.slug)
  const name = String(payload?.name || '').trim().slice(0, 100)
  const version = String(payload?.version || '').trim().slice(0, 50)
  if (!slug || !name || !version) throw new Error('缺少插件 slug、名称或版本')
  const packageUrl = assertHttpsUrl(payload?.packageUrl)
  const integritySha256 = assertIntegrity(payload?.integritySha256)
  const manifest = normalizeCanvasPluginManifest(payload?.manifest)
  const plugin = await (prisma as any).canvasPlugin.upsert({
    where: { slug },
    create: { slug, name, description: String(payload?.description || '').trim().slice(0, 255) || null, manifestJson: manifest, isEnabled: true },
    update: { name, description: String(payload?.description || '').trim().slice(0, 255) || null, manifestJson: manifest, isEnabled: true },
  })
  const release = await (prisma as any).canvasPluginRelease.upsert({
    where: { pluginId_version: { pluginId: plugin.id, version } },
    create: { pluginId: plugin.id, version, packageUrl, integritySha256, manifestJson: manifest, isTrusted: true, publishedById: adminUserId },
    update: { packageUrl, integritySha256, manifestJson: manifest, isTrusted: true, publishedById: adminUserId },
  })
  return { plugin, release }
}
