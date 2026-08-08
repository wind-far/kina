/**
 * iframe 插件与画布宿主之间的纯 JSON 协议。
 *
 * 插件不能把 Vue/JSX 或函数注入主应用；它只能登记这些受限描述，宿主用自己的
 * 通用节点与按钮渲染，再通过 postMessage 交回用户触发的动作。
 */
export interface CanvasPluginNodeContribution {
  id: string
  title: string
  description: string
  color: string
  defaultData: Record<string, unknown>
}

export interface CanvasPluginActionContribution {
  id: string
  title: string
  description: string
  icon?: string
}

export interface CanvasPluginMigrationContribution {
  id: string
  fromVersion: number
  toVersion: number
}

export interface CanvasPluginRuntimeContributions {
  nodes: CanvasPluginNodeContribution[]
  toolbar: CanvasPluginActionContribution[]
  inspectors: CanvasPluginActionContribution[]
  migrations: CanvasPluginMigrationContribution[]
  generation: CanvasPluginActionContribution[]
}

export const EMPTY_CANVAS_PLUGIN_CONTRIBUTIONS: CanvasPluginRuntimeContributions = {
  nodes: [], toolbar: [], inspectors: [], migrations: [], generation: [],
}

const safeId = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 64)
const safeText = (value: unknown, max: number) => String(value || '').trim().slice(0, max)
const safeColor = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).trim() : '#6d5dfc'

const isJsonValue = (value: unknown, depth = 0): boolean => {
  if (depth > 5 || value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.length <= 40 && value.every(item => isJsonValue(item, depth + 1))
  return typeof value === 'object' && Object.keys(value as object).length <= 40 && Object.values(value as Record<string, unknown>).every(item => isJsonValue(item, depth + 1))
}

const asRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const normalizeActions = (value: unknown) => Array.isArray(value) ? value.slice(0, 12).flatMap((item): CanvasPluginActionContribution[] => {
  const input = asRecord(item)
  const id = safeId(input.id)
  const title = safeText(input.title, 50)
  if (!id || !title) return []
  const icon = safeText(input.icon, 300)
  return [{ id, title, description: safeText(input.description, 160), ...(icon ? { icon } : {}) }]
}) : []

/** 按能力白名单收敛远程插件声明，所有未知字段都不会进入主应用运行时。 */
export const normalizeCanvasPluginRuntimeContributions = (
  value: unknown,
  capabilities: Iterable<string>,
): CanvasPluginRuntimeContributions => {
  const input = asRecord(value)
  const granted = new Set(capabilities)
  const unique = <T extends { id: string }>(items: T[]) => items.filter((item, index) => items.findIndex(candidate => candidate.id === item.id) === index)
  const nodes = granted.has('nodes') && Array.isArray(input.nodes) ? unique(input.nodes.slice(0, 12).flatMap((item): CanvasPluginNodeContribution[] => {
    const node = asRecord(item)
    const id = safeId(node.id)
    const title = safeText(node.title, 50)
    const defaultData = asRecord(node.defaultData)
    if (!id || !title || !isJsonValue(defaultData)) return []
    return [{ id, title, description: safeText(node.description, 160), color: safeColor(node.color), defaultData }]
  })) : []
  const toolbar = granted.has('toolbar') ? unique(normalizeActions(input.toolbar)) : []
  const inspectors = granted.has('inspector') ? unique(normalizeActions(input.inspectors)) : []
  const generation = granted.has('generation') ? unique(normalizeActions(input.generation)) : []
  const migrations = granted.has('migration') && Array.isArray(input.migrations) ? unique(input.migrations.slice(0, 20).flatMap((item): CanvasPluginMigrationContribution[] => {
    const migration = asRecord(item)
    const id = safeId(migration.id)
    const fromVersion = Number(migration.fromVersion)
    const toVersion = Number(migration.toVersion)
    if (!id || !Number.isInteger(fromVersion) || !Number.isInteger(toVersion) || fromVersion < 1 || toVersion <= fromVersion) return []
    return [{ id, fromVersion, toVersion }]
  })) : []
  return { nodes, toolbar, inspectors, migrations, generation }
}

export const canvasPluginNodeType = (slug: string, nodeId: string) => `plugin:${safeId(slug)}/${safeId(nodeId)}`
/** 既是运行时校验，也是宿主创建插件节点时的类型收窄。 */
export const isCanvasPluginNodeType = (value: unknown): value is `plugin:${string}` => (
  /^plugin:[a-z0-9][a-z0-9_-]{0,63}\/[a-z0-9][a-z0-9_-]{0,63}$/.test(String(value || ''))
)
