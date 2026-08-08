import { buildApiUrl } from './http'
import { readApiData } from './response'

export interface SkillSourceAvailability {
  id: string
  packageKey: string
  name: string
  repositoryUrl: string | null
  licenseUrl: string | null
  termsVersion: string | null
  complianceJson: Record<string, unknown> | null
  accepted: boolean
  acceptedAt: string | null
}

const BASE_PATH = '/api/skill-config/sources'

export const listSkillSourceAvailability = async () => {
  const response = await fetch(buildApiUrl(BASE_PATH), { method: 'GET', credentials: 'include', cache: 'no-store' })
  return readApiData<SkillSourceAvailability[]>(response)
}

export const acceptSkillSourceTerms = async (packageKey: string) => {
  const response = await fetch(buildApiUrl(`${BASE_PATH}/${encodeURIComponent(packageKey)}/acceptance`), {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
  })
  return readApiData(response, { showSuccessMessage: true, successMessage: '已确认 Skill 使用条款' })
}
