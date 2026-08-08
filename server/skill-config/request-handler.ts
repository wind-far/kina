import { requireAdminSessionUser, requireCurrentSessionUser } from '../auth/session'
import { isPrismaConfigured } from '../db/prisma'
import { readJsonBody, sendJson } from '../ai-gateway/shared'
import { invalidateAdminCaches } from '../shared/admin-cache'
import { recordAdminAuditLog } from '../shared/admin-audit'
import { SKILL_CONFIG_CATALOG_PATH, SKILL_CONFIG_SKILLS_PATH, SKILL_CONFIG_SOURCES_PATH } from './constants'
import {
  createAdminSkill,
  deleteAdminSkill,
  getSkillDefinitionDetail,
  listAdminSkills,
  listPublicEnabledSkills,
  setAdminSkillEnabled,
  updateAdminSkill,
} from './service'
import { acceptSkillSourceTerms, importSkillSourceArtifacts, listSkillSourcePackages, syncMiniMaxH3SourceArtifacts, upsertSkillSourcePackage } from './source-service'

const matchSkillDetailPath = (requestPath: string) => {
  const matched = requestPath.match(/^\/api\/skill-config\/skills\/([^/]+)$/)
  if (!matched) {
    return null
  }

  return {
    skillKey: decodeURIComponent(matched[1]),
  }
}

const matchSkillSourcePath = (requestPath: string, suffix = '') => {
  const matched = requestPath.match(new RegExp(`^/api/skill-config/sources/([^/]+)${suffix}$`))
  return matched ? decodeURIComponent(matched[1]) : ''
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
    const sourceTermsPackageKey = matchSkillSourcePath(requestPath, '/acceptance')
    const sourceArtifactsPackageKey = matchSkillSourcePath(requestPath, '/artifacts')
    const sourceSyncPackageKey = matchSkillSourcePath(requestPath, '/sync')

    if (req.method === 'GET' && requestPath === SKILL_CONFIG_SOURCES_PATH) {
      const currentUser = await requireCurrentSessionUser(req, res)
      if (!currentUser?.id) return
      sendJson(res, 200, { data: await listSkillSourcePackages(currentUser.id) })
      return
    }

    if (req.method === 'POST' && sourceTermsPackageKey) {
      const currentUser = await requireCurrentSessionUser(req, res)
      if (!currentUser?.id) return
      const data = await acceptSkillSourceTerms({ userId: currentUser.id, packageKey: sourceTermsPackageKey, req })
      sendJson(res, 200, { data, message: '已确认 Skill 使用条款' })
      return
    }

    if (req.method === 'POST' && requestPath === SKILL_CONFIG_SOURCES_PATH) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser?.id) return
      const data = await upsertSkillSourcePackage(await readJsonBody(req))
      await recordAdminAuditLog({ req, operatorUserId: currentUser.id, action: 'admin_skill_source_upsert', targetType: 'skill_source_package', targetId: data.packageKey, beforeJson: null, afterJson: data })
      sendJson(res, 200, { data, message: 'Skill 来源已保存' })
      return
    }

    if (req.method === 'POST' && sourceArtifactsPackageKey) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser?.id) return
      const data = await importSkillSourceArtifacts(sourceArtifactsPackageKey, await readJsonBody(req))
      await recordAdminAuditLog({ req, operatorUserId: currentUser.id, action: 'admin_skill_source_artifacts_import', targetType: 'skill_source_package', targetId: sourceArtifactsPackageKey, beforeJson: null, afterJson: { artifactCount: data.length } })
      sendJson(res, 200, { data, message: 'Skill 文档已导入并冻结版本' })
      return
    }

    if (req.method === 'POST' && sourceSyncPackageKey) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser?.id) return
      if (sourceSyncPackageKey !== 'minimax-h3') throw new Error('当前仅支持同步受信的 MiniMax H3 官方 Skill 清单')
      const data = await syncMiniMaxH3SourceArtifacts()
      await recordAdminAuditLog({ req, operatorUserId: currentUser.id, action: 'admin_skill_source_sync', targetType: 'skill_source_package', targetId: sourceSyncPackageKey, beforeJson: null, afterJson: data })
      sendJson(res, 200, { data, message: 'MiniMax H3 Skill 文档已同步并冻结版本' })
      return
    }

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
      await invalidateAdminCaches({ skills: data?.skill?.skillKey })
      await recordAdminAuditLog({
        req,
        operatorUserId: currentUser.id,
        action: 'admin_skill_create',
        targetType: 'skill_definition',
        targetId: data?.skill?.skillKey || '',
        beforeJson: null,
        afterJson: data,
      })
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
      await invalidateAdminCaches({ skills: skillDetailMatch.skillKey })
      await recordAdminAuditLog({
        req,
        operatorUserId: currentUser.id,
        action: 'admin_skill_update',
        targetType: 'skill_definition',
        targetId: skillDetailMatch.skillKey,
        beforeJson: { request: payload },
        afterJson: data,
      })
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
      await invalidateAdminCaches({ skills: skillDetailMatch.skillKey })
      await recordAdminAuditLog({
        req,
        operatorUserId: currentUser.id,
        action: 'admin_skill_enabled_update',
        targetType: 'skill_definition',
        targetId: skillDetailMatch.skillKey,
        beforeJson: { request: payload },
        afterJson: data,
      })
      sendJson(res, 200, { data, message: '技能状态已更新' })
      return
    }

    if (req.method === 'DELETE' && skillDetailMatch) {
      const currentUser = await requireAdminSessionUser(req, res)
      if (!currentUser) {
        return
      }

      const data = await deleteAdminSkill(skillDetailMatch.skillKey)
      await invalidateAdminCaches({ skills: skillDetailMatch.skillKey })
      await recordAdminAuditLog({
        req,
        operatorUserId: currentUser.id,
        action: 'admin_skill_delete',
        targetType: 'skill_definition',
        targetId: skillDetailMatch.skillKey,
        beforeJson: null,
        afterJson: data,
      })
      sendJson(res, 200, { data, message: '技能已删除' })
      return
    }

    sendSkillConfigError(res, 405, 'Method Not Allowed')
  } catch (error: any) {
    sendSkillConfigError(res, 500, error?.message || '读取技能配置失败')
  }
}
