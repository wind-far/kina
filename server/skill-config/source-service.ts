import { createHash } from 'node:crypto'
import { isPrismaConfigured, prisma } from '../db/prisma'

type JsonRecord = Record<string, unknown>

// ISO 3166-1 alpha-2：美国、欧盟成员国、英国与韩国。
const H3_EXCLUDED_COUNTRIES = new Set([
  'US', 'GB', 'UK', 'KR',
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
])

const MINIMAX_H3_REPOSITORY = 'MiniMax-AI/MiniMax-H3'
const MINIMAX_H3_ARTIFACT_PATHS = [
  'skills/h3-prompt-writing/SKILL.md',
  'skills/h3-prompt-writing/references/base-en.txt',
  'skills/h3-prompt-writing/references/ref-en.txt',
  'skills/3d-animation-short-generator/SKILL.md',
  'skills/3d-animation-short-generator/SKILL.cn.md',
  'skills/brand-promo-video-generator/SKILL.md',
  'skills/brand-promo-video-generator/SKILL.cn.md',
  'skills/co-op-game-intro-generator/SKILL.md',
  'skills/co-op-game-intro-generator/SKILL.cn.md',
  'skills/handdrawn-live-video-generator/SKILL.md',
  'skills/handdrawn-live-video-generator/SKILL.cn.md',
  'skills/minimalist-product-ad-generator/SKILL.md',
  'skills/minimalist-product-ad-generator/SKILL.cn.md',
  'skills/mv-subtitle-skill-confirmed/SKILL.md',
  'skills/mv-subtitle-skill-confirmed/SKILL.cn.md',
  'skills/paper-collage-explainer-generator/SKILL.md',
  'skills/paper-collage-explainer-generator/SKILL.cn.md',
  'skills/papercraft-stop-motion-explainer/SKILL.md',
  'skills/papercraft-stop-motion-explainer/SKILL.cn.md',
] as const

const MINIMAX_H3_SKILL_DEFINITIONS = [
  { key: 'h3-prompt-writing', label: 'H3 提示词编写', description: '将多模态创作需求整理为 MiniMax H3 视频提示词结构', paths: ['skills/h3-prompt-writing/SKILL.md', 'skills/h3-prompt-writing/references/base-en.txt', 'skills/h3-prompt-writing/references/ref-en.txt'] },
  { key: 'h3-3d-animation-short', label: 'H3 3D 动画短片', description: '从故事概念规划连续的风格化 3D 动画短片', paths: ['skills/3d-animation-short-generator/SKILL.md', 'skills/3d-animation-short-generator/SKILL.cn.md'] },
  { key: 'h3-brand-promo-video', label: 'H3 品牌宣传片', description: '规划品牌、产品与项目的宣传短片', paths: ['skills/brand-promo-video-generator/SKILL.md', 'skills/brand-promo-video-generator/SKILL.cn.md'] },
  { key: 'h3-co-op-game-intro', label: 'H3 双人游戏开场', description: '规划双人合作游戏菜单或开场动画', paths: ['skills/co-op-game-intro-generator/SKILL.md', 'skills/co-op-game-intro-generator/SKILL.cn.md'] },
  { key: 'h3-handdrawn-live-video', label: 'H3 手绘实拍融合', description: '规划手绘动画与实拍空间融合的创意短片', paths: ['skills/handdrawn-live-video-generator/SKILL.md', 'skills/handdrawn-live-video-generator/SKILL.cn.md'] },
  { key: 'h3-minimalist-product-ad', label: 'H3 极简产品广告', description: '规划电商与产品发布场景的极简广告短片', paths: ['skills/minimalist-product-ad-generator/SKILL.md', 'skills/minimalist-product-ad-generator/SKILL.cn.md'] },
  { key: 'h3-music-video-subtitle', label: 'H3 音乐视频字幕', description: '规划节拍驱动的歌词排版与音乐视频镜头', paths: ['skills/mv-subtitle-skill-confirmed/SKILL.md', 'skills/mv-subtitle-skill-confirmed/SKILL.cn.md'] },
  { key: 'h3-paper-collage-explainer', label: 'H3 拼贴讲解短片', description: '规划纸张拼贴风格的讲解与观点短片', paths: ['skills/paper-collage-explainer-generator/SKILL.md', 'skills/paper-collage-explainer-generator/SKILL.cn.md'] },
  { key: 'h3-papercraft-stop-motion', label: 'H3 纸艺定格讲解', description: '规划纸艺、立体书和定格动画讲解短片', paths: ['skills/papercraft-stop-motion-explainer/SKILL.md', 'skills/papercraft-stop-motion-explainer/SKILL.cn.md'] },
] as const

const normalizeKey = (value: unknown, label: string, maxLength = 100) => {
  const normalized = String(value || '').trim()
  if (!normalized || normalized.length > maxLength) throw new Error(`${label}不能为空且长度不能超过 ${maxLength}`)
  return normalized
}

const normalizeCountryCode = (value: unknown) => String(value || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')
const asObject = (value: unknown): JsonRecord | null => value && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonRecord : null

export const MINIMAX_H3_SOURCE = {
  packageKey: 'minimax-h3',
  name: 'MiniMax H3 Skills',
  repositoryUrl: 'https://github.com/MiniMax-AI/MiniMax-H3/tree/main/skills',
  licenseUrl: 'https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE',
  termsVersion: 'MiniMax-H3-Community-License',
  complianceJson: {
    requiresAcceptance: true,
    excludedCountries: ['US', 'EU', 'UK', 'KR'],
    requiresContentSafetyReporting: true,
    hostedServiceNotice: '使用 MiniMax H3 时须遵守其社区许可证、地域限制与内容安全要求。',
  },
} as const

const ensureMiniMaxH3Source = async () => {
  if (!isPrismaConfigured()) return null
  return prisma.skillSourcePackage.upsert({
    where: { packageKey: MINIMAX_H3_SOURCE.packageKey },
    create: {
      ...MINIMAX_H3_SOURCE,
      isTrusted: true,
      isEnabled: true,
    },
    update: {},
  })
}

export const ensureBuiltInSkillSources = async () => {
  await ensureMiniMaxH3Source()
}

/**
 * H3 Skill 文档可以提前入库，但在 H3 视频 Adapter 配置前必须保持停用，
 * 以免工作台错误把视频 Skill 路由到图片任务。
 */
const ensureMiniMaxH3SkillDefinitions = async (sourcePackageId: string) => {
  for (const [index, definition] of MINIMAX_H3_SKILL_DEFINITIONS.entries()) {
    await prisma.aiSkill.upsert({
      where: { skillKey: definition.key },
      create: {
        sourcePackageId,
        skillKey: definition.key,
        label: definition.label,
        description: definition.description,
        iconType: 'film',
        category: 'minimax-h3',
        uiMode: 'WORKSPACE',
        executionMode: 'PLANNER_THEN_GENERATE',
        workflowType: 'h3-video',
        plannerModelCategory: 'CHAT',
        expectedImageCount: 0,
        isEnabled: false,
        isBuiltIn: true,
        sortOrder: 200 + index,
        configJson: {
          sourcePackageKey: 'minimax-h3',
          sourceArtifactPaths: definition.paths,
          requiresH3Provider: true,
          capabilityTier: 'video-planning',
        },
      },
      update: { sourcePackageId },
    })
  }
}

export const listSkillSourcePackages = async (currentUserId?: string) => {
  if (!isPrismaConfigured()) return []
  await ensureBuiltInSkillSources()
  const packages = await prisma.skillSourcePackage.findMany({
    where: { isEnabled: true, isTrusted: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, packageKey: true, name: true, repositoryUrl: true, licenseUrl: true,
      sourceRevision: true, integritySha256: true, termsVersion: true, complianceJson: true,
      isEnabled: true, updatedAt: true,
      _count: { select: { artifacts: true, skills: true } },
      ...(currentUserId ? {
        acceptances: {
          where: { userId: currentUserId },
          select: { termsVersion: true, countryCode: true, acceptedAt: true },
          orderBy: { acceptedAt: 'desc' },
          take: 1,
        },
      } : {}),
    },
  })
  return packages.map((item: any) => ({
    ...item,
    complianceJson: asObject(item.complianceJson),
    accepted: Boolean(item.acceptances?.some((entry: any) => entry.termsVersion === item.termsVersion)),
    acceptedAt: item.acceptances?.[0]?.acceptedAt?.toISOString?.() || null,
    countryCode: item.acceptances?.[0]?.countryCode || null,
    artifactCount: item._count?.artifacts || 0,
    skillCount: item._count?.skills || 0,
    updatedAt: item.updatedAt.toISOString(),
    acceptances: undefined,
  }))
}

const fetchText = async (url: string) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`H3 文档同步失败：${response.status} ${url}`)
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > 2 * 1024 * 1024) throw new Error(`H3 文档超过允许大小：${url}`)
  const content = await response.text()
  if (!content.trim() || content.length > 2 * 1024 * 1024) throw new Error(`H3 文档为空或超过允许大小：${url}`)
  return content
}

/**
 * 只同步官方内置清单，不提供任意 URL 拉取能力，避免来源管理接口演化成 SSRF 通道。
 * 先解析 main 当前 SHA，随后全部按 SHA 下载，使一次同步中的所有文档可复现。
 */
export const syncMiniMaxH3SourceArtifacts = async () => {
  if (!isPrismaConfigured()) throw new Error('缺少 DATABASE_URL，暂时无法同步 H3 Skill 文档')
  const source = await ensureMiniMaxH3Source()
  if (!source) throw new Error('无法初始化 MiniMax H3 Skill 来源')
  const commitPayload = JSON.parse(await fetchText(`https://api.github.com/repos/${MINIMAX_H3_REPOSITORY}/commits/main`)) as { sha?: unknown }
  const revision = String(commitPayload.sha || '').trim()
  if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error('未能解析 MiniMax H3 的有效提交版本')
  const artifacts = [] as Array<{
    sourcePackageId: string
    artifactPath: string
    artifactType: string
    locale: string | null
    content: string
    integritySha256: string
    metadataJson: JsonRecord
  }>
  for (const artifactPath of MINIMAX_H3_ARTIFACT_PATHS) {
    const content = await fetchText(`https://raw.githubusercontent.com/${MINIMAX_H3_REPOSITORY}/${revision}/${artifactPath}`)
    artifacts.push({
      sourcePackageId: source.id,
      artifactPath,
      artifactType: artifactPath.endsWith('.md') ? 'skill-markdown' : 'skill-reference',
      locale: artifactPath.endsWith('SKILL.cn.md') ? 'zh-CN' : artifactPath.endsWith('SKILL.md') ? 'en' : null,
      content,
      integritySha256: sha256(content),
      metadataJson: { repository: MINIMAX_H3_REPOSITORY, revision, remotePath: artifactPath },
    })
  }
  const packageIntegrity = sha256(artifacts.map(item => `${item.artifactPath}:${item.integritySha256}`).join('\n'))
  await prisma.$transaction(async (tx) => {
    for (const artifact of artifacts) {
      await tx.skillSourceArtifact.upsert({
        where: { sourcePackageId_artifactPath: { sourcePackageId: artifact.sourcePackageId, artifactPath: artifact.artifactPath } },
        create: artifact,
        update: {
          artifactType: artifact.artifactType,
          locale: artifact.locale,
          content: artifact.content,
          integritySha256: artifact.integritySha256,
          metadataJson: artifact.metadataJson,
        },
      })
    }
    await tx.skillSourcePackage.update({
      where: { id: source.id },
      data: { sourceRevision: revision, integritySha256: packageIntegrity },
    })
  })
  await ensureMiniMaxH3SkillDefinitions(source.id)
  return {
    packageKey: source.packageKey,
    sourceRevision: revision,
    artifactCount: artifacts.length,
    integritySha256: packageIntegrity,
  }
}

export const upsertSkillSourcePackage = async (payload: unknown) => {
  if (!isPrismaConfigured()) throw new Error('缺少 DATABASE_URL，暂时无法保存 Skill 来源')
  const input = asObject(payload) || {}
  const packageKey = normalizeKey(input.packageKey, '来源标识')
  const name = normalizeKey(input.name, '来源名称', 191)
  const complianceJson = asObject(input.complianceJson)
  return prisma.skillSourcePackage.upsert({
    where: { packageKey },
    create: {
      packageKey,
      name,
      repositoryUrl: String(input.repositoryUrl || '').trim() || null,
      licenseUrl: String(input.licenseUrl || '').trim() || null,
      sourceRevision: String(input.sourceRevision || '').trim() || null,
      integritySha256: String(input.integritySha256 || '').trim() || null,
      termsVersion: String(input.termsVersion || '').trim() || null,
      complianceJson,
      isTrusted: input.isTrusted === true,
      isEnabled: input.isEnabled !== false,
    },
    update: {
      name,
      repositoryUrl: String(input.repositoryUrl || '').trim() || null,
      licenseUrl: String(input.licenseUrl || '').trim() || null,
      sourceRevision: String(input.sourceRevision || '').trim() || null,
      integritySha256: String(input.integritySha256 || '').trim() || null,
      termsVersion: String(input.termsVersion || '').trim() || null,
      complianceJson,
      isTrusted: input.isTrusted === true,
      isEnabled: input.isEnabled !== false,
    },
  })
}

export const importSkillSourceArtifacts = async (packageKey: string, payload: unknown) => {
  if (!isPrismaConfigured()) throw new Error('缺少 DATABASE_URL，暂时无法导入 Skill 文档')
  const input = asObject(payload) || {}
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : []
  if (!artifacts.length) throw new Error('至少需要一个 Skill 文档')
  const source = await prisma.skillSourcePackage.findUnique({ where: { packageKey } })
  if (!source) throw new Error('Skill 来源不存在')
  const rows = artifacts.map((artifact, index) => {
    const item = asObject(artifact) || {}
    const artifactPath = normalizeKey(item.path, `第 ${index + 1} 个文档路径`, 500)
    const content = String(item.content || '')
    if (!content.trim()) throw new Error(`第 ${index + 1} 个 Skill 文档内容不能为空`)
    return {
      sourcePackageId: source.id,
      artifactPath,
      artifactType: normalizeKey(item.type || 'skill-markdown', `第 ${index + 1} 个文档类型`, 50),
      locale: String(item.locale || '').trim() || null,
      content,
      integritySha256: sha256(content),
      metadataJson: asObject(item.metadataJson),
    }
  })
  await prisma.$transaction(rows.map(row => prisma.skillSourceArtifact.upsert({
    where: { sourcePackageId_artifactPath: { sourcePackageId: row.sourcePackageId, artifactPath: row.artifactPath } },
    create: row,
    update: {
      artifactType: row.artifactType,
      locale: row.locale,
      content: row.content,
      integritySha256: row.integritySha256,
      metadataJson: row.metadataJson,
    },
  })))
  return prisma.skillSourceArtifact.findMany({ where: { sourcePackageId: source.id }, orderBy: { artifactPath: 'asc' } })
}

/** 只向运行时提供管理员绑定的冻结文档，不在执行时拉取远程仓库。 */
export const loadSkillSourceInstructions = async (packageKey: string, artifactPaths: string[]) => {
  if (!isPrismaConfigured() || !packageKey || !artifactPaths.length) return []
  const source = await prisma.skillSourcePackage.findFirst({
    where: { packageKey, isTrusted: true, isEnabled: true },
    select: { id: true },
  })
  if (!source) return []
  const artifacts = await prisma.skillSourceArtifact.findMany({
    where: { sourcePackageId: source.id, artifactPath: { in: artifactPaths } },
    select: { artifactPath: true, content: true, integritySha256: true },
    orderBy: { artifactPath: 'asc' },
  })
  return artifacts.map(item => ({ ...item, content: item.content.slice(0, 24_000) }))
}

const readTrustedRequestCountryCode = (req: any) => {
  const headers = req?.headers || {}
  const raw = headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || headers['x-geo-country']
  return normalizeCountryCode(Array.isArray(raw) ? raw[0] : raw)
}

export const acceptSkillSourceTerms = async (input: { userId: string; packageKey: string; req: any }) => {
  if (!isPrismaConfigured()) throw new Error('缺少 DATABASE_URL，暂时无法确认 Skill 条款')
  const source = await prisma.skillSourcePackage.findFirst({
    where: { packageKey: input.packageKey, isTrusted: true, isEnabled: true },
  })
  if (!source?.termsVersion) throw new Error('该 Skill 来源未配置可确认的条款版本')
  const countryCode = readTrustedRequestCountryCode(input.req)
  if (!countryCode) throw new Error('无法从受信代理确认所在国家/地区，暂不能启用该 Skill')
  if (source.packageKey === 'minimax-h3' && H3_EXCLUDED_COUNTRIES.has(countryCode)) {
    throw new Error('MiniMax H3 当前不在你所在国家/地区提供服务')
  }
  return prisma.skillComplianceAcceptance.upsert({
    where: { userId_sourcePackageId_termsVersion: { userId: input.userId, sourcePackageId: source.id, termsVersion: source.termsVersion } },
    create: { userId: input.userId, sourcePackageId: source.id, termsVersion: source.termsVersion, countryCode },
    update: { countryCode, acceptedAt: new Date() },
  })
}

/** 在任务入队前二次校验，避免只依赖前端的条款勾选状态。 */
export const assertSkillSourceAvailableForUser = async (userId: string, skillKey: string) => {
  if (!isPrismaConfigured() || !skillKey) return
  const skill = await prisma.aiSkill.findFirst({
    where: { skillKey, isEnabled: true },
    include: { sourcePackage: true },
  })
  const source = skill?.sourcePackage
  if (!source) return
  if (!source.isEnabled || !source.isTrusted) throw new Error('该 Skill 来源当前未获信任或已停用')
  if (!source.termsVersion) return
  const acceptance = await prisma.skillComplianceAcceptance.findUnique({
    where: { userId_sourcePackageId_termsVersion: { userId, sourcePackageId: source.id, termsVersion: source.termsVersion } },
  })
  if (!acceptance) throw new Error('请先确认该 Skill 的许可证与使用限制')
  if (source.packageKey === 'minimax-h3' && H3_EXCLUDED_COUNTRIES.has(acceptance.countryCode)) {
    throw new Error('MiniMax H3 当前不在你所在国家/地区提供服务')
  }
}

/** H3 也可以从画布的视频节点直接调用，因此按 Provider 再校验一次许可证状态。 */
export const assertProviderSourceAvailableForUser = async (userId: string, providerId: string) => {
  if (!isPrismaConfigured() || !providerId) return
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId }, select: { code: true, extraJson: true } })
  const extraJson = asObject(provider?.extraJson)
  const isH3 = String(provider?.code || '').trim().toLowerCase() === 'minimax-h3'
    || String(extraJson?.adapter || '').trim().toLowerCase() === 'minimax-h3'
  if (!isH3) return
  const source = await ensureMiniMaxH3Source()
  if (!source?.termsVersion || !source.isEnabled || !source.isTrusted) throw new Error('MiniMax H3 Skill 来源当前不可用')
  const acceptance = await prisma.skillComplianceAcceptance.findUnique({
    where: { userId_sourcePackageId_termsVersion: { userId, sourcePackageId: source.id, termsVersion: source.termsVersion } },
  })
  if (!acceptance) throw new Error('请先确认 MiniMax H3 的许可证与使用限制')
  if (H3_EXCLUDED_COUNTRIES.has(acceptance.countryCode)) throw new Error('MiniMax H3 当前不在你所在国家/地区提供服务')
}
