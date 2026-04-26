import { computed, ref } from 'vue'

// 全局登录弹窗显隐状态。
const loginModalVisible = ref(false)

// 最近一次打开登录弹窗的来源，便于后续扩展埋点或回跳。
const loginModalSource = ref('')

// 全局登录弹窗状态单例。
export const useLoginModalStore = () => {
  // 是否处于打开状态。
  const isVisible = computed(() => loginModalVisible.value)

  // 打开登录弹窗。
  const openLoginModal = (source = '') => {
    loginModalSource.value = String(source || '').trim()
    loginModalVisible.value = true
  }

  // 关闭登录弹窗。
  const closeLoginModal = () => {
    loginModalVisible.value = false
  }

  // 供 v-model 直接写入可见状态。
  const setLoginModalVisible = (visible: boolean) => {
    loginModalVisible.value = Boolean(visible)
  }

  return {
    isVisible,
    loginModalVisible,
    loginModalSource,
    openLoginModal,
    closeLoginModal,
    setLoginModalVisible,
  }
}
