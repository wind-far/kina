import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import '@styles/styles.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useSystemSettingsStore } from './stores/system-settings'

const app = createApp(App)

// 全局注册 Element Plus
app.use(ElementPlus, {
  locale: zhCn,  // 中文语言包
  size: 'default', // 默认尺寸
  zIndex: 30000, // 提高全局浮层层级，避免被图片详情等自定义弹层遮挡
})

app.use(router)

const authStore = useAuthStore()
const systemSettingsStore = useSystemSettingsStore()

void Promise.allSettled([
  authStore.loadSession(),
  authStore.loadMethods(),
  systemSettingsStore.loadPublicSettings(),
]).finally(() => {
  app.mount('#app')
})
