import { buildApiUrl } from '@/api/http'
import { readApiData } from '@/api/response'
import {
  applyPublicSkillCatalog,
  buildAgentChatMessages,
  buildAgentWorkflowStrategy,
  getAgentSkillCatalogItem,
  getAgentSkillConfig,
  isAgentWorkspaceSkill,
  listEnabledAgentSkills,
  type AgentSkillConfig,
  type AgentSkillKey,
  type AgentWorkflowStrategy,
  type PublicAgentSkillCatalogItem,
} from '@/shared/agent-skills-core'

export {
  applyPublicSkillCatalog,
  buildAgentChatMessages,
  buildAgentWorkflowStrategy,
  getAgentSkillCatalogItem,
  getAgentSkillConfig,
  isAgentWorkspaceSkill,
  listEnabledAgentSkills,
}

export type {
  AgentSkillConfig,
  AgentSkillKey,
  AgentWorkflowStrategy,
  PublicAgentSkillCatalogItem,
}

const AGENT_SKILL_CATALOG_API_PATH = '/api/skill-config/catalog'
let publicSkillCatalogPromise: Promise<PublicAgentSkillCatalogItem[]> | null = null

export const loadPublicSkillCatalog = async (force = false) => {
  if (!force && publicSkillCatalogPromise) {
    return publicSkillCatalogPromise
  }

  publicSkillCatalogPromise = fetch(buildApiUrl(AGENT_SKILL_CATALOG_API_PATH), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
    .then(response => readApiData<PublicAgentSkillCatalogItem[]>(response, { showErrorMessage: false }))
    .then(data => applyPublicSkillCatalog(data))
    .catch(() => applyPublicSkillCatalog([]))
    .finally(() => {
      publicSkillCatalogPromise = null
    })

  return publicSkillCatalogPromise
}
