<template>
  <aside class="admin-sidebar" :class="{ 'is-collapsed': isDesktopCollapsed, 'is-mobile-open': mobileSidebarOpen }">
    <div class="admin-sidebar__brand">
      <h1 class="admin-sidebar__title">{{ isDesktopCollapsed ? '管' : 'Canana 管理台' }}</h1>
      <div v-if="!isDesktopCollapsed" class="admin-sidebar__subtitle">延续当前前端主题体系的后台骨架</div>
    </div>

    <nav class="admin-sidebar__nav">
      <div v-for="group in adminNavGroups" :key="group.title">
        <div v-if="!isDesktopCollapsed" class="admin-sidebar__group-title">{{ group.title }}</div>
        <RouterLink
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="admin-sidebar__link"
          :class="{ 'is-active': isActive(item.path) }"
          :title="item.label"
          @click="closeMobileSidebar"
        >
          <span class="admin-sidebar__link-mark">{{ getShortLabel(item.label) }}</span>
          <span v-if="!isDesktopCollapsed" class="admin-sidebar__link-text">{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <div v-if="!isDesktopCollapsed" class="admin-sidebar__footer">
      当前阶段优先完成配置与数据页，后续再补权限与统计增强。
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { adminNavGroups } from './admin-nav'
import { useAdminLayoutContext } from './useAdminLayout'

const route = useRoute()
const { closeMobileSidebar, isDesktopCollapsed, mobileSidebarOpen } = useAdminLayoutContext()

const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

// 侧栏折叠后仅保留一个短标签，保证导航仍可识别。
const getShortLabel = (label: string) => {
  const normalizedLabel = String(label || '').trim()
  return normalizedLabel.slice(0, 1) || '•'
}
</script>
