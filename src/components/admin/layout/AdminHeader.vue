<template>
  <header class="admin-header">
    <div class="admin-header__left">
      <button class="admin-header__menu" type="button" :aria-label="isMobile ? '打开侧边栏' : '折叠侧边栏'" @click="toggleSidebar">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="admin-header__meta">
        <h2 class="admin-header__title">{{ title }}</h2>
        <div class="admin-header__description">{{ description }}</div>
      </div>
    </div>

    <div class="admin-header__right">
      <span class="admin-header__tag">管理后台</span>
      <span class="admin-header__user">{{ userDisplayName }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminLayoutContext } from './useAdminLayout'

defineProps<{
  title: string
  description: string
}>()

const authStore = useAuthStore()
const { toggleSidebar, isMobile } = useAdminLayoutContext()

const userDisplayName = computed(() => {
  const name = authStore.currentUser.value?.name?.trim()
  if (name) {
    return name.slice(0, 8)
  }

  return '已登录'
})
</script>
