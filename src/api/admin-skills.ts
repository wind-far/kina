import { buildApiUrl } from './http'
import { readApiData } from './response'

export type AdminSkillUiMode = 'PLAIN_CHAT' | 'WORKSPACE'
export type AdminSkillExecutionMode =
  | 'CHAT_ONLY'
  | 'PLANNER_THEN_GENERATE'
  | 'PLANNER_THEN_STORYBOARD'
  | 'DIRECT_GENERATE'
export type AdminSkillPlannerModelCategory = 'CHAT' | 'IMAGE' | 'VIDEO'
export type AdminSkillPromptScene = 'CHAT' | 'PLANNER'

export interface AdminSkillItem {
  id: string
  providerId: string
  skillKey: string
  label: string
  description: string
  iconType: string
  category: string
  uiMode: AdminSkillUiMode
  executionMode: AdminSkillExecutionMode
  workflowType: string
  plannerModelCategory: AdminSkillPlannerModelCategory
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface AdminSkillDependencyItem {
  id: string
  skillId: string
  dependencySkillId: string
  dependencySkillKey: string
  dependencySkillLabel: string
  sortOrder: number
  createdAt: string
}

export interface AdminSkillPromptTemplateItem {
  id: string
  skillId: string
  scene: AdminSkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSkillWorkflowTemplateItem {
  id: string
  skillId: string
  workflowLabel: string
  workflowType: string
  expectedImageCount: number
  workflowParamsTemplateJson: Record<string, unknown> | null
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSkillPlanTemplateItem {
  id: string
  skillId: string
  itemKey: string
  titleTemplate: string
  promptTemplate: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSkillStageTemplateItem {
  id: string
  skillId: string
  stageKey: string
  stageLabel: string
  indicatorTitle: string
  indicatorDescriptionTemplate: string
  sortOrder: number
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSkillDetail {
  skill: AdminSkillItem
  dependencies: AdminSkillDependencyItem[]
  prompts: AdminSkillPromptTemplateItem[]
  workflowTemplates: AdminSkillWorkflowTemplateItem[]
  planTemplates: AdminSkillPlanTemplateItem[]
  stageTemplates: AdminSkillStageTemplateItem[]
}

export interface AdminSkillPromptTemplatePayload {
  scene: AdminSkillPromptScene
  systemPrompt: string
  userPromptTemplate: string
  isEnabled: boolean
}

export interface AdminSkillWorkflowTemplatePayload {
  workflowLabel: string
  workflowType: string
  expectedImageCount: number
  workflowParamsTemplateJson: Record<string, unknown> | null
  isEnabled: boolean
}

export interface AdminSkillPlanTemplatePayload {
  itemKey: string
  titleTemplate: string
  promptTemplate: string
  sortOrder: number
  isEnabled: boolean
}

export interface AdminSkillStageTemplatePayload {
  stageKey: string
  stageLabel: string
  indicatorTitle: string
  indicatorDescriptionTemplate: string
  sortOrder: number
  isEnabled: boolean
}

export interface AdminSkillPayload {
  providerId: string
  skillKey: string
  label: string
  description: string
  iconType: string
  category: string
  uiMode: AdminSkillUiMode
  executionMode: AdminSkillExecutionMode
  workflowType: string
  plannerModelCategory: AdminSkillPlannerModelCategory
  expectedImageCount: number
  isEnabled: boolean
  isBuiltIn: boolean
  sortOrder: number
  configJson: Record<string, unknown> | null
  dependencySkillKeys: string[]
  promptTemplates: AdminSkillPromptTemplatePayload[]
  workflowTemplates: AdminSkillWorkflowTemplatePayload[]
  planTemplates: AdminSkillPlanTemplatePayload[]
  stageTemplates: AdminSkillStageTemplatePayload[]
}

const SKILLS_API_PATH = '/api/skill-config/skills'

export const listAdminSkills = async () => {
  const response = await fetch(buildApiUrl(SKILLS_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminSkillItem[]>(response)
}

export const getAdminSkillDetail = async (skillKey: string) => {
  const response = await fetch(buildApiUrl(`${SKILLS_API_PATH}/${encodeURIComponent(skillKey)}`), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })

  return readApiData<AdminSkillDetail>(response)
}

export const createAdminSkill = async (payload: AdminSkillPayload) => {
  const response = await fetch(buildApiUrl(SKILLS_API_PATH), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminSkillDetail>(response, {
    showSuccessMessage: true,
    successMessage: '技能已创建',
  })
}

export const updateAdminSkill = async (skillKey: string, payload: AdminSkillPayload) => {
  const response = await fetch(buildApiUrl(`${SKILLS_API_PATH}/${encodeURIComponent(skillKey)}`), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return readApiData<AdminSkillDetail>(response, {
    showSuccessMessage: true,
    successMessage: '技能已更新',
  })
}

export const deleteAdminSkill = async (skillKey: string) => {
  const response = await fetch(buildApiUrl(`${SKILLS_API_PATH}/${encodeURIComponent(skillKey)}`), {
    method: 'DELETE',
    credentials: 'include',
  })

  return readApiData<{ skillKey: string }>(response, {
    showSuccessMessage: true,
    successMessage: '技能已删除',
  })
}
