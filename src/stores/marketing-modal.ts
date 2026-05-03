import { computed, ref } from 'vue'

export type MarketingModalTab = 'membership' | 'recharge' | 'checkin' | 'redeem'

// 全局营销弹窗显隐状态。
const marketingModalVisible = ref(false)

// 最近一次打开来源，便于埋点或后续差异化展示。
const marketingModalSource = ref('')

// 当前默认激活的标签页。
const marketingModalTab = ref<MarketingModalTab>('membership')

// 全局营销弹窗状态单例。
export const useMarketingModalStore = () => {
  const isVisible = computed(() => marketingModalVisible.value)

  const openMarketingModal = (input?: {
    source?: string
    tab?: MarketingModalTab
  }) => {
    marketingModalSource.value = String(input?.source || '').trim()
    marketingModalTab.value = input?.tab || 'membership'
    marketingModalVisible.value = true
  }

  const closeMarketingModal = () => {
    marketingModalVisible.value = false
  }

  const setMarketingModalVisible = (visible: boolean) => {
    marketingModalVisible.value = Boolean(visible)
  }

  const setMarketingModalTab = (tab: MarketingModalTab) => {
    marketingModalTab.value = tab
  }

  return {
    isVisible,
    marketingModalVisible,
    marketingModalSource,
    marketingModalTab,
    openMarketingModal,
    closeMarketingModal,
    setMarketingModalVisible,
    setMarketingModalTab,
  }
}
