import { computed, ref } from 'vue'
import { getSystemInitStatus, initializeSystem, type SystemInitPayload, type SystemInitStatus } from '@/api/system-init'

const defaultStatus = (): SystemInitStatus => ({
  isInitialized: false,
  initializedAt: '',
  adminUserId: '',
  adminUsername: '',
  siteName: '',
})

const systemInitStatus = ref<SystemInitStatus>(defaultStatus())
const systemInitLoading = ref(false)
const systemInitInitialized = ref(false)
let loadSystemInitPromise: Promise<SystemInitStatus> | null = null

const applySystemInitStatus = (status?: SystemInitStatus | null) => {
  systemInitStatus.value = status || defaultStatus()
  systemInitInitialized.value = true
  return systemInitStatus.value
}

// 首次安装初始化状态单例。
export const useSystemInitStore = () => {
  const isInitialized = computed(() => systemInitStatus.value.isInitialized)

  const loadStatus = async (force = false) => {
    if (loadSystemInitPromise && !force) {
      return loadSystemInitPromise
    }

    systemInitLoading.value = true
    loadSystemInitPromise = getSystemInitStatus()
      .then(result => applySystemInitStatus(result || defaultStatus()))
      .catch(() => applySystemInitStatus(defaultStatus()))
      .finally(() => {
        systemInitLoading.value = false
        loadSystemInitPromise = null
      })

    return loadSystemInitPromise
  }

  const runInitialize = async (payload: SystemInitPayload) => {
    const result = await initializeSystem(payload)
    applySystemInitStatus({
      isInitialized: result.isInitialized,
      initializedAt: new Date().toISOString(),
      adminUserId: result.user.id,
      adminUsername: payload.username,
      siteName: payload.siteName,
    })
    return result
  }

  return {
    systemInitStatus,
    systemInitLoading,
    systemInitInitialized,
    isInitialized,
    loadStatus,
    runInitialize,
    applySystemInitStatus,
  }
}
