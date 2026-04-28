import { computed, ref } from 'vue'
import { getPublicSystemConfig, type SystemConfigPayload } from '@/api/system-config'

const createDefaultSettings = (): SystemConfigPayload => ({
  siteInfo: {
    siteName: 'Canana',
    siteDescription: '',
    siteLogoUrl: '',
    siteIconUrl: '',
    icpText: '',
    icpLink: '',
    copyrightText: '',
  },
  policySettings: {
    agreementRequired: true,
    agreementTextPrefix: '已阅读并同意',
    userAgreementTitle: '用户服务协议',
    userAgreementUrl: '',
    userAgreementContent: '',
    privacyPolicyTitle: '隐私政策',
    privacyPolicyUrl: '',
    privacyPolicyContent: '',
    aiNoticeTitle: 'AI功能使用须知',
    aiNoticeUrl: '',
    aiNoticeContent: '',
  },
  loginSettings: {
    welcomeTitle: '欢迎登录',
    welcomeSubtitle: '',
  },
})

const publicSystemSettings = ref<SystemConfigPayload>(createDefaultSettings())
const settingsLoading = ref(false)
let loadSettingsPromise: Promise<SystemConfigPayload> | null = null

const syncSiteRuntime = (settings: SystemConfigPayload) => {
  if (typeof document === 'undefined') {
    return
  }

  const siteName = String(settings.siteInfo.siteName || '').trim()
  if (siteName) {
    document.title = siteName
  }

  const description = String(settings.siteInfo.siteDescription || '').trim()
  let descriptionMeta = document.querySelector('meta[name="description"]')
  if (!descriptionMeta) {
    descriptionMeta = document.createElement('meta')
    descriptionMeta.setAttribute('name', 'description')
    document.head.appendChild(descriptionMeta)
  }
  descriptionMeta.setAttribute('content', description)

  const iconUrl = String(settings.siteInfo.siteIconUrl || '').trim()
  if (!iconUrl) {
    return
  }

  let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.rel = 'icon'
    document.head.appendChild(favicon)
  }

  favicon.href = iconUrl
}

const applyPublicSystemSettings = (settings?: SystemConfigPayload | null) => {
  publicSystemSettings.value = settings || createDefaultSettings()
  syncSiteRuntime(publicSystemSettings.value)
  return publicSystemSettings.value
}

export const useSystemSettingsStore = () => {
  const siteName = computed(() => publicSystemSettings.value.siteInfo.siteName)

  const loadPublicSettings = async (force = false) => {
    if (loadSettingsPromise && !force) {
      return loadSettingsPromise
    }

    settingsLoading.value = true
    loadSettingsPromise = getPublicSystemConfig()
      .then(result => applyPublicSystemSettings(result || createDefaultSettings()))
      .catch(() => applyPublicSystemSettings(createDefaultSettings()))
      .finally(() => {
        settingsLoading.value = false
        loadSettingsPromise = null
      })

    return loadSettingsPromise
  }

  return {
    publicSystemSettings,
    siteName,
    settingsLoading,
    loadPublicSettings,
    applyPublicSystemSettings,
  }
}
