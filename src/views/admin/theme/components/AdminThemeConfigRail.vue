<template>
  <aside class="admin-theme-config-rail" :class="{ 'is-collapsed': collapsed }">
    <div v-if="collapsed" class="admin-theme-config-rail__collapsed-label">
      <button
        class="admin-theme-config-rail__toggle admin-theme-config-rail__toggle--collapsed"
        type="button"
        aria-label="展开配置"
        title="展开配置"
        @click="$emit('toggle')"
      >
        <span class="admin-theme-config-rail__toggle-icon">⚙</span>
      </button>
      <span>配置</span>
    </div>

    <div v-else class="admin-theme-config-panel">
      <div class="admin-theme-config-panel__toolbar">
        <div class="admin-theme-config-panel__tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="admin-theme-config-panel__tab"
            :class="{ 'is-active': activeTab === tab.key }"
            type="button"
            @click="$emit('update:activeTab', tab.key)"
          >
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <button
          class="admin-theme-config-rail__toggle admin-theme-config-rail__toggle--inline"
          type="button"
          aria-label="收起配置"
          title="收起配置"
          @click="$emit('toggle')"
        >
          <span>收起</span>
        </button>
      </div>

      <div v-if="activeTab === 'theme'" class="admin-theme-config-panel__body">
        <slot name="theme" />
      </div>

      <div v-else class="admin-theme-config-panel__body admin-theme-config-panel__body--layout">
        <slot name="layout" />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  collapsed: boolean
  activeTab: 'theme' | 'layout'
  tabs: ReadonlyArray<{ key: 'theme' | 'layout', label: string }>
}>()

defineEmits<{
  toggle: []
  'update:activeTab': [value: 'theme' | 'layout']
}>()
</script>

<style scoped>
.admin-theme-config-rail {
  position: relative;
  border-left: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  background: color-mix(in srgb, var(--bg-surface, #ffffff) 94%, var(--bg-muted, #f8fafc));
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.admin-theme-config-rail.is-collapsed {
  width: 76px;
}

.admin-theme-config-rail__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 12px;
  background: var(--bg-surface, #ffffff);
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.admin-theme-config-rail__toggle-icon {
  font-size: 16px;
  line-height: 1;
}

.admin-theme-config-rail__toggle:hover {
  color: var(--text-primary, #0f172a);
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 24%, rgba(148, 163, 184, 0.18));
}

.admin-theme-config-rail__collapsed-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 16px 0 20px;
}

.admin-theme-config-rail__collapsed-label span {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.24em;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary, #8b94a7);
  user-select: none;
}

.admin-theme-config-rail__toggle--collapsed {
  width: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 14px;
}

.admin-theme-config-panel {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}

.admin-theme-config-panel__toolbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  background: color-mix(in srgb, var(--bg-surface, #ffffff) 96%, var(--bg-muted, #f8fafc));
}

.admin-theme-config-panel__tabs {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.admin-theme-config-panel__tab {
  display: flex;
  align-items: center;
  min-height: 60px;
  padding: 12px 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background: var(--bg-surface, #ffffff);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-theme-config-panel__tab span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.admin-theme-config-panel__tab.is-active {
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 34%, rgba(148, 163, 184, 0.16));
  background: color-mix(in srgb, var(--brand-main-default, #6f35ff) 6%, var(--bg-surface, #ffffff));
  box-shadow: 0 14px 32px color-mix(in srgb, var(--brand-main-default, #6f35ff) 8%, transparent);
}

.admin-theme-config-panel__body {
  min-height: 0;
  overflow: auto;
  padding: 16px 16px 20px;
}

.admin-theme-config-panel__body--layout {
  padding: 0;
}

@media (max-width: 1280px) {
  .admin-theme-config-rail {
    border-left: none;
    border-top: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  }

  .admin-theme-config-panel__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-theme-config-rail__toggle--inline {
    width: 100%;
  }
}

@media (max-width: 980px) {
  .admin-theme-config-panel__tabs {
    grid-template-columns: 1fr;
  }
}
</style>
