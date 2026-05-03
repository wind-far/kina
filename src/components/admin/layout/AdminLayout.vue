<template>
  <div class="admin-layout" :class="{ 'is-collapsed': isDesktopCollapsed, 'is-mobile-open': mobileSidebarOpen }">
    <AdminSidebar />
    <button v-if="isMobile && mobileSidebarOpen" class="admin-layout__mask" type="button" aria-label="关闭侧边栏" @click="closeMobileSidebar" />
    <main class="admin-main">
      <AdminHeader :title="headerTitle" :description="headerDescription" />
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AdminHeader from './AdminHeader.vue'
import AdminSidebar from './AdminSidebar.vue'
import { adminNavGroups } from './admin-nav'
import '@/components/admin/admin.css'
import { createAdminLayoutContext, provideAdminLayoutContext } from './useAdminLayout'

const route = useRoute()
const layoutContext = createAdminLayoutContext()

provideAdminLayoutContext({
  sidebarCollapsed: layoutContext.sidebarCollapsed,
  mobileSidebarOpen: layoutContext.mobileSidebarOpen,
  isMobile: layoutContext.isMobile,
  toggleSidebar: layoutContext.toggleSidebar,
  toggleMobileSidebar: layoutContext.toggleMobileSidebar,
  closeMobileSidebar: layoutContext.closeMobileSidebar,
})

const currentNavItem = computed(() => {
  for (const group of adminNavGroups) {
    const matchedItem = group.items.find((item) => route.path === item.path || route.path.startsWith(item.path + '/'))
    if (matchedItem) {
      return matchedItem
    }
  }

  return null
})

const headerTitle = computed(() => currentNavItem.value?.label || '管理台')
const headerDescription = computed(() => currentNavItem.value?.description || '统一管理当前项目的配置、资源与生成记录。')
const isDesktopCollapsed = computed(() => !layoutContext.isMobile.value && layoutContext.sidebarCollapsed.value)
const isMobile = computed(() => layoutContext.isMobile.value)
const mobileSidebarOpen = computed(() => layoutContext.mobileSidebarOpen.value)
const closeMobileSidebar = layoutContext.closeMobileSidebar

const handleResize = () => {
  layoutContext.syncViewportState()
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>
