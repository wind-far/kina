<template>
  <div id="app">
    <router-view />
    <ThemeToggle />
    <LoginModal
      :visible="loginModalVisible"
      @update:visible="setLoginModalVisible"
    />
    <MarketingModal
      :visible="marketingModalVisible"
      @update:visible="setMarketingModalVisible"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LoginModal from '@/components/LoginModal.vue'
import MarketingModal from '@/components/MarketingModal.vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLoginModalStore } from '@/stores/login-modal'
import { useMarketingModalStore } from '@/stores/marketing-modal'

// 读取全局登录态与登录弹窗状态。
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { loginModalVisible, openLoginModal, setLoginModalVisible } = useLoginModalStore()
const { marketingModalVisible, setMarketingModalVisible } = useMarketingModalStore()
// 通过路由 query 统一拉起全局登录弹窗，兼容守卫回跳场景。
watch(() => route.query.login, (loginFlag) => {
  if (loginFlag !== '1' || authStore.isLoggedIn.value) {
    return
  }

  openLoginModal('route-guard')
  void router.replace({
    path: route.path,
    query: {
      ...route.query,
      login: undefined,
    },
  })
}, {
  immediate: true,
})
</script>

<style>
 
</style>
