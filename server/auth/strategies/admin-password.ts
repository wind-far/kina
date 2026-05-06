import type { AuthStrategy } from '../types'
import { createUserSession, getUserByUsername, isValidAdminPassword, isValidAdminUsername, toAuthUserProfile, verifyUserPassword } from '../service'

// 管理员账号密码登录策略。
export const adminPasswordStrategy: AuthStrategy = {
  methodType: 'ADMIN_PASSWORD',
  category: 'PASSWORD',
  canLoginWithCode: true,
  async login(context) {
    const username = String(context.target || '').trim()
    const password = String(context.password || '')

    if (!isValidAdminUsername(username)) {
      throw new Error('请输入 4-32 位管理员账号，只能包含字母、数字、下划线或中划线')
    }

    if (!isValidAdminPassword(password)) {
      throw new Error('请输入 8-64 位登录密码')
    }

    const user = await getUserByUsername(username)
    if (!user || user.role !== 'ADMIN') {
      throw new Error('管理员账号或密码错误')
    }

    const passwordMatched = await verifyUserPassword(password, user.passwordHash)
    if (!passwordMatched) {
      throw new Error('管理员账号或密码错误')
    }

    const session = await createUserSession({
      userId: user.id,
      methodType: 'ADMIN_PASSWORD',
      identifierSnapshot: username,
      requesterIp: context.requesterIp,
      userAgent: context.userAgent,
    })

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUserProfile(user, 'ADMIN_PASSWORD'),
    }
  },
}
