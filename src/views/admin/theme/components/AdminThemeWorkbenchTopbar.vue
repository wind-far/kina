<template>
  <div class="admin-theme-shell__topbar">
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
        v-for="option in previewModeOptions"
        :key="option.value"
        class="admin-theme-shell__mode-button"
        :class="{ 'is-active': previewMode === option.value }"
        type="button"
        @click="$emit('update:previewMode', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  previewMode: 'dark' | 'light'
  previewModeOptions: ReadonlyArray<{ value: 'dark' | 'light', label: string }>
}>()

defineEmits<{
  'update:previewMode': [value: 'dark' | 'light']
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
  gap: 8px;
}

.admin-theme-shell__mode-button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.admin-theme-shell__mode-button.is-active {
  color: var(--text-primary, #0f172a);
  background: var(--bg-surface, #ffffff);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

@media (max-width: 980px) {
  .admin-theme-shell__topbar {
    display: grid;
  }

  .admin-theme-shell__actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
