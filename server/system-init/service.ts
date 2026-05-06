import crypto from 'node:crypto'
import prisma from '../db/prisma'
import { AUTH_SESSION_COOKIE_NAME, createUserSession, ensureAuthMethodConfigExists, getSessionCookieMaxAge, hashUserPassword, isValidAdminPassword, isValidAdminUsername, toAuthUserProfile } from '../auth/service'
import { invalidateSystemConfigCaches, getAdminSystemConfig, saveAdminSystemConfig } from '../system-config/service'

const SYSTEM_INIT_STATUS_CODE = 'SYSTEM_INIT_STATUS'
const SYSTEM_INIT_STATUS_NAME = '系统初始化状态'

export interface SystemInitStatus {
  isInitialized: boolean
  initializedAt: string
  adminUserId: string
  adminUsername: string
  siteName: string
}

const createDefaultSystemInitStatus = (): SystemInitStatus => ({
  isInitialized: false,
  initializedAt: '',
  adminUserId: '',
  adminUsername: '',
  siteName: '',
})

const normalizeSystemInitStatus = (value: unknown): SystemInitStatus => {
  if (!value || typeof value !== 'object') {
    return createDefaultSystemInitStatus()
  }

  const record = value as Record<string, any>
  return {
    isInitialized: record.isInitialized === true,
    initializedAt: String(record.initializedAt || '').trim(),
    adminUserId: String(record.adminUserId || '').trim(),
    adminUsername: String(record.adminUsername || '').trim(),
    siteName: String(record.siteName || '').trim(),
  }
}

const readStoredSystemInitStatus = async () => {
  const row = await prisma.systemSetting.findUnique({
    where: {
      code: SYSTEM_INIT_STATUS_CODE,
    },
  })

  return normalizeSystemInitStatus(row?.configJson)
}

const writeStoredSystemInitStatus = async (payload: SystemInitStatus) => {
  await prisma.systemSetting.upsert({
    where: {
      code: SYSTEM_INIT_STATUS_CODE,
    },
    update: {
      name: SYSTEM_INIT_STATUS_NAME,
      configJson: payload,
    },
    create: {
      id: crypto.randomUUID(),
      code: SYSTEM_INIT_STATUS_CODE,
      name: SYSTEM_INIT_STATUS_NAME,
      configJson: payload,
    },
  })
}

const buildLegacyInitializedStatus = async (): Promise<SystemInitStatus | null> => {
  const adminUser = await prisma.appUser.findFirst({
    where: {
      role: 'ADMIN',
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  if (!adminUser) {
    const userCount = await prisma.appUser.count()
    if (!userCount) {
      return null
    }

    return {
      isInitialized: true,
      initializedAt: '',
      adminUserId: '',
      adminUsername: '',
      siteName: '',
    }
  }

  return {
    isInitialized: true,
    initializedAt: adminUser.createdAt.toISOString(),
    adminUserId: adminUser.id,
    adminUsername: String(adminUser.username || '').trim(),
    siteName: '',
  }
}

// 获取当前系统初始化状态。
export const getSystemInitStatus = async () => {
  const storedStatus = await readStoredSystemInitStatus()
  if (storedStatus.isInitialized) {
    return storedStatus
  }

  const legacyStatus = await buildLegacyInitializedStatus()
  if (!legacyStatus) {
    return storedStatus
  }

  await writeStoredSystemInitStatus(legacyStatus)
  return legacyStatus
}

const normalizeSiteText = (value: string | undefined, fallback = '') => String(value || '').trim() || fallback

// 首次安装初始化系统，创建首个管理员并写入站点信息。
export const initializeSystem = async (payload: {
  username?: string
  password?: string
  confirmPassword?: string
  name?: string
  email?: string
  siteName?: string
  siteDescription?: string
  siteLogoUrl?: string
  siteIconUrl?: string
  requesterIp?: string
  userAgent?: string
}) => {
  const currentStatus = await getSystemInitStatus()
  if (currentStatus.isInitialized) {
    throw new Error('系统已完成初始化，请直接登录')
  }

  const username = String(payload.username || '').trim()
  const password = String(payload.password || '')
  const confirmPassword = String(payload.confirmPassword || '')
  const name = normalizeSiteText(payload.name, '超级管理员')
  const email = String(payload.email || '').trim().toLowerCase()

  if (!isValidAdminUsername(username)) {
    throw new Error('管理员账号需为 4-32 位，并以字母开头，只能包含字母、数字、下划线或中划线')
  }

  if (!isValidAdminPassword(password)) {
    throw new Error('管理员密码需为 8-64 位')
  }

  if (password !== confirmPassword) {
    throw new Error('两次输入的管理员密码不一致')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('请输入正确的管理员邮箱')
  }

  const existedUser = await prisma.appUser.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  })

  if (existedUser) {
    throw new Error('管理员账号或邮箱已存在')
  }

  const passwordHash = await hashUserPassword(password)
  const systemConfig = await getAdminSystemConfig()
  const nextSiteName = normalizeSiteText(payload.siteName, systemConfig.siteInfo.siteName || 'Canana')
  const initializedAt = new Date().toISOString()

  // 先确保管理员密码登录方式配置存在，避免身份表写入时命中 method_type 外键约束。
  await ensureAuthMethodConfigExists('ADMIN_PASSWORD')

  const result = await prisma.$transaction(async (tx) => {
    const adminUser = await tx.appUser.create({
      data: {
        username,
        passwordHash,
        name,
        email: email || null,
        role: 'ADMIN',
        status: 'ACTIVE',
        authIdentities: {
          create: {
            methodType: 'ADMIN_PASSWORD',
            identifier: username,
            isVerified: true,
            verifiedAt: new Date(),
          },
        },
      },
    })

    await tx.systemSetting.upsert({
      where: {
        code: SYSTEM_INIT_STATUS_CODE,
      },
      update: {
        name: SYSTEM_INIT_STATUS_NAME,
        configJson: {
          isInitialized: true,
          initializedAt,
          adminUserId: adminUser.id,
          adminUsername: username,
          siteName: nextSiteName,
        },
      },
      create: {
        id: crypto.randomUUID(),
        code: SYSTEM_INIT_STATUS_CODE,
        name: SYSTEM_INIT_STATUS_NAME,
        configJson: {
          isInitialized: true,
          initializedAt,
          adminUserId: adminUser.id,
          adminUsername: username,
          siteName: nextSiteName,
        },
      },
    })

    return adminUser
  })

  await saveAdminSystemConfig({
    ...systemConfig,
    siteInfo: {
      ...systemConfig.siteInfo,
      siteName: nextSiteName,
      siteDescription: normalizeSiteText(payload.siteDescription, systemConfig.siteInfo.siteDescription),
      siteLogoUrl: normalizeSiteText(payload.siteLogoUrl, systemConfig.siteInfo.siteLogoUrl),
      siteIconUrl: normalizeSiteText(payload.siteIconUrl, systemConfig.siteInfo.siteIconUrl),
    },
    loginSettings: {
      ...systemConfig.loginSettings,
      welcomeTitle: systemConfig.loginSettings.welcomeTitle || '欢迎登录',
    },
  })

  await invalidateSystemConfigCaches()

  const session = await createUserSession({
    userId: result.id,
    methodType: 'ADMIN_PASSWORD',
    identifierSnapshot: username,
    requesterIp: payload.requesterIp,
    userAgent: payload.userAgent,
  })

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toAuthUserProfile(result, 'ADMIN_PASSWORD'),
    isInitialized: true,
  }
}

// 将初始化会话写回浏览器 Cookie。
export const buildSystemInitSessionCookie = (token: string) => {
  const cookieParts = [
    `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${getSessionCookieMaxAge()}`,
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  return cookieParts.join('; ')
}
