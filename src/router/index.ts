import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Home from '../views/home/home.vue'
import Generate from '../views/generate/generate.vue'
import Canana from '../views/canana/canana.vue'
import AccountManagement from '../views/account/AccountManagement.vue'
import PublishCenter from '../views/publish/PublishCenter.vue'
import AssetManagement from '../views/asset/AssetManagement.vue'
import { useAuthStore } from '../stores/auth'
const Workflow = () => import('../views/workflow/index.vue')
const PolicyDetail = () => import('../views/policies/PolicyDetail.vue')
const AdminLayout = () => import('../components/admin/layout/AdminLayout.vue')
const AdminDashboard = () => import('../views/admin/dashboard/AdminDashboard.vue')
const AdminAssets = () => import('../views/admin/assets/AdminAssets.vue')
const AdminGenerations = () => import('../views/admin/generations/AdminGenerations.vue')
const AdminMarketing = () => import('../views/admin/marketing/AdminMarketing.vue')
const AdminSkills = () => import('../views/admin/skills/AdminSkills.vue')
const AdminProviders = () => import('../views/admin/providers/AdminProviders.vue')
const AdminStorage = () => import('../views/admin/storage/AdminStorage.vue')
const AdminSystem = () => import('../views/admin/system/AdminSystem.vue')
const AdminUsers = () => import('../views/admin/users/AdminUsers.vue')
const AdminAccessDenied = () => import('../views/admin/AdminAccessDenied.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/generate',
    name: 'Generate',
    component: Generate,
  },
  {
    path: '/canvas',
    name: 'Canvas',
    component: Canana,
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
    component: PublishCenter,
  },
  {
    path: '/asset',
    name: 'AssetManagement',
    component: AssetManagement,
  },
  {
    path: '/workflow',
    name: 'Workflow',
    component: Workflow,
  },
  {
    path: '/policies/:type',
    name: 'PolicyDetail',
    component: PolicyDetail,
  },
  {
    path: '/admin-forbidden',
    name: 'AdminAccessDenied',
    component: AdminAccessDenied,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: {
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        redirect: '/admin/dashboard',
      },
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: AdminDashboard,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'assets',
        name: 'AdminAssets',
        component: AdminAssets,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'generations',
        name: 'AdminGenerations',
        component: AdminGenerations,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'publish',
        redirect: '/admin/assets',
      },

      {
        path: 'marketing',
        name: 'AdminMarketing',
        component: AdminMarketing,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'skills',
        name: 'AdminSkills',
        component: AdminSkills,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'providers',
        name: 'AdminProviders',
        component: AdminProviders,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'models',
        redirect: '/admin/providers',
      },
      {
        path: 'storage',
        name: 'AdminStorage',
        component: AdminStorage,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: AdminUsers,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
      {
        path: 'system',
        name: 'AdminSystem',
        component: AdminSystem,
        meta: {
          requiresAuth: true,
          requiresAdmin: true,
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
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

  if (to.meta?.requiresAdmin && !authStore.isAdmin.value) {
    return {
      path: '/admin-forbidden',
    }
  }

  return true
})

export default router
