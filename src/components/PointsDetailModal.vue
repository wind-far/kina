<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lv-modal-wrapper lv-modal-wrapper-align-center credit-history-modal-wrapper-rcgLyB"
      @click.self="closeModal"
    >
      <div class="lv-modal-mask" @click="closeModal"></div>
      <div role="dialog" aria-modal="true" class="lv-modal lv-modal-simple credit-history-modal-xO5hUp">
        <div class="action-cap1Mw">
          <div class="modal-title-_9IMIA">积分详情</div>
          <button class="close-btn-YEwxmE" type="button" @click="closeModal">
            <span class="close-btn-icon-Wsjd_2">×</span>
          </button>
        </div>

        <div class="header-r0c3rN">
          <div class="credit-info-wrapper-JL8SoI">
            <div v-for="item in summaryItems" :key="item.label" class="credit-info-item-rnrl9v">
              <div class="credit-info-item-title-pOA0Rt">
                {{ item.label }}
                <span v-if="item.hint" class="credit-info-item-hint-canana">ⓘ</span>
              </div>
              <div class="creditInfoItemAmount-scwpa1">
                <div class="creditInfoItemNum-XNF6AK">{{ formatAmount(item.value) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="contentWrapper-WYI3pI">
          <div class="content-WrmpEO">
            <div class="tabs-q8zet1">
              <div class="lv-tabs-header-wrapper">
                <div class="lv-tabs-header">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    class="tabTitleWrapper-RetTWj"
                    type="button"
                    @click="activeTab = tab.key"
                  >
                    <div
                      class="lv-tabs-header-title"
                      :class="{ 'lv-tabs-header-title-active': activeTab === tab.key }"
                    >
                      {{ tab.label }}
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div class="creditHistoryWrapper-cge6P1" :class="{ 'is-empty-canana': filteredLogs.length === 0 }">
              <div v-if="filteredLogs.length" class="creditHistory-qAeI1C">
                <div
                  v-for="item in filteredLogs"
                  :key="String(item.id || item.accountNo || item.createdAt || item.updatedAt)"
                  class="historyItem-pSj3eK"
                >
                  <div class="historyMain-canana">
                    <div class="historyTitle-TdiCr7">{{ getLogTitle(item) }}</div>
                    <div class="historyTime-Wqy6Kw">{{ getLogTime(item) }}</div>
                  </div>
                  <div class="historyAmountWrapper-xiKq20">
                    <div class="historyAmount-UQ6_5P" :class="{ 'issued-FqpDgk': isIncome(item) }">
                      {{ getLogAmount(item) }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="credit-history-empty-canana">暂无积分记录</div>
            </div>
          </div>
        </div>

        <div class="bottomTips-CGxOKY">
          <span class="delayTips-s4D_mE">仅展示最近 1 个月明细，数据更新可能有延时，请以实际到账为准</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import './PointsDetailModal.css'

const props = defineProps<{
  visible: boolean
  balance: number
  available?: number
  logs?: Array<Record<string, any>>
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
}>()

const activeTab = ref<'all' | 'expense' | 'income'>('all')

const tabs = [
  { key: 'all' as const, label: '全部明细' },
  { key: 'expense' as const, label: '消耗' },
  { key: 'income' as const, label: '获得' },
]

const normalizedLogs = computed(() => Array.isArray(props.logs) ? props.logs : [])

// 根据服务端流水动作判断当前记录是收入还是消耗。
const isIncome = (item: Record<string, any>) => String(item.action || '').toUpperCase() !== 'DECREASE'

const filteredLogs = computed(() => {
  if (activeTab.value === 'income') {
    return normalizedLogs.value.filter((item) => isIncome(item))
  }
  if (activeTab.value === 'expense') {
    return normalizedLogs.value.filter((item) => !isIncome(item))
  }
  return normalizedLogs.value
})

// 将流水按业务来源拆分，尽量还原原稿里的四段统计语义。
const summaryBuckets = computed(() => {
  return normalizedLogs.value.reduce((result, item) => {
    if (!isIncome(item)) {
      return result
    }
    const amount = Math.max(0, Number(item.changeAmount || 0))
    const sourceType = String(item.sourceType || '').toUpperCase()
    const changeType = String(item.changeType || '').toUpperCase()

    if (sourceType === 'MEMBERSHIP_ORDER') {
      result.subscription += amount
      return result
    }
    if (sourceType === 'RECHARGE_ORDER' || changeType === 'RECHARGE') {
      result.recharge += amount
      return result
    }
    result.gift += amount
    return result
  }, {
    subscription: 0,
    recharge: 0,
    gift: 0,
  })
})

const summaryItems = computed(() => [
  { label: '剩余积分', value: Number(props.available ?? props.balance ?? 0), hint: false },
  { label: '订阅积分', value: summaryBuckets.value.subscription, hint: false },
  { label: '充值积分', value: summaryBuckets.value.recharge, hint: false },
  { label: '赠送积分', value: summaryBuckets.value.gift, hint: true },
])

// 根据积分流水构造更接近业务语义的标题，避免直接暴露底层枚举值。
const getLogTitle = (item: Record<string, any>) => {
  if (item.remark) {
    return String(item.remark)
  }
  const sourceType = String(item.sourceType || '').toUpperCase()
  const changeType = String(item.changeType || '').toUpperCase()
  if (sourceType === 'RECHARGE_ORDER' || changeType === 'RECHARGE') return '积分充值到账'
  if (sourceType === 'MEMBERSHIP_ORDER' || changeType === 'MEMBERSHIP_BONUS') return '订阅积分到账'
  if (sourceType === 'CARD_REDEEM' || changeType === 'CARD_REDEEM') return '卡密兑换奖励'
  if (sourceType === 'CHECKIN') return '每日免费积分'
  if (sourceType === 'REWARD_RULE') return '活动赠送积分'
  if (changeType === 'CONSUME') return '图片生成'
  if (changeType === 'REFUND') return '积分退回'
  return '积分变动'
}

const getLogTime = (item: Record<string, any>) => {
  const value = item.createdAt || item.updatedAt || item.time
  if (!value) return '时间未知'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '时间未知'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const getLogAmount = (item: Record<string, any>) => {
  const amount = Number(item.changeAmount || 0)
  return `${isIncome(item) ? '+' : '-'}${formatAmount(amount)}`
}

const formatAmount = (value: number) => String(Math.max(0, Number(value || 0)))

const closeModal = () => {
  emit('update:visible', false)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    activeTab.value = 'all'
  }
})
</script>
