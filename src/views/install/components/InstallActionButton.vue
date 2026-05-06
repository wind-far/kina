<template>
  <button
    :class="[
      'install-action-button',
      variant === 'primary' ? 'install-action-button--primary' : 'install-action-button--secondary',
      size === 'large' ? 'install-action-button--large' : '',
      { 'is-dark-theme': isDarkTheme },
      { 'is-block': block },
      { 'is-loading': loading },
    ]"
    type="button"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <span v-if="loading" class="install-action-button__spinner" />
    <span class="install-action-button__label">
      <slot />
    </span>
    <span v-if="$slots.icon" class="install-action-button__icon">
      <slot name="icon" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemePreferenceStore } from '@/stores/theme-preference'

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  size?: 'default' | 'large'
}>(), {
  variant: 'secondary',
  block: false,
  disabled: false,
  loading: false,
  size: 'default',
})

defineEmits<{
  click: []
}>()

const themeStore = useThemePreferenceStore()
const isDarkTheme = computed(() => themeStore.currentTheme.value === 'dark')
</script>

<style scoped>
.install-action-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 1;
  gap: 10px;
  min-width: 148px;
  max-width: 100%;
  height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.install-action-button--large {
  min-width: 156px;
  height: 48px;
  padding: 0 20px;
}

.install-action-button:hover {
  transform: translateY(-1px);
}

.install-action-button:active {
  transform: translateY(0);
}

.install-action-button.is-block {
  width: 100%;
}

.install-action-button:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 1px rgba(111, 53, 255, 0.16),
    0 0 0 4px rgba(111, 53, 255, 0.12);
}

.install-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

.install-action-button__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.install-action-button__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.install-action-button__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: install-action-button-spin 0.7s linear infinite;
}

.install-action-button.is-loading .install-action-button__icon {
  opacity: 0.8;
}

.install-action-button--secondary {
  border-color: rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.install-action-button--secondary:hover {
  border-color: rgba(15, 23, 42, 0.18);
  background: rgba(255, 255, 255, 1);
  box-shadow:
    0 8px 20px rgba(15, 23, 42, 0.08),
    0 1px 2px rgba(15, 23, 42, 0.04);
}

.install-action-button--primary {
  background: linear-gradient(135deg, var(--brand-main-default) 0%, var(--brand-main-hover) 100%);
  color: #fff;
  box-shadow:
    0 10px 24px rgba(111, 53, 255, 0.2),
    0 2px 6px rgba(111, 53, 255, 0.14);
}

.install-action-button--primary:hover {
  background: linear-gradient(135deg, var(--brand-main-hover) 0%, var(--brand-main-pressed) 100%);
  box-shadow:
    0 14px 28px rgba(111, 53, 255, 0.24),
    0 4px 10px rgba(111, 53, 255, 0.16);
}

.install-action-button.is-dark-theme.install-action-button--secondary {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.92);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.install-action-button.is-dark-theme.install-action-button--secondary:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.07);
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.install-action-button.is-dark-theme.install-action-button--primary {
  background: linear-gradient(135deg, var(--brand-main-default) 0%, var(--brand-main-hover) 100%);
  box-shadow:
    0 8px 18px rgba(93, 103, 246, 0.22),
    0 2px 6px rgba(0, 0, 0, 0.16);
}

.install-action-button.is-dark-theme.install-action-button--primary:hover {
  background: linear-gradient(135deg, var(--brand-main-hover) 0%, var(--brand-main-pressed) 100%);
  box-shadow:
    0 12px 24px rgba(93, 103, 246, 0.26),
    0 4px 10px rgba(0, 0, 0, 0.2);
}

@keyframes install-action-button-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1200px) {
  .install-action-button {
    min-width: 132px;
  }

  .install-action-button--large {
    min-width: 140px;
    padding: 0 18px;
  }
}

@media (max-width: 768px) {
  .install-action-button,
  .install-action-button--large {
    min-width: 0;
  }
}
</style>
