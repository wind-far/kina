<template>
  <div
    class="admin-theme-shell__topbar"
    :class="{
      'is-dark': previewThemeClass === 'is-dark',
      'is-light': previewThemeClass === 'is-light',
    }"
  >
    <div class="admin-theme-shell__traffic-lights">
      <span class="is-red"></span>
      <span class="is-yellow"></span>
      <span class="is-green"></span>
    </div>
    <div class="admin-theme-shell__address">
      <span class="admin-theme-shell__lock">🔒</span>
      <span>前台主题工作台</span>
    </div>
    <div class="admin-theme-shell__actions">
      <button
        class="admin-theme-shell__action-button admin-theme-shell__action-button--secondary"
        type="button"
        :disabled="loading || saving"
        @click="$emit('reset')"
      >
        恢复默认
      </button>
      <button
        class="admin-theme-shell__action-button admin-theme-shell__action-button--primary"
        type="button"
        :disabled="loading || saving"
        @click="$emit('save')"
      >
        {{ saving ? '保存中...' : '保存主题配置' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  previewThemeClass: 'is-dark' | 'is-light'
  loading: boolean
  saving: boolean
}>()

defineEmits<{
  reset: []
  save: []
}>()
</script>

<style scoped>
.admin-theme-shell__topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  background: color-mix(in srgb, var(--bg-surface, #ffffff) 92%, var(--bg-muted, #f8fafc));
}

.admin-theme-shell__topbar.is-dark {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(32, 34, 40, 0.98) 0%, rgba(28, 30, 34, 0.96) 100%);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.03);
}

.admin-theme-shell__traffic-lights {
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-theme-shell__traffic-lights span {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.admin-theme-shell__traffic-lights .is-red {
  background: #fb7185;
}

.admin-theme-shell__traffic-lights .is-yellow {
  background: #fbbf24;
}

.admin-theme-shell__traffic-lights .is-green {
  background: #22c55e;
}

.admin-theme-shell__address {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 12px;
  background: var(--bg-muted, #f8fafc);
  color: var(--text-secondary, #64748b);
  font-size: 13px;
}

.admin-theme-shell__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.admin-theme-shell__action-button {
  min-height: 34px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.admin-theme-shell__action-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.admin-theme-shell__action-button--secondary {
  background: rgba(15, 23, 42, 0.06);
  border-color: rgba(148, 163, 184, 0.16);
  color: var(--text-primary, #0f172a);
}

.admin-theme-shell__action-button--primary {
  background: var(--brand-main-default, #6f35ff);
  border-color: var(--brand-main-default, #6f35ff);
  color: #fff;
}

.admin-theme-shell__topbar.is-dark .admin-theme-shell__address {
  background: linear-gradient(180deg, rgba(245, 247, 250, 0.96) 0%, rgba(236, 239, 244, 0.92) 100%);
  color: rgba(126, 135, 150, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 1px 0 rgba(0, 0, 0, 0.18);
}

.admin-theme-shell__topbar.is-dark .admin-theme-shell__lock {
  filter: saturate(0.78) brightness(0.96);
}

.admin-theme-shell__topbar.is-dark .admin-theme-shell__action-button--secondary {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(226, 232, 240, 0.92);
}

@media (max-width: 980px) {
  .admin-theme-shell__topbar {
    display: grid;
  }

  .admin-theme-shell__actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
}
</style>
