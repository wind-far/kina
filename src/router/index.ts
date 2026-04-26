import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Home from '../views/home/home.vue'
import Generate from '../views/generate/generate.vue'
import Canana from '../views/canana/canana.vue'
import AccountManagement from '../views/account/AccountManagement.vue'
import PublishCenter from '../views/publish/PublishCenter.vue'
import AssetManagement from '../views/asset/AssetManagement.vue'
import { useAuthStore } from '../stores/auth'
const Workflow = () => import('../views/workflow/index.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/generate',
    name: 'Generate',
    component: Generate
  },
  {
    path: '/canvas',
    name: 'Canvas',
    component: Canana
  },
  {
    path: '/account',
    name: 'AccountManagement',
    component: AccountManagement,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/publish',
    name: 'PublishCenter',
    component: PublishCenter
  },
  {
    path: '/asset',
    name: 'AssetManagement',
    component: AssetManagement
  },
  {
    path: '/workflow',
    name: 'Workflow',
    component: Workflow
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 对需要登录的页面做统一拦截，未登录时回到首页显示登录入口。
router.beforeEach(async (to) => {
  if (!to.meta?.requiresAuth) {
    return true
  }

  const authStore = useAuthStore()
  if (!authStore.sessionInitialized.value && !authStore.sessionLoading.value) {
    await authStore.loadSession()
  }

  if (authStore.sessionLoading.value) {
    await authStore.loadSession()
  }

  if (!authStore.isLoggedIn.value) {
    return {
      path: '/',
      query: {
        login: '1',
      },
    }
  }

  return true
})

export default router
