<script setup lang="ts">
/**
 * 通用按钮
 *
 * 统一封装 loading / disabled / variant / size 等常用按钮态，
 * 替代项目中 70+ 处原生 &lt;button class="wf-btn"&gt; 的散落实现。
 *
 * loading=true 时：
 *   - 自动 disabled
 *   - 文案保持原宽度（避免抖动），左侧插入 WfSpinner
 *   - 点击事件被吞掉
 */
import { computed } from 'vue'
import WfSpinner from './WfSpinner.vue'

type ButtonVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'text'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  loading?: boolean
  disabled?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
}>(), {
  loading: false,
  disabled: false,
  variant: 'default',
  size: 'md',
  type: 'button',
  block: false,
})

const emit = defineEmits<{
  (event: 'click', payload: MouseEvent): void
}>()

const isDisabled = computed(() => props.disabled || props.loading)

const handleClick = (event: MouseEvent) => {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}

const spinnerSize = computed(() => ({ sm: 12, md: 14, lg: 16 }[props.size]))
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    class="wf-button"
    :class="[
      `wf-button-${variant}`,
      `wf-button-${size}`,
      { 'is-loading': loading, 'is-block': block },
    ]"
    @click="handleClick"
  >
    <span v-if="loading" class="wf-button-spinner">
      <WfSpinner :size="spinnerSize" />
    </span>
    <span class="wf-button-content">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.wf-button {
  --wf-btn-bg: rgba(255, 255, 255, 0.06);
  --wf-btn-bg-hover: rgba(255, 255, 255, 0.12);
  --wf-btn-color: var(--text-primary, #e0f5ff);
  --wf-btn-border: 0.5px solid var(--stroke-tertiary, rgba(255, 255, 255, 0.12));

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  border: var(--wf-btn-border);
  background: var(--wf-btn-bg);
  color: var(--wf-btn-color);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, color 0.15s ease,
    border-color 0.15s ease, opacity 0.15s ease, transform 0.08s ease;
  white-space: nowrap;
}

.wf-button:hover:not(:disabled) {
  background: var(--wf-btn-bg-hover);
}

.wf-button:active:not(:disabled) {
  transform: scale(0.97);
}

.wf-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.wf-button.is-loading {
  cursor: progress;
}

.wf-button.is-block {
  display: flex;
  width: 100%;
}

/* 尺寸 */
.wf-button-sm {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 4px;
}

.wf-button-md {
  height: 32px;
  padding: 0 12px;
}

.wf-button-lg {
  height: 40px;
  padding: 0 18px;
  font-size: 14px;
  border-radius: 8px;
}

/* 风格 */
.wf-button-primary {
  --wf-btn-bg: var(--brand-color, #10b981);
  --wf-btn-bg-hover: #0ea372;
  --wf-btn-color: #fff;
  --wf-btn-border: none;
}

.wf-button-ghost {
  --wf-btn-bg: transparent;
  --wf-btn-bg-hover: rgba(255, 255, 255, 0.08);
}

.wf-button-danger {
  --wf-btn-bg: #ef4444;
  --wf-btn-bg-hover: #dc2626;
  --wf-btn-color: #fff;
  --wf-btn-border: none;
}

.wf-button-text {
  --wf-btn-bg: transparent;
  --wf-btn-bg-hover: rgba(255, 255, 255, 0.06);
  --wf-btn-border: none;
  padding-left: 6px;
  padding-right: 6px;
}

.wf-button-spinner {
  display: inline-flex;
  align-items: center;
}

.wf-button-content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
