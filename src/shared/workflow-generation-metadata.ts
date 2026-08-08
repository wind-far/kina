import type { SkillMediaReference } from './skill-runtime'

export type WorkflowGenerationKind = 'image' | 'video' | 'text'

export interface WorkflowGenerationReference {
  url: string
  mediaType: 'image' | 'video' | 'audio'
  role?: string
}

/**
 * 持久化在生成结果节点上的最小重放信息。
 * 不写入厂商密钥或原始请求体；任务仍完全由服务端账户体系执行。
 */
export interface WorkflowGenerationMetadata {
  version: 1
  kind: WorkflowGenerationKind
  prompt: string
  model?: string
  modelKey?: string
  systemPrompt?: string
  outputFormat?: string
  size?: string
  quality?: string
  ratio?: string
  resolution?: string
  duration?: number
  count?: number
  references: WorkflowGenerationReference[]
  sourceConfigNodeId?: string
}

type BuildMetadataInput = Omit<WorkflowGenerationMetadata, 'version' | 'references'> & {
  references?: Array<WorkflowGenerationReference | SkillMediaReference>
}

const text = (value: unknown, max = 500) => String(value || '').trim().slice(0, max)

const normalizeReference = (value: WorkflowGenerationReference | SkillMediaReference): WorkflowGenerationReference | null => {
  const url = text(value.url, 2000)
  if (!url) return null
  const mediaType = value.mediaType === 'video' || value.mediaType === 'audio' ? value.mediaType : 'image'
  return { url, mediaType, ...(text(value.role, 80) ? { role: text(value.role, 80) } : {}) }
}

export const buildWorkflowGenerationMetadata = (input: BuildMetadataInput): WorkflowGenerationMetadata => ({
  version: 1,
  kind: input.kind,
  prompt: text(input.prompt, 8000),
  ...(text(input.model, 200) ? { model: text(input.model, 200) } : {}),
  ...(text(input.modelKey, 300) ? { modelKey: text(input.modelKey, 300) } : {}),
  ...(text(input.systemPrompt, 8000) ? { systemPrompt: text(input.systemPrompt, 8000) } : {}),
  ...(text(input.outputFormat, 80) ? { outputFormat: text(input.outputFormat, 80) } : {}),
  ...(text(input.size, 80) ? { size: text(input.size, 80) } : {}),
  ...(text(input.quality, 80) ? { quality: text(input.quality, 80) } : {}),
  ...(text(input.ratio, 80) ? { ratio: text(input.ratio, 80) } : {}),
  ...(text(input.resolution, 80) ? { resolution: text(input.resolution, 80) } : {}),
  ...(Number.isFinite(input.duration) && Number(input.duration) > 0 ? { duration: Number(input.duration) } : {}),
  ...(Number.isFinite(input.count) && Number(input.count) > 0 ? { count: Math.min(8, Math.floor(Number(input.count))) } : {}),
  references: (input.references || []).flatMap(reference => {
    const normalized = normalizeReference(reference)
    return normalized ? [normalized] : []
  }).slice(0, 12),
  ...(text(input.sourceConfigNodeId, 120) ? { sourceConfigNodeId: text(input.sourceConfigNodeId, 120) } : {}),
})

export const isWorkflowGenerationMetadata = (value: unknown): value is WorkflowGenerationMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Partial<WorkflowGenerationMetadata>
  return metadata.version === 1
    && (metadata.kind === 'image' || metadata.kind === 'video' || metadata.kind === 'text')
    && typeof metadata.prompt === 'string'
    && Array.isArray(metadata.references)
}
