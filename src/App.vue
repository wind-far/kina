<template>
  <ElConfigProvider :locale="zhCn" size="default" :z-index="30000">
    <div id="app">
      <RouteProgressBar />
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
      <GlobalLoadingOverlay />
    </div>
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { watch, defineAsyncComponent } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ThemeToggle from '@/components/ThemeToggle.vue'
import RouteProgressBar from '@/components/common/RouteProgressBar.vue'
import GlobalLoadingOverlay from '@/components/common/GlobalLoadingOverlay.vue'
// 登录与营销弹窗首屏不可见，懒加载到弹出时再下载，缩小主入口体积
const LoginModal = defineAsyncComponent(() => import('@/components/LoginModal.vue'))
const MarketingModal = defineAsyncComponent(() => import('@/components/MarketingModal.vue'))
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
