import type { AuthStrategy } from '../types'
import { attachVerificationCodeUser, consumeVerificationCodeRecord, createUserSession, createVerificationCodeRecord, getAuthMethodConfig, isValidPhone, resolveUserByIdentifier, toAuthUserProfile } from '../service'

// 手机验证码登录策略。
export const phoneCodeStrategy: AuthStrategy = {
  methodType: 'PHONE_CODE',
  category: 'CODE',
  canSendCode: true,
  canLoginWithCode: true,
  async sendCode(context) {
    const phone = context.target.trim()
    if (!isValidPhone(phone)) {
      throw new Error('请输入正确的手机号')
    }

    const record = await createVerificationCodeRecord({
      methodType: 'PHONE_CODE',
      channel: 'PHONE',
      target: phone,
      requesterIp: context.requesterIp,
      userAgent: context.userAgent,
    })

    return {
      id: record.id,
      target: phone,
      channel: 'PHONE',
      expiresAt: record.expiresAt,
      debugCode: context.methodConfig.allowAutoFill ? record.code : undefined,
    }
  },
  async login(context) {
    const phone = String(context.target || '').trim()
    const code = String(context.code || '').trim()

    if (!isValidPhone(phone)) {
      throw new Error('请输入正确的手机号')
    }

    if (!/^\d{6}$/.test(code)) {
      throw new Error('请输入 6 位验证码')
    }

    const verificationRecord = await consumeVerificationCodeRecord({
      methodType: 'PHONE_CODE',
      target: phone,
      code,
    })

    const currentMethodConfig = await getAuthMethodConfig('PHONE_CODE')
    const user = await resolveUserByIdentifier({
      methodType: 'PHONE_CODE',
      identifier: phone,
      allowSignUp: currentMethodConfig.allowSignUp,
    })

    await attachVerificationCodeUser(verificationRecord.id, user.id)

    const session = await createUserSession({
      userId: user.id,
      methodType: 'PHONE_CODE',
      identifierSnapshot: phone,
      requesterIp: context.requesterIp,
      userAgent: context.userAgent,
    })

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toAuthUserProfile(user, 'PHONE_CODE'),
    }
  },
}
