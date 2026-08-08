export type CanvasAssistantProposalOperation =
  | {
      type: 'insert_text_node'
      clientKey: string
      position?: { x?: number; y?: number }
      data?: { label?: string; content?: string }
    }
  | {
      type: 'insert_director_node'
      clientKey: string
      position?: { x?: number; y?: number }
      data?: { label?: string; brief?: string; shotPlan?: string; mode?: string }
    }
  | {
      type: 'connect_nodes'
      sourceClientKey: string
      targetClientKey: string
      edgeType?: string
    }

export interface CanvasAssistantProposal {
  summary: string
  operations: CanvasAssistantProposalOperation[]
}

export interface ParsedCanvasAssistantProposal {
  displayContent: string
  proposal: CanvasAssistantProposal | null
}

const PROPOSAL_TAG = 'canvas-proposal'
const MAX_OPERATIONS = 20
const MAX_COORDINATE = 100_000
const CLIENT_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/

const safeText = (value: unknown, maxLength: number) => String(value ?? '').trim().slice(0, maxLength)

const safePosition = (value: unknown) => {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const coordinate = (name: 'x' | 'y') => {
    const numeric = Number(input[name])
    return Number.isFinite(numeric) ? Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, numeric)) : undefined
  }
  return { x: coordinate('x'), y: coordinate('y') }
}

export const normalizeCanvasAssistantProposal = (value: unknown): CanvasAssistantProposal | null => {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (!Array.isArray(input.operations) || input.operations.length === 0 || input.operations.length > MAX_OPERATIONS) return null

  const operations: CanvasAssistantProposalOperation[] = []
  const insertedClientKeys = new Set<string>()
  for (const rawOperation of input.operations) {
    if (!rawOperation || typeof rawOperation !== 'object') return null
    const operation = rawOperation as Record<string, unknown>
    const type = safeText(operation.type, 64)
    if (type === 'insert_text_node') {
      const clientKey = safeText(operation.clientKey, 64)
      if (!CLIENT_KEY_PATTERN.test(clientKey) || insertedClientKeys.has(clientKey)) return null
      const data = operation.data && typeof operation.data === 'object' ? operation.data as Record<string, unknown> : {}
      operations.push({
        type,
        clientKey,
        position: safePosition(operation.position),
        data: { label: safeText(data.label, 160), content: safeText(data.content, 6000) },
      })
      insertedClientKeys.add(clientKey)
      continue
    }
    if (type === 'insert_director_node') {
      const clientKey = safeText(operation.clientKey, 64)
      if (!CLIENT_KEY_PATTERN.test(clientKey) || insertedClientKeys.has(clientKey)) return null
      const data = operation.data && typeof operation.data === 'object' ? operation.data as Record<string, unknown> : {}
      const mode = safeText(data.mode, 32)
      operations.push({
        type,
        clientKey,
        position: safePosition(operation.position),
        data: {
          label: safeText(data.label, 160),
          brief: safeText(data.brief, 6000),
          shotPlan: safeText(data.shotPlan, 6000),
          mode: ['short-video', 'commercial', 'storyboard'].includes(mode) ? mode : 'short-video',
        },
      })
      insertedClientKeys.add(clientKey)
      continue
    }
    if (type === 'connect_nodes') {
      const sourceClientKey = safeText(operation.sourceClientKey, 64)
      const targetClientKey = safeText(operation.targetClientKey, 64)
      if (
        !CLIENT_KEY_PATTERN.test(sourceClientKey)
        || !CLIENT_KEY_PATTERN.test(targetClientKey)
        || sourceClientKey === targetClientKey
        || !insertedClientKeys.has(sourceClientKey)
        || !insertedClientKeys.has(targetClientKey)
      ) return null
      operations.push({
        type,
        sourceClientKey,
        targetClientKey,
        edgeType: 'promptOrder',
      })
      continue
    }
    return null
  }

  return { summary: safeText(input.summary, 280) || '已生成画布提案，请确认后应用。', operations }
}

export const buildCanvasAssistantProposalInstruction = () => [
  '当前是受限画布助手。基于用户请求和随附的选区上下文，可提出对无限画布的修改。',
  '不要声称已经修改画布；只能给出建议和一个结构化提案。',
  '若适合修改画布，请在回复末尾输出且只输出一个标签：<canvas-proposal>{"summary":"...","operations":[...]}</canvas-proposal>。',
  'operations 仅允许 insert_text_node、insert_director_node、connect_nodes；最多 20 项。',
  '新增节点必须提供唯一 clientKey（字母开头，最多64字符）；连接只能引用前面已新增的 clientKey。',
  '不得输出脚本、HTML、外部链接、权限请求或任何其他操作类型。若不应修改画布，不要输出标签。',
].join('\n')

export const parseCanvasAssistantProposal = (content: unknown): ParsedCanvasAssistantProposal => {
  const raw = String(content ?? '')
  const matcher = new RegExp(`<${PROPOSAL_TAG}>([\\s\\S]*?)</${PROPOSAL_TAG}>`, 'i')
  const match = raw.match(matcher)
  if (!match) return { displayContent: raw.trim(), proposal: null }
  try {
    const proposal = normalizeCanvasAssistantProposal(JSON.parse(match[1]))
    if (!proposal) return { displayContent: raw.trim(), proposal: null }
    const displayContent = raw.replace(match[0], '').trim()
    return { displayContent, proposal }
  } catch {
    return { displayContent: raw.trim(), proposal: null }
  }
}
