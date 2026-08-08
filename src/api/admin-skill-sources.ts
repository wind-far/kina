import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface AdminSkillSourcePackage {
  id: string
  packageKey: string
  name: string
  repositoryUrl: string | null
  licenseUrl: string | null
  sourceRevision: string | null
  integritySha256: string | null
  termsVersion: string | null
  complianceJson: Record<string, unknown> | null
  isEnabled: boolean
  artifactCount: number
  skillCount: number
  updatedAt: string
}

const SOURCES_API_PATH = '/api/skill-config/sources'

export const listAdminSkillSources = async () => {
  const response = await fetch(buildApiUrl(SOURCES_API_PATH), {
    method: 'GET', credentials: 'include', cache: 'no-store',
  })
  return readApiData<AdminSkillSourcePackage[]>(response)
}

export const syncMiniMaxH3SkillSources = async () => {
  const response = await fetch(buildApiUrl(`${SOURCES_API_PATH}/minimax-h3/sync`), {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
  })
  return readApiData<{ packageKey: string; sourceRevision: string; artifactCount: number; integritySha256: string }>(response, {
    showSuccessMessage: true,
    successMessage: 'MiniMax H3 Skill 文档已同步',
  })
}
