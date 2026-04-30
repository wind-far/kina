<template>
  <Teleport to="body">
    <Transition name="login-modal" :duration="{ enter: 280, leave: 200 }">
      <div
        v-if="visible"
        class="login-modal-host lv-modal-wrapper lv-modal-wrapper-align-center login-modal-wrapper"
        style="display: block"
      >
        <div
          aria-hidden="true"
          class="lv-modal-mask fadeModal-appear-done fadeModal-enter-done"
          style="display: block"
          @click="close"
        ></div>

        <div
          role="dialog"
          aria-modal="true"
          :aria-labelledby="dialogTitleId"
          class="lv-modal lv-modal-simple lv-modal-closable zoomModal-appear-done zoomModal-enter-done"
          @click.stop
        >
          <div data-focus-guard="true" tabindex="0" class="login-focus-guard-canana"></div>
          <div data-focus-lock-disabled="false" tabindex="-1">
            <div class="lv-modal-header">
              <div :id="dialogTitleId" class="lv-modal-title">
                <span>
                  <div class="title-UZtkUa">
<!--                    <img class="title-logo" :src="titleLogoSrc" alt="">-->
                    <div class="title-text-byG0WC">{{ welcomeTitle }}</div>
                  </div>
                  <div v-if="welcomeSubtitle" class="login-subtitle-canana">{{ welcomeSubtitle }}</div>
                </span>
              </div>
            </div>

            <div class="lv-modal-content">
              <div>
                <div v-if="codeMethods.length > 1" class="method-selector">
                  <button
                    v-for="method in codeMethods"
                    :key="method.methodType"
                    type="button"
                    class="method-tab"
                    :class="{ 'is-active-Mw7P8u': method.methodType === activeMethodType }"
                    @click="selectMethod(method.methodType)"
                  >
                    {{ method.displayName }}
                  </button>
                </div>

                <div class="fields-YBLaPC">
                  <div>
                    <div class="label-gB9Ufj">{{ currentTargetLabel }}</div>
                    <input
                      v-model="targetValue"
                      maxlength="100"
                      :placeholder="currentTargetPlaceholder"
                      class="lv-input lv-input-size-large input-pYC00w"
                      :disabled="isSubmitting"
                    >
                  </div>

                  <div v-if="currentCodeMethod">
                    <div class="label-gB9Ufj">验证码</div>
                    <div class="sms-row">
                      <input
                        v-model="codeValue"
                        maxlength="6"
                        :placeholder="currentCodePlaceholder"
                        class="lv-input lv-input-size-large input-pYC00w sms-input"
                        :disabled="isSubmitting"
                      >

                      <div class="sms-action">
                        <div class="sms-divider"></div>
                        <button
                          class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square sms-button"
                          :class="{ 'lv-btn-disabled': !canSendCode }"
                          type="button"
                          :disabled="!canSendCode"
                          @click="handleSendCode"
                        >
                          <span>{{ codeButtonText }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="footer-X7PPzE">
                  <button
                    class="lv-btn lv-btn-primary lv-btn-size-large lv-btn-shape-square confirm-button"
                    :class="{ 'lv-btn-disabled': !canSubmit }"
                    type="button"
                    :disabled="!canSubmit"
                    @click="handleSubmit"
                  >
                    <span>{{ isSubmitting ? '登录中...' : primaryButtonText }}</span>
                  </button>

                  <div v-if="oauthMethods.length" class="oauth-group">
                    <div class="oauth-title">其他登录方式</div>
                    <div class="oauth-buttons">
                      <button
                        v-for="method in oauthMethods"
                        :key="method.methodType"
                        type="button"
                        class="oauth-button"
                        @click="handleOAuthLogin(method.methodType)"
                      >
                        {{ method.displayName }}
                      </button>
                    </div>
                  </div>

                  <label class="lv-checkbox">
                    <input v-model="agreementChecked" type="checkbox" value="" class="sf-hidden">
                    <span class="lv-icon-hover lv-checkbox-icon-hover lv-checkbox-mask-wrapper">
                      <div class="lv-checkbox-mask" :class="{ 'is-checked-canana': agreementChecked }">
                        <svg
                          class="lv-checkbox-mask-icon"
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          width="24"
                          height="24"
                          fill="currentColor"
                        >
                          <path d="M18.8536 8.35355C19.0489 8.54882 19.0489 8.8654 18.8536 9.06066L10.8536 17.0607C10.6584 17.2559 10.3418 17.2559 10.1465 17.0607L5.14651 12.0607C4.95125 11.8654 4.95125 11.5488 5.14651 11.3536L5.85361 10.6464C6.04888 10.4512 6.36546 10.4512 6.56072 10.6464L10.5001 14.5858L17.4394 7.64645C17.6347 7.45118 17.9512 7.45118 18.1465 7.64645L18.8536 8.35355Z"></path>
                        </svg>
                      </div>
                    </span>
                    <span class="lv-checkbox-text">
                      <span class="agreement-text">
                        <span>{{ agreementTextPrefix }}</span>
                        <a class="link-text" :href="userAgreementHref" :target="policySettings.userAgreementUrl ? '_blank' : undefined" rel="noreferrer">{{ policySettings.userAgreementTitle }}</a>
                        <span>、</span>
                        <a class="link-text" :href="privacyPolicyHref" :target="policySettings.privacyPolicyUrl ? '_blank' : undefined" rel="noreferrer">{{ policySettings.privacyPolicyTitle }}</a>
                        <span>、</span>
                        <a class="link-text" :href="aiNoticeHref" :target="policySettings.aiNoticeUrl ? '_blank' : undefined" rel="noreferrer">{{ policySettings.aiNoticeTitle }}</a>
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <span
                class="lv-modal-close-icon lv-icon-hover"
                role="button"
                tabindex="0"
                aria-label="关闭"
                @click="close"
                @keydown.enter.prevent="close"
                @keydown.space.prevent="close"
              >
                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path
                      data-follow-fill="currentColor"
                      d="M19.579 6.119a1.2 1.2 0 0 0-1.697-1.698L12 10.303 6.12 4.422a1.2 1.2 0 1 0-1.697 1.697L10.303 12l-5.881 5.882a1.2 1.2 0 0 0 1.697 1.697L12 13.698l5.882 5.882a1.2 1.2 0 1 0 1.697-1.697L13.697 12l5.882-5.882Z"
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              </span>
            </div>
          </div>
          <div data-focus-guard="true" tabindex="0" class="login-focus-guard-canana"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { AuthMethodType } from '@/api/auth'
import { createOAuthAuthorizeUrl, requestAuthVerificationCode } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useSystemSettingsStore } from '@/stores/system-settings'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

// 登录弹窗滚动锁定类名。
const BODY_SCROLL_LOCK = 'login-modal-scroll-lock'

// 弹窗标题 id。
const dialogTitleId = 'arco-dialog-login-canana'


// 目标输入值。
const targetValue = ref('')

// 验证码输入值。
const codeValue = ref('')

// 最近一次下发的调试验证码。
const issuedCode = ref('')

// 当前激活的登录方式。
const activeMethodType = ref<AuthMethodType>('PHONE_CODE')

// 协议勾选状态。
const agreementChecked = ref(false)

// 倒计时秒数。
const countdown = ref(0)

// 是否正在发送验证码。
const isSendingCode = ref(false)

// 是否正在提交登录。
const isSubmitting = ref(false)

// 定时器句柄。
let countdownTimer: number | null = null

// 认证状态管理。
const authStore = useAuthStore()
const systemSettingsStore = useSystemSettingsStore()

// 所有验证码类登录方式。
const codeMethods = computed(() => authStore.enabledMethods.value.filter(item => item.category === 'CODE'))

// 所有 OAuth 类登录方式。
const oauthMethods = computed(() => authStore.enabledMethods.value.filter(item => item.category === 'OAUTH'))
const publicSettings = computed(() => systemSettingsStore.publicSystemSettings.value)
const policySettings = computed(() => publicSettings.value.policySettings)
const agreementTextPrefix = computed(() => policySettings.value.agreementTextPrefix || '已阅读并同意')
const welcomeTitle = computed(() => publicSettings.value.loginSettings.welcomeTitle || publicSettings.value.siteInfo.siteName || '欢迎登录')
const welcomeSubtitle = computed(() => publicSettings.value.loginSettings.welcomeSubtitle || '')
const userAgreementHref = computed(() => policySettings.value.userAgreementUrl || '/policies/user-agreement')
const privacyPolicyHref = computed(() => policySettings.value.privacyPolicyUrl || '/policies/privacy-policy')
const aiNoticeHref = computed(() => policySettings.value.aiNoticeUrl || '/policies/ai-notice')

// 当前选中的验证码登录方式。
const currentCodeMethod = computed(() => {
  return codeMethods.value.find(item => item.methodType === activeMethodType.value) || codeMethods.value[0] || null
})

// 当前目标输入标签。
const currentTargetLabel = computed(() => {
  return String(currentCodeMethod.value?.config?.targetLabel || currentCodeMethod.value?.displayName || '账号')
})

// 当前目标输入占位文案。
const currentTargetPlaceholder = computed(() => {
  return String(currentCodeMethod.value?.config?.placeholder || '请输入账号')
})

// 当前验证码输入占位文案。
const currentCodePlaceholder = computed(() => {
  return String(currentCodeMethod.value?.config?.codePlaceholder || '请输入验证码')
})

// 主按钮文案。
const primaryButtonText = computed(() => {
  return currentCodeMethod.value?.displayName ? `使用${currentCodeMethod.value.displayName}` : '登录'
})

// 当前目标是否合法。
const isTargetValid = computed(() => {
  if (!currentCodeMethod.value) {
    return false
  }

  if (currentCodeMethod.value.methodType === 'PHONE_CODE') {
    return /^1\d{10}$/.test(targetValue.value.trim())
  }

  if (currentCodeMethod.value.methodType === 'EMAIL_CODE') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetValue.value.trim())
  }

  return false
})

// 当前验证码是否合法。
const isCodeValid = computed(() => /^\d{6}$/.test(codeValue.value.trim()))

// 是否可发送验证码。
const canSendCode = computed(() => {
  return Boolean(currentCodeMethod.value)
    && isTargetValid.value
    && countdown.value === 0
    && !isSendingCode.value
    && !isSubmitting.value
})

// 是否可提交登录。
const canSubmit = computed(() => {
  return Boolean(currentCodeMethod.value)
    && isTargetValid.value
    && isCodeValid.value
    && (!policySettings.value.agreementRequired || agreementChecked.value)
    && !isSubmitting.value
})

// 验证码按钮文案。
const codeButtonText = computed(() => {
  if (isSendingCode.value) {
    return '发送中...'
  }

  return countdown.value > 0 ? `${countdown.value}s后重发` : '发送验证码'
})

// 关闭弹窗。
const close = () => {
  emit('update:visible', false)
}

// 重置表单状态。
const resetForm = () => {
  targetValue.value = ''
  codeValue.value = ''
  issuedCode.value = ''
  agreementChecked.value = false
  countdown.value = 0
  isSendingCode.value = false
  isSubmitting.value = false
  clearCountdownTimer()
}

// 清理倒计时定时器。
const clearCountdownTimer = () => {
  if (countdownTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 同步页面滚动锁。
const syncBodyScrollLock = (visible: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(BODY_SCROLL_LOCK, visible)
  document.body.classList.toggle(BODY_SCROLL_LOCK, visible)
}

// 启动验证码倒计时。
const startCountdown = () => {
  if (typeof window === 'undefined') return

  countdown.value = 60
  clearCountdownTimer()
  countdownTimer = window.setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0
      clearCountdownTimer()
      return
    }
    countdown.value -= 1
  }, 1000)
}

// 切换当前登录方式。
const selectMethod = (methodType: AuthMethodType) => {
  activeMethodType.value = methodType
  targetValue.value = ''
  codeValue.value = ''
  issuedCode.value = ''
  countdown.value = 0
  clearCountdownTimer()
}

// 根据后端返回的可用方式同步当前激活项。
const syncActiveMethod = () => {
  if (currentCodeMethod.value) {
    activeMethodType.value = currentCodeMethod.value.methodType
    return
  }

  if (codeMethods.value[0]) {
    activeMethodType.value = codeMethods.value[0].methodType
  }
}

// 请求验证码并自动填充。
const handleSendCode = async () => {
  if (!currentCodeMethod.value || !canSendCode.value) return

  try {
    isSendingCode.value = true
    const result = await requestAuthVerificationCode({
      methodType: currentCodeMethod.value.methodType,
      target: targetValue.value.trim(),
    })

    issuedCode.value = String(result.debugCode || '').trim()
    if (issuedCode.value) {
      codeValue.value = issuedCode.value
      ElMessage.success(`验证码已自动填充：${issuedCode.value}`)
    } else {
      ElMessage.success('验证码已发送')
    }

    startCountdown()
  } catch (error: any) {
    ElMessage.error(error?.message || '获取验证码失败')
  } finally {
    isSendingCode.value = false
  }
}

// 提交验证码登录。
const handleSubmit = async () => {
  if (!currentCodeMethod.value || !canSubmit.value) return

  if (issuedCode.value && codeValue.value.trim() !== issuedCode.value) {
    ElMessage.error('请输入刚刚获取到的验证码')
    return
  }

  try {
    isSubmitting.value = true
    await authStore.login({
      methodType: currentCodeMethod.value.methodType,
      target: targetValue.value.trim(),
      code: codeValue.value.trim(),
    })
    ElMessage.success('登录成功')
    close()
  } catch (error: any) {
    ElMessage.error(error?.message || '登录失败')
  } finally {
    isSubmitting.value = false
  }
}

// 发起第三方 OAuth 登录。
const handleOAuthLogin = async (methodType: AuthMethodType) => {
  try {
    const result = await createOAuthAuthorizeUrl({
      methodType,
      redirectUri: typeof window !== 'undefined' ? window.location.href : '',
    })

    if (typeof window !== 'undefined') {
      window.location.href = result.authUrl
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '发起第三方登录失败')
  }
}

watch(
  () => props.visible,
  async (visible) => {
    syncBodyScrollLock(visible)
    if (visible) {
      await Promise.all([authStore.loadMethods(true), systemSettingsStore.loadPublicSettings(true)])
      syncActiveMethod()
      resetForm()
    } else {
      clearCountdownTimer()
    }
  },
  { immediate: true },
)

watch(codeMethods, () => {
  syncActiveMethod()
})

watch(targetValue, () => {
  issuedCode.value = ''
})

onBeforeUnmount(() => {
  clearCountdownTimer()
  syncBodyScrollLock(false)
})
</script>

<style src="./LoginModal.css"></style>
