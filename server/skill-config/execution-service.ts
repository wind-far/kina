import type { SkillExecutionPlan } from '../../src/shared/skill-runtime'
import { isPrismaConfigured, prisma } from '../db/prisma'
import type { GenerationTaskStartPayload } from '../generation-tasks/shared'

const capabilityForTask = (payload: GenerationTaskStartPayload) => {
  if (payload.type === 'video') return 'video_generation' as const
  if (payload.type === 'image') return 'image_generation' as const
  return 'text_planning' as const
}

export const buildSkillExecutionPlan = (payload: GenerationTaskStartPayload): SkillExecutionPlan => ({
  skillKey: String(payload.skill || '').trim() || 'general',
  workflowType: String(payload.requestMode || payload.type || '').trim(),
  steps: [{
    key: 'primary-generation',
    label: payload.type === 'video' ? '生成视频' : payload.type === 'image' ? '生成图片' : '执行 Skill',
    capability: capabilityForTask(payload),
  }],
  mediaReferences: payload.mediaReferences || [],
  params: {
    modelKey: String(payload.modelKey || '').trim(),
    ratio: String(payload.ratio || '').trim(),
    resolution: String(payload.resolution || '').trim(),
    duration: String(payload.duration || '').trim(),
  },
})

export const createSkillExecutionRun = async (input: {
  userId: string
  recordId: string
  skillKey: string
  payload: GenerationTaskStartPayload
}) => {
  if (!isPrismaConfigured()) return null
  const skill = await prisma.aiSkill.findUnique({ where: { skillKey: input.skillKey }, select: { id: true } })
  return prisma.skillExecutionRun.create({
    data: {
      userId: input.userId,
      skillId: skill?.id || null,
      generationRecordId: input.recordId,
      status: 'QUEUED',
      planJson: buildSkillExecutionPlan(input.payload),
    },
  })
}

export const markSkillExecutionRun = async (recordId: string, status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED', stateJson?: Record<string, unknown>) => {
  if (!isPrismaConfigured()) return
  const now = new Date()
  await prisma.skillExecutionRun.updateMany({
    where: { generationRecordId: recordId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: {
      status,
      ...(status === 'RUNNING' ? { startedAt: now } : { finishedAt: now }),
      ...(stateJson ? { stateJson } : {}),
    },
  })
}
