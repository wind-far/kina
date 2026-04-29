export const SKILL_CONFIG_CATALOG_PATH = '/api/skill-config/catalog'
export const SKILL_CONFIG_SKILLS_PATH = '/api/skill-config/skills'

export const isSkillConfigPath = (requestPath: string) => {
  return requestPath === SKILL_CONFIG_CATALOG_PATH
    || requestPath === SKILL_CONFIG_SKILLS_PATH
    || requestPath.startsWith(`${SKILL_CONFIG_SKILLS_PATH}/`)
}
