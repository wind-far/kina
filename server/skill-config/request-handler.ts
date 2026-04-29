import { requireAdminSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { SKILL_CONFIG_CATALOG_PATH, SKILL_CONFIG_SKILLS_PATH } from './constants'
import {
  createAdminSkill,
  deleteAdminSkill,
  getSkillDefinitionDetail,
  listAdminSkills,
  listPublicEnabledSkills,
  setAdminSkillEnabled,
  updateAdminSkill,
} from './service'

const matchSkillDetailPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/skill-config\/skills\/([^/]+)$/)
  if (!matched) {
    return null
  }

  return {
    skillKey: decodeURIComponent(matched[1]),
  }
}

const sendSkillConfigError = (res: any, status: number, message: string) => {
  sendJson(res, status, {
    error: {
      type: 'skill_config_error',
      message,
    },
    message,
  })
}

// 处理技能配置相关请求。
export const handleSkillConfigRequest = async (req: any, res: any) => {
  try {
    if (!isPrismaConfigured()) {
      sendSkillConfigError(res, 500, '缺少 DATABASE_URL，暂时无法使用技能配置中心。')
      return
    }

    const requestPath = String(req.url || '').split('?')[0]
    const skillDetailMatch = matchSkillDetailPath(requestPath)

    if (req.method === 'GET' && requestPath === SKILL_CONFIG_CATALOG_PATH) {
      const data = await listPublicEnabledSkills()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && requestPath === SKILL_CONFIG_SKILLS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await listAdminSkills()
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'GET' && skillDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await getSkillDefinitionDetail(skillDetailMatch.skillKey)
      sendJson(res, 200, { data })
      return
    }

    if (req.method === 'POST' && requestPath === SKILL_CONFIG_SKILLS_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await createAdminSkill(payload as any)
      sendJson(res, 200, { data, message: '技能已创建' })
      return
    }

    if (req.method === 'PUT' && skillDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await updateAdminSkill(skillDetailMatch.skillKey, payload as any)
      sendJson(res, 200, { data, message: '技能已更新' })
      return
    }

    if (req.method === 'PATCH' && skillDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const payload = await readJsonBody(req)
      const data = await setAdminSkillEnabled(skillDetailMatch.skillKey, Boolean((payload as any)?.isEnabled))
      sendJson(res, 200, { data, message: '技能状态已更新' })
      return
    }

    if (req.method === 'DELETE' && skillDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteAdminSkill(skillDetailMatch.skillKey)
      sendJson(res, 200, { data, message: '技能已删除' })
      return
    }

    sendSkillConfigError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSkillConfigError(res, 500, error?.message || '读取技能配置失败')
  }
}
