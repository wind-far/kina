import crypto from 'node:crypto'
import { promisify } from 'node:util'
import type { AuthMethodCategory, AuthMethodType, VerificationChannel } from '@prisma/client'
import prisma from '../db/prisma'
import { grantRegisterReward } from '../marketing-center/service'
import { invalidateRedisCaches } from '../redis/cache-manager'
import { getOrSetJsonCache } from '../redis/json-cache'
import { redisKeys } from '../redis/keys'
import type { AuthMethodConfigPayload, AuthUserProfile, PublicAuthMethod } from './types'

// 验证码默认有效期，单位分钟。
const DEFAULT_LOGIN_CODE_EXPIRE_MINUTES = 5

// 会话默认有效期，单位天。
const DEFAULT_SESSION_EXPIRE_DAYS = 30

// 会话 Cookie 名称。
export const AUTH_SESSION_COOKIE_NAME = 'canana_session'

const AUTH_METHOD_LIST_CACHE_KEY = redisKeys.cache('auth-method', 'list:all')
const AUTH_METHOD_ENABLED_LIST_CACHE_KEY = redisKeys.cache('auth-method', 'list:enabled')
const buildAuthMethodDetailCacheKey = (methodType: AuthMethodType) => redisKeys.cache('auth-method', `detail:${methodType}`)

// 默认登录方式配置。
const DEFAULT_AUTH_METHOD_CONFIGS: AuthMethodConfigPayload[] = [
  {
    methodType: 'ADMIN_PASSWORD',
    category: 'PASSWORD',
    displayName: '管理员账号登录',
    description: '使用管理员账号和密码登录',
    iconType: 'admin',
    isEnabled: true,
    isVisible: true,
    sortOrder: 5,
    allowAutoFill: false,
    allowSignUp: false,
    config: {
      targetLabel: '管理员账号',
      placeholder: '请输入管理员账号',
      passwordPlaceholder: '请输入登录密码',
    },
  },
  {
    methodType: 'PHONE_CODE',
    category: 'CODE',
    displayName: '手机号登录',
    description: '使用短信验证码登录',
    iconType: 'phone',
    isEnabled: true,
    isVisible: true,
    sortOrder: 10,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '手机号',
      placeholder: '请输入手机号',
      codePlaceholder: '请输入验证码',
    },
  },
  {
    methodType: 'EMAIL_CODE',
    category: 'CODE',
    displayName: '邮箱登录',
    description: '使用邮箱验证码登录',
    iconType: 'mail',
    isEnabled: true,
    isVisible: true,
    sortOrder: 20,
    allowAutoFill: true,
    allowSignUp: true,
    config: {
      targetLabel: '邮箱',
      placeholder: '请输入邮箱',
      codePlaceholder: '请输入验证码',
    },
  },
  {
    methodType: 'WECHAT_OAUTH',
    category: 'OAUTH',
    displayName: '微信登录',
    description: '使用微信账号登录',
    iconType: 'wechat',
    isEnabled: false,
    isVisible: true,
    sortOrder: 30,
    allowAutoFill: false,
    allowSignUp: true,
    config: {},
  },
  {
    methodType: 'GITHUB_OAUTH',
    category: 'OAUTH',
    displayName: 'GitHub 登录',
    description: '使用 GitHub 账号登录',
    iconType: 'github',
    isEnabled: false,
    isVisible: true,
    sortOrder: 40,
    allowAutoFill: false,
    allowSignUp: true,
    config: {},
  },
  {
    methodType: 'GOOGLE_OAUTH',
    category: 'OAUTH',
    displayName: 'Google 登录',
    description: '使用 Google 账号登录',
    iconType: 'google',
    isEnabled: false,
    isVisible: true,
    sortOrder: 50,
    allowAutoFill: false,
    allowSignUp: true,
    config: {},
  },
]

// 手机号是否合法。
export const isValidPhone = (phone: string) => /^1\d{10}$/.test(phone)

// 邮箱是否合法。
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// 脱敏手机号。
export const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

// 脱敏邮箱。
export const maskEmail = (email: string) => {
  const normalizedEmail = email.trim()
  const splitIndex = normalizedEmail.indexOf('@')
  if (splitIndex <= 1) return normalizedEmail
  const prefix = normalizedEmail.slice(0, splitIndex)
  const suffix = normalizedEmail.slice(splitIndex)
  return `${prefix.slice(0, 1)}***${suffix}`
}

// 生成默认昵称。
const buildDefaultUserName = (identifier: string) => `用户${identifier.slice(-4)}`

// 管理员用户名校验规则。
export const isValidAdminUsername = (username: string) => /^[a-zA-Z][a-zA-Z0-9_-]{3,31}$/.test(username)

// 管理员密码校验规则。
export const isValidAdminPassword = (password: string) => password.length >= 8 && password.length <= 64

// 生成 6 位随机验证码。
export const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000))

// 生成会话令牌。
export const generateSessionToken = () => crypto.randomBytes(24).toString('base64url')

// 计算会话令牌哈希。
export const hashSessionToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

const scryptAsync = promisify(crypto.scrypt)

// 生成用户密码哈希。
export const hashUserPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

// 校验用户密码。
export const verifyUserPassword = async (password: string, passwordHash: string | null | undefined) => {
  const normalizedHash = String(passwordHash || '').trim()
  if (!normalizedHash.startsWith('scrypt:')) {
    return false
  }

  const [, salt, expectedHash] = normalizedHash.split(':')
  if (!salt || !expectedHash) {
    return false
  }

  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  const expectedBuffer = Buffer.from(expectedHash, 'hex')

  return expectedBuffer.length === derivedKey.length
    && crypto.timingSafeEqual(expectedBuffer, derivedKey)
}

// 读取验证码有效期。
const readLoginCodeExpireMinutes = () => {
  const rawValue = Number(process.env.AUTH_LOGIN_CODE_EXPIRE_MINUTES || DEFAULT_LOGIN_CODE_EXPIRE_MINUTES)
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_LOGIN_CODE_EXPIRE_MINUTES
}

// 读取会话有效期。
const readSessionExpireDays = () => {
  const rawValue = Number(process.env.AUTH_SESSION_EXPIRE_DAYS || DEFAULT_SESSION_EXPIRE_DAYS)
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_SESSION_EXPIRE_DAYS
}

// 标准化前端可见登录方式配置。
const toPublicAuthMethod = (item: {
  methodType: AuthMethodType
  category: AuthMethodCategory
  displayName: string
  description: string | null
  iconType: string | null
  iconUrl: string | null
  isEnabled: boolean
  isVisible: boolean
  sortOrder: number
  allowAutoFill: boolean
  allowSignUp: boolean
  configJson: any
}): PublicAuthMethod => {
  return {
    methodType: item.methodType,
    category: item.category,
    displayName: item.displayName,
    description: String(item.description || '').trim(),
    iconType: String(item.iconType || '').trim(),
    iconUrl: String(item.iconUrl || '').trim(),
    isEnabled: item.isEnabled,
    isVisible: item.isVisible,
    sortOrder: item.sortOrder,
    allowAutoFill: item.allowAutoFill,
    allowSignUp: item.allowSignUp,
    config: item.configJson && typeof item.configJson === 'object' ? item.configJson as Record<string, any> : {},
  }
}

// 标准化登录配置写入结构。
const normalizeAuthMethodConfigPayload = (payload: AuthMethodConfigPayload): AuthMethodConfigPayload => {
  return {
    methodType: payload.methodType,
    category: payload.category,
    displayName: String(payload.displayName || '').trim() || payload.methodType,
    description: String(payload.description || '').trim(),
    iconType: String(payload.iconType || '').trim(),
    iconUrl: String(payload.iconUrl || '').trim(),
    isEnabled: payload.isEnabled !== false,
    isVisible: payload.isVisible !== false,
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
    allowAutoFill: payload.allowAutoFill !== false,
    allowSignUp: payload.allowSignUp !== false,
    config: payload.config && typeof payload.config === 'object' ? payload.config : {},
  }
}

const invalidateAuthMethodCaches = async (methodTypes: AuthMethodType[] = []) => {
  const normalizedMethodTypes = Array.from(new Set(
    methodTypes
      .map(item => String(item || '').trim())
      .filter(Boolean) as AuthMethodType[],
  ))

  await invalidateRedisCaches([
    AUTH_METHOD_LIST_CACHE_KEY,
    AUTH_METHOD_ENABLED_LIST_CACHE_KEY,
    ...normalizedMethodTypes.map(item => buildAuthMethodDetailCacheKey(item)),
  ])
}

const findDefaultAuthMethodConfig = (methodType: AuthMethodType) => {
  return DEFAULT_AUTH_METHOD_CONFIGS.find(item => item.methodType === methodType) || null
}

// 确保默认登录方式配置存在。
export const ensureDefaultAuthMethodConfigs = async () => {
  const existingCount = await prisma.authMethodConfig.count()
  if (existingCount > 0) {
    return
  }

  await prisma.authMethodConfig.createMany({
    data: DEFAULT_AUTH_METHOD_CONFIGS.map(item => ({
      methodType: item.methodType,
      category: item.category,
      displayName: item.displayName,
      description: item.description || null,
      iconType: item.iconType || null,
      iconUrl: item.iconUrl || null,
      isEnabled: item.isEnabled !== false,
      isVisible: item.isVisible !== false,
      sortOrder: item.sortOrder || 0,
      allowAutoFill: item.allowAutoFill !== false,
      allowSignUp: item.allowSignUp !== false,
      configJson: item.config || {},
    })),
  })
}

// 确保指定登录方式配置存在。
// 这里不能只判断整张表是否为空，因为数据库可能已经有部分方式，
// 但缺少 ADMIN_PASSWORD 这类后续新增的方式。
export const ensureAuthMethodConfigExists = async (methodType: AuthMethodType) => {
  const defaultConfig = findDefaultAuthMethodConfig(methodType)
  if (!defaultConfig) {
    throw new Error(`缺少 ${methodType} 的默认登录方式配置定义`)
  }

  await prisma.authMethodConfig.upsert({
    where: {
      methodType,
    },
    update: {},
    create: {
      methodType: defaultConfig.methodType,
      category: defaultConfig.category,
      displayName: defaultConfig.displayName,
      description: defaultConfig.description || null,
      iconType: defaultConfig.iconType || null,
      iconUrl: defaultConfig.iconUrl || null,
      isEnabled: defaultConfig.isEnabled !== false,
      isVisible: defaultConfig.isVisible !== false,
      sortOrder: defaultConfig.sortOrder || 0,
      allowAutoFill: defaultConfig.allowAutoFill !== false,
      allowSignUp: defaultConfig.allowSignUp !== false,
      configJson: defaultConfig.config || {},
    },
  })
}

// 获取所有登录方式配置。
export const listAuthMethodConfigs = async () => {
  return getOrSetJsonCache({
    key: AUTH_METHOD_LIST_CACHE_KEY,
    ttlSeconds: 600,
    factory: async () => {
      await ensureDefaultAuthMethodConfigs()
      const rows = await prisma.authMethodConfig.findMany({
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      })

      return rows.map(toPublicAuthMethod)
    },
  })
}

// 获取前台启用的登录方式配置。
export const listEnabledAuthMethods = async () => {
  return getOrSetJsonCache({
    key: AUTH_METHOD_ENABLED_LIST_CACHE_KEY,
    ttlSeconds: 600,
    factory: async () => {
      const rows = await listAuthMethodConfigs()
      return rows.filter(item => item.isEnabled && item.isVisible)
    },
  })
}

// 读取指定登录方式配置。
export const getAuthMethodConfig = async (methodType: AuthMethodType) => {
  return getOrSetJsonCache({
    key: buildAuthMethodDetailCacheKey(methodType),
    ttlSeconds: 600,
    factory: async () => {
      await ensureDefaultAuthMethodConfigs()
      const row = await prisma.authMethodConfig.findUnique({
        where: {
          methodType,
        },
      })

      if (!row) {
        throw new Error('登录方式配置不存在')
      }

      return toPublicAuthMethod(row)
    },
  })
}

// 批量保存登录方式配置。
export const saveAuthMethodConfigs = async (payload: AuthMethodConfigPayload[]) => {
  await ensureDefaultAuthMethodConfigs()

  const normalizedItems = payload.map(normalizeAuthMethodConfigPayload)
  const methodTypes = normalizedItems.map(item => item.methodType)
  const existingRows = await prisma.authMethodConfig.findMany({
    select: {
      methodType: true,
    },
  })
  const relatedMethodTypes = Array.from(new Set([
    ...existingRows.map(item => item.methodType),
    ...methodTypes,
  ]))

  await prisma.$transaction(async (tx) => {
    if (methodTypes.length) {
      await tx.authMethodConfig.deleteMany({
        where: {
          methodType: {
            notIn: methodTypes,
          },
        },
      })
    }

    for (const item of normalizedItems) {
      await tx.authMethodConfig.upsert({
        where: {
          methodType: item.methodType,
        },
        update: {
          category: item.category,
          displayName: item.displayName,
          description: item.description || null,
          iconType: item.iconType || null,
          iconUrl: item.iconUrl || null,
          isEnabled: item.isEnabled !== false,
          isVisible: item.isVisible !== false,
          sortOrder: item.sortOrder || 0,
          allowAutoFill: item.allowAutoFill !== false,
          allowSignUp: item.allowSignUp !== false,
          configJson: item.config || {},
        },
        create: {
          methodType: item.methodType,
          category: item.category,
          displayName: item.displayName,
          description: item.description || null,
          iconType: item.iconType || null,
          iconUrl: item.iconUrl || null,
          isEnabled: item.isEnabled !== false,
          isVisible: item.isVisible !== false,
          sortOrder: item.sortOrder || 0,
          allowAutoFill: item.allowAutoFill !== false,
          allowSignUp: item.allowSignUp !== false,
          configJson: item.config || {},
        },
      })
    }
  })

  await invalidateAuthMethodCaches(relatedMethodTypes)
  return listAuthMethodConfigs()
}

// 清理指定目标的过期验证码。
export const clearExpiredVerificationCodes = async (methodType: AuthMethodType, target: string) => {
  await prisma.authVerificationCode.deleteMany({
    where: {
      methodType,
      target,
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

// 创建新的验证码记录。
export const createVerificationCodeRecord = async (input: {
  methodType: AuthMethodType
  channel: VerificationChannel
  target: string
  requesterIp?: string
  userAgent?: string
}) => {
  const expiresAt = new Date(Date.now() + readLoginCodeExpireMinutes() * 60 * 1000)
  const code = generateVerificationCode()

  await clearExpiredVerificationCodes(input.methodType, input.target)

  await prisma.authVerificationCode.updateMany({
    where: {
      methodType: input.methodType,
      target: input.target,
      scene: 'login',
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    data: {
      usedAt: new Date(),
    },
  })

  const record = await prisma.authVerificationCode.create({
    data: {
      methodType: input.methodType,
      channel: input.channel,
      scene: 'login',
      target: input.target,
      code,
      expiresAt,
      requesterIp: String(input.requesterIp || '').trim() || null,
      userAgent: String(input.userAgent || '').trim() || null,
    },
  })

  return {
    id: record.id,
    target: input.target,
    channel: input.channel,
    code,
    expiresAt: expiresAt.toISOString(),
  }
}

// 消费验证码记录。
export const consumeVerificationCodeRecord = async (input: {
  methodType: AuthMethodType
  target: string
  code: string
}) => {
  const record = await prisma.authVerificationCode.findFirst({
    where: {
      methodType: input.methodType,
      target: input.target,
      scene: 'login',
      code: input.code,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!record) {
    throw new Error('验证码无效或已过期')
  }

  await prisma.authVerificationCode.update({
    where: {
      id: record.id,
    },
    data: {
      usedAt: new Date(),
    },
  })

  return record
}

// 获取或创建用户身份。
export const resolveUserByIdentifier = async (input: {
  methodType: AuthMethodType
  identifier: string
  allowSignUp: boolean
}) => {
  const existingIdentity = await prisma.appUserAuthIdentity.findUnique({
    where: {
      methodType_identifier: {
        methodType: input.methodType,
        identifier: input.identifier,
      },
    },
    include: {
      user: true,
    },
  })

  if (existingIdentity?.user) {
    return { user: existingIdentity.user, isNewUser: false }
  }

  const existingUser = input.methodType === 'PHONE_CODE'
    ? await prisma.appUser.findUnique({
        where: {
          phone: input.identifier,
        },
      })
    : input.methodType === 'EMAIL_CODE'
      ? await prisma.appUser.findUnique({
          where: {
            email: input.identifier,
          },
        })
      : null

  if (existingUser) {
    await prisma.appUserAuthIdentity.upsert({
      where: {
        methodType_identifier: {
          methodType: input.methodType,
          identifier: input.identifier,
        },
      },
      update: {
        isVerified: true,
        verifiedAt: new Date(),
      },
      create: {
        userId: existingUser.id,
        methodType: input.methodType,
        identifier: input.identifier,
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    return { user: existingUser, isNewUser: false }
  }

  if (!input.allowSignUp) {
    throw new Error('当前登录方式不允许自动注册')
  }

  const nextUser = await prisma.appUser.create({
    data: {
      name: buildDefaultUserName(input.identifier),
      phone: input.methodType === 'PHONE_CODE' ? input.identifier : null,
      email: input.methodType === 'EMAIL_CODE' ? input.identifier : null,
      status: 'ACTIVE',
      authIdentities: {
        create: {
          methodType: input.methodType,
          identifier: input.identifier,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
  })

  await grantRegisterReward(nextUser.id)

  return { user: nextUser, isNewUser: true }
}

// 按管理员账号查询用户。
export const getUserByUsername = async (username: string) => {
  const normalizedUsername = String(username || '').trim()
  if (!normalizedUsername) {
    return null
  }

  return prisma.appUser.findUnique({
    where: {
      username: normalizedUsername,
    },
  })
}

// 更新验证码记录绑定的用户。
export const attachVerificationCodeUser = async (verificationCodeId: string, userId: string) => {
  await prisma.authVerificationCode.update({
    where: {
      id: verificationCodeId,
    },
    data: {
      userId,
    },
  })
}

// 建立会话。
export const createUserSession = async (input: {
  userId: string
  methodType: AuthMethodType
  identifierSnapshot?: string
  requesterIp?: string
  userAgent?: string
}) => {
  const sessionToken = generateSessionToken()
  const sessionExpiresAt = new Date(Date.now() + readSessionExpireDays() * 24 * 60 * 60 * 1000)

  await prisma.appSession.create({
    data: {
      userId: input.userId,
      tokenHash: hashSessionToken(sessionToken),
      authMethodType: input.methodType,
      identifierSnapshot: String(input.identifierSnapshot || '').trim() || null,
      ipAddress: String(input.requesterIp || '').trim() || null,
      userAgent: String(input.userAgent || '').trim() || null,
      expiresAt: sessionExpiresAt,
      lastActiveAt: new Date(),
    },
  })

  return {
    token: sessionToken,
    expiresAt: sessionExpiresAt.toISOString(),
  }
}

// 标准化用户资料。
export const toAuthUserProfile = (user: {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatarUrl: string | null
  role: 'USER' | 'ADMIN' | null
}, loginMethodType: AuthMethodType): AuthUserProfile => {
  const phone = String(user.phone || '').trim()
  const email = String(user.email || '').trim()

  return {
    id: user.id,
    name: String(user.name || '').trim() || buildDefaultUserName(phone || email || user.id),
    phone,
    email,
    maskedPhone: maskPhone(phone),
    maskedEmail: maskEmail(email),
    avatarUrl: String(user.avatarUrl || '').trim(),
    role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    loginMethodType,
  }
}

// 通过会话令牌查询当前用户。
export const getUserBySessionToken = async (sessionToken: string) => {
  const normalizedToken = sessionToken.trim()
  if (!normalizedToken) {
    return null
  }

  const session = await prisma.appSession.findFirst({
    where: {
      tokenHash: hashSessionToken(normalizedToken),
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      authMethodType: true,
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  })

  if (!session?.user) {
    return null
  }

  await prisma.appSession.update({
    where: {
      id: session.id,
    },
    data: {
      lastActiveAt: new Date(),
    },
  })

  return toAuthUserProfile(session.user, session.authMethodType)
}

// 撤销当前会话。
export const revokeSessionToken = async (sessionToken: string) => {
  const normalizedToken = sessionToken.trim()
  if (!normalizedToken) {
    return
  }

  await prisma.appSession.updateMany({
    where: {
      tokenHash: hashSessionToken(normalizedToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

// 读取会话 Cookie 最大存活秒数。
export const getSessionCookieMaxAge = () => readSessionExpireDays() * 24 * 60 * 60
