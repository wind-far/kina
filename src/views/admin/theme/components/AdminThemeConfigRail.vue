<template>
  <aside class="admin-theme-config-rail" :class="{ 'is-collapsed': collapsed }">
    <button
      class="admin-theme-config-rail__toggle"
      type="button"
      :aria-label="collapsed ? '展开配置' : '收起配置'"
      :title="collapsed ? '展开配置' : '收起配置'"
      @click="$emit('toggle')"
    >
      <span v-if="collapsed" class="admin-theme-config-rail__toggle-icon">⚙</span>
      <span v-else>收起配置</span>
    </button>

    <div v-if="collapsed" class="admin-theme-config-rail__collapsed-label">
      <span>配置</span>
    </div>

    <div v-else class="admin-theme-config-panel">
      <div class="admin-theme-config-panel__head">
        <div>
          <div class="admin-theme-sidebar__eyebrow">实时配置</div>
          <h3 class="admin-theme-sidebar__title">前台配置工作台</h3>
          <p class="admin-theme-sidebar__desc">
            右侧专注改配置，左侧实时看前台；主题和布局统一在一个工作台里维护。
          </p>
        </div>
      </div>

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
          <small>{{ tab.desc }}</small>
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
  tabs: ReadonlyArray<{ key: 'theme' | 'layout', label: string, desc: string }>
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
  position: absolute;
  top: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  border-radius: 12px;
  background: var(--bg-surface, #ffffff);
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
  z-index: 4;
  transition: all 0.2s ease;
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
  align-items: center;
  justify-content: center;
  padding: 72px 0 20px;
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

.admin-theme-config-rail.is-collapsed .admin-theme-config-rail__toggle {
  top: 16px;
  right: 50%;
  transform: translateX(50%);
  width: 44px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border-radius: 14px;
}

.admin-theme-config-panel {
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 0;
}

.admin-theme-config-panel__head {
  padding: 20px 20px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.admin-theme-config-panel__tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 16px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}

.admin-theme-config-panel__tab {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line-divider, rgba(148, 163, 184, 0.16));
  border-radius: 14px;
  background: var(--bg-surface, #ffffff);
  text-align: left;
  cursor: pointer;
}

.admin-theme-config-panel__tab span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.admin-theme-config-panel__tab small {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary, #64748b);
}

.admin-theme-config-panel__tab.is-active {
  border-color: color-mix(in srgb, var(--brand-main-default, #6f35ff) 34%, rgba(148, 163, 184, 0.16));
  background: color-mix(in srgb, var(--brand-main-default, #6f35ff) 6%, var(--bg-surface, #ffffff));
  box-shadow: 0 14px 32px color-mix(in srgb, var(--brand-main-default, #6f35ff) 8%, transparent);
}

.admin-theme-config-panel__body {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.admin-theme-config-panel__body--layout {
  padding: 0;
}

.admin-theme-sidebar__eyebrow {
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-tertiary, #8b94a7);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.admin-theme-sidebar__title {
  font-size: 24px;
  line-height: 1.3;
  color: var(--text-primary, #0f172a);
}

.admin-theme-sidebar__desc {
  margin-top: 10px;
  color: var(--text-secondary, #64748b);
  line-height: 1.7;
  font-size: 14px;
}

@media (max-width: 1280px) {
  .admin-theme-config-rail {
    border-left: none;
    border-top: 1px solid var(--line-divider, rgba(148, 163, 184, 0.18));
  }

  .admin-theme-config-rail__toggle {
    top: 16px;
    right: 16px;
    left: auto;
    transform: none;
  }
}

@media (max-width: 980px) {
  .admin-theme-config-panel__tabs {
    grid-template-columns: 1fr;
  }
}
</style>
