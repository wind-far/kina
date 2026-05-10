<template>
  <!-- Agent 模式发送后的加载记录 -->
  <div class="responsive-container-msS_cP responsive-container-Nivf0N">
    <div class="content-DPogfx ai-generated-record-content-hg5EL8">
      <div class="agentic-record-qV_0lS">
        <div :class="['agentic-record-content-pUXA3k', { 'completed-E206yG': done }]">
          <!-- 用户消息 -->
          <div class="user-message-IyG6vx">
            <div
              v-if="visibleReferenceImages.length"
              class="user-reference-stack"
              :style="referenceStyleVars"
            >
              <div class="user-reference-stack__group" :style="referenceGroupStyle">
                <div
                  v-for="(imageSrc, index) in visibleReferenceImages"
                  :key="`${imageSrc}-${index}`"
                  class="user-reference-stack__item"
                  :style="buildReferenceItemStyle(index)"
                >
                  <div class="user-reference-stack__card" :style="buildReferenceCardStyle(index)">
                    <img
                      class="user-reference-stack__image"
                      :src="imageSrc"
                      alt="参考图"
                      loading="lazy"
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="context-menu-trigger-QXaWD5">
              <div class="user-message-content">
                <div class="user-message-text">
                  <span class="prompt-value-container-KCtKOf"><span>{{ prompt }}</span></span>
                </div>
              </div>
            </div>
          </div>
          <!-- 思考过程：思考阶段实时展开显示，回答开始后自动折叠 -->
          <details v-if="hasThinking" class="agent-thinking-block" :open="isThinkingPhase">
            <summary class="agent-thinking-block__summary">
              <span class="agent-thinking-block__icon">💭</span>
              <span class="agent-thinking-block__title">{{ thinkingSummaryText }}</span>
              <span class="agent-thinking-block__chevron" aria-hidden="true">▾</span>
            </summary>
            <div class="agent-thinking-block__content" v-html="renderedThinking"></div>
          </details>

          <!-- AI 加载/回复区域 -->
          <div v-if="isThinkingPhase" class="agent-loading-status-wrapper">
            <AgentLoadingIcon :size="22" />
            <span class="agent-loading-text">深度思考中…</span>
          </div>
          <div v-else-if="!done && !content && !hasThinking" class="agent-loading-status-wrapper">
            <AgentLoadingIcon :size="22" />
            <span class="agent-loading-text">思考中</span>
          </div>
          <div v-else-if="content" class="assistant-message-text-e69SR6">
            <div class="markdown-render-DkILWY markdown-render-UH4_kU" v-html="renderedContent"></div>
          </div>
          <!-- 错误提示 -->
          <div v-if="error" class="agent-error-text">{{ error }}</div>
          <!-- AI 生成标识 -->
          <div v-if="done" class="ai-generated-notice-U9hEwy">以上内容由 AI 生成</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AgentLoadingIcon from './AgentLoadingIcon.vue'

const props = defineProps<{
  prompt: string
  content: string
  done: boolean
  error?: string
  referenceImages?: string[]
  /** 模型的思考过程文本（reasoning_content / thinking block）。 */
  thinkingContent?: string
  /** 思考开始时间戳（毫秒）。用于计算"已思考 N 秒"。 */
  thinkingStartedAt?: number
  /** 思考结束时间戳（毫秒）。完成时设置；未设置则按当前时间计算。 */
  thinkingEndedAt?: number
}>()

const maxVisibleReferenceCount = 4
const collapsedReferenceOffsetX = 12
const referenceRotateList = [-8, 5, -4, 3]
const referenceTopOffsetList = [0, 1, 0, 1]
const referenceDepthList = [4, 3, 2, 1]

const visibleReferenceImages = computed(() => {
  return (Array.isArray(props.referenceImages) ? props.referenceImages : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(-maxVisibleReferenceCount)
})

const referenceStyleVars = computed(() => ({
  '--reference-count': String(Math.max(visibleReferenceImages.value.length, 1)),
}))

const referenceGroupStyle = computed(() => ({
  width: `${48 + Math.max(visibleReferenceImages.value.length - 1, 0) * collapsedReferenceOffsetX}px`,
  height: '48px',
}))

const buildReferenceItemStyle = (index: number) => {
  const offsetX = index * collapsedReferenceOffsetX
  const offsetY = referenceTopOffsetList[index] ?? 0
  const zIndex = referenceDepthList[index] ?? Math.max(1, maxVisibleReferenceCount - index)

  return {
    left: `${offsetX}px`,
    top: `${offsetY}px`,
    zIndex,
  }
}

const buildReferenceCardStyle = (index: number) => {
  const rotate = referenceRotateList[index] ?? (index % 2 === 0 ? -4 : 4)
  return {
    transform: `rotate(${rotate}deg)`,
  }
}

// 简单的 markdown 渲染（标题、段落、列表）
const renderedContent = computed(() => {
  return props.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
})

// ----------------------------------------------------------------------------
// 思考过程渲染
// ----------------------------------------------------------------------------

const hasThinking = computed(() => Boolean((props.thinkingContent || '').trim()))

// 思考阶段：有思考内容但还没有正式回答内容（content 为空）
const isThinkingPhase = computed(() => hasThinking.value && !props.content)

const thinkingDurationSeconds = computed(() => {
  const startedAt = props.thinkingStartedAt
  if (!startedAt) return 0
  const endedAt = props.thinkingEndedAt || Date.now()
  return Math.max(0, Math.round((endedAt - startedAt) / 1000))
})

const thinkingSummaryText = computed(() => {
  if (isThinkingPhase.value) {
    const seconds = thinkingDurationSeconds.value
    return seconds > 0 ? `深度思考中…（${seconds}s）` : '深度思考中…'
  }
  const seconds = thinkingDurationSeconds.value
  return seconds > 0 ? `已思考 ${seconds}s` : '思考过程'
})

// 思考内容用 pre-wrap 简单渲染，保留换行；不做 markdown，避免与正式回答的视觉权重冲突
const renderedThinking = computed(() => {
  return (props.thinkingContent || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
})
</script>

<style scoped>
.user-reference-stack {
  display: flex;
  justify-content: flex-end;
  height: 48px;
  margin-bottom: 8px;
  padding: 4px 8px 0;
  position: relative;
  width: calc(var(--reference-count) * 36px);
  z-index: 2;
}

.user-reference-stack__group {
  height: 48px;
  position: relative;
}

.user-reference-stack__item {
  width: 48px;
  height: 64px;
  position: absolute;
  scale: 0.75;
  transform-origin: 100% 0;
}

.user-reference-stack__card {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background-color: var(--bg-surface);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}

.user-reference-stack__card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--bg-black);
  opacity: 0.18;
  z-index: 1;
}

.user-reference-stack__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-loading-status-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.agent-loading-text {
  color: var(--text-tertiary);
  font-size: 14px;
  line-height: 20px;
}

.agent-error-text {
  color: var(--functional-danger, #f53f3f);
  font-size: 13px;
  padding: 8px 0;
}

.agent-thinking-block {
  margin: 8px 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 8px;
  background: var(--bg-block-secondary-default, rgba(15, 23, 42, 0.04));
}

.agent-thinking-block__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  list-style: none;
  font-size: 13px;
  color: var(--text-secondary, #4b5563);
  user-select: none;
}

.agent-thinking-block__summary::-webkit-details-marker {
  display: none;
}

.agent-thinking-block__icon {
  font-size: 14px;
}

.agent-thinking-block__title {
  flex: 1;
  font-weight: 500;
}

.agent-thinking-block__chevron {
  font-size: 12px;
  color: var(--text-tertiary, #9ca3af);
  transition: transform 0.2s ease;
}

.agent-thinking-block[open] .agent-thinking-block__chevron {
  transform: rotate(180deg);
}

.agent-thinking-block__content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-divider, #00000014);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-tertiary, #6b7280);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 360px;
  overflow-y: auto;
}
</style>
