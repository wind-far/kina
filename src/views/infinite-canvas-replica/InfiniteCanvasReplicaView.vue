<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemePreferenceStore } from '@/stores/theme-preference'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemePreferenceStore()
const canvasTitle = ref('未命名项目')
const replicaFrame = ref<HTMLIFrameElement | null>(null)
const replicaOverlayOpen = ref(false)

const initialPath = computed(() => {
  const projectId = String(route.query.projectId || '').trim()
  if (projectId) return `/canvas/${encodeURIComponent(projectId)}`

  const workflowId = String(route.query.workflowId || '').trim()
  if (workflowId) {
    const params = new URLSearchParams({ source: 'canvasmind' })
    const projectName = String(route.query.projectName || '').trim()
    if (projectName) params.set('title', projectName)
    return `/canvas/${encodeURIComponent(workflowId)}?${params.toString()}`
  }

  return '/canvas?mode=recent'
})
const replicaUrl = computed(() => `/infinite-canvas.html#${initialPath.value}`)

const routeProjectName = computed(() => String(route.query.projectName || '').trim())
const userName = computed(() => {
  const user = authStore.currentUser.value
  return user?.name || user?.maskedPhone || user?.maskedEmail || '个人账户'
})
const userInitial = computed(() => userName.value.slice(0, 1).toUpperCase())
const userAvatar = computed(() => authStore.currentUser.value?.avatarUrl || '')
const resolvedTheme = computed(() => themeStore.currentTheme.value)

const replicaTokenSources = {
  '--background': '--bg-body',
  '--foreground': '--text-primary',
  '--card': '--canvas-node-bg',
  '--card-foreground': '--text-primary',
  '--popover': '--canvas-float-block-default',
  '--popover-foreground': '--text-primary',
  '--primary': '--brand-main-default',
  '--primary-foreground': '--component-primary-button-text-default',
  '--secondary': '--bg-block-secondary-default',
  '--secondary-foreground': '--text-primary',
  '--muted': '--bg-block-secondary-default',
  '--muted-foreground': '--text-secondary',
  '--accent': '--canvas-float-block-hover',
  '--accent-foreground': '--text-primary',
  '--destructive': '--functional-error',
  '--input': '--stroke-primary',
  '--border': '--stroke-secondary',
  '--ring': '--brand-main-default',
  '--bg-body': '--bg-body',
  '--bg-surface': '--bg-surface',
  '--brand-main-default': '--brand-main-default',
  '--brand-main-hover': '--brand-main-hover',
  '--canvas-bg': '--canvas-bg',
  '--canvas-node-bg': '--canvas-node-bg',
  '--canvas-node-border': '--canvas-node-border',
  '--canvas-node-elevated': '--canvas-node-elevated',
  '--canvas-float-block-default': '--canvas-float-block-default',
  '--canvas-float-block-hover': '--canvas-float-block-hover',
  '--canvas-float-block-pressed': '--canvas-float-block-pressed',
  '--canvas-selection-border': '--canvas-selection-border',
  '--text-primary': '--text-primary',
  '--text-secondary': '--text-secondary',
  '--text-tertiary': '--text-tertiary',
  '--text-placeholder': '--text-placeholder',
  '--text-disabled': '--text-disabled',
  '--stroke-primary': '--stroke-primary',
  '--stroke-secondary': '--stroke-secondary',
  '--stroke-tertiary': '--stroke-tertiary',
  '--functional-error': '--functional-error',
} as const

const safeReturnTo = computed(() => {
  const target = String(route.query.returnTo || '').trim()
  return target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/canvas')
    ? target
    : '/agentic-assets-canvas'
})

const handleBack = () => router.push(safeReturnTo.value)
const openAccount = () => router.push('/account')

const collectReplicaTokens = () => {
  const bodyStyles = window.getComputedStyle(document.body)
  const rootStyles = window.getComputedStyle(document.documentElement)

  return Object.fromEntries(Object.entries(replicaTokenSources).flatMap(([target, source]) => {
    const value = bodyStyles.getPropertyValue(source).trim() || rootStyles.getPropertyValue(source).trim()
    return value ? [[target, value]] : []
  }))
}

const syncReplicaTheme = async () => {
  await nextTick()
  replicaFrame.value?.contentWindow?.postMessage({
    type: 'canvasmind:theme',
    theme: resolvedTheme.value,
    tokens: collectReplicaTokens(),
  }, window.location.origin)
}

const handleReplicaMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return
  if (!event.data) return

  if (event.data.type === 'canvasmind:project-meta') {
    const title = String(event.data.title || '').trim()
    if (title) canvasTitle.value = title
    return
  }

  if (event.data.type === 'canvasmind:overlay-state' && event.data.overlay === 'channel-editor') {
    replicaOverlayOpen.value = Boolean(event.data.open)
  }
}

const handleReplicaLoad = () => {
  replicaOverlayOpen.value = false
  void syncReplicaTheme()
}

watch(routeProjectName, (title) => {
  canvasTitle.value = title || '未命名项目'
}, { immediate: true })

watch(resolvedTheme, () => void syncReplicaTheme())

onMounted(() => {
  window.addEventListener('message', handleReplicaMessage)
  if (!authStore.sessionInitialized.value) void authStore.loadSession()
})

onUnmounted(() => window.removeEventListener('message', handleReplicaMessage))
</script>

<template>
  <main
    class="infinite-canvas-replica"
    :class="`infinite-canvas-replica--${resolvedTheme}`"
  >
    <header class="infinite-canvas-replica__nav">
      <div class="infinite-canvas-replica__nav-left">
        <button
          class="infinite-canvas-replica__icon-button"
          type="button"
          aria-label="返回"
          title="返回项目列表"
          @click="handleBack"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m15 19-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="infinite-canvas-replica__project-meta">
          <strong :title="canvasTitle">{{ canvasTitle }}</strong>
          <span>草稿 · 已自动保存</span>
        </div>
      </div>

      <button v-show="!replicaOverlayOpen" class="infinite-canvas-replica__account" type="button" @click="openAccount">
        <img v-if="userAvatar" :src="userAvatar" alt="" />
        <span v-else class="infinite-canvas-replica__account-fallback">{{ userInitial }}</span>
        <span class="infinite-canvas-replica__account-name">{{ userName }}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <iframe
      ref="replicaFrame"
      class="infinite-canvas-replica__frame"
      :src="replicaUrl"
      title="Infinite Canvas 完整工作台"
      allow="clipboard-read; clipboard-write; fullscreen"
      @load="handleReplicaLoad"
    />
  </main>
</template>

<style scoped>
.infinite-canvas-replica {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--canvas-bg, var(--bg-body));
}

.infinite-canvas-replica__nav {
  position: absolute;
  z-index: 20;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  height: 56px;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: var(--text-primary);
  pointer-events: none;
}

.infinite-canvas-replica__nav-left,
.infinite-canvas-replica__account {
  pointer-events: auto;
}

.infinite-canvas-replica__nav-left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.infinite-canvas-replica__icon-button,
.infinite-canvas-replica__account {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.infinite-canvas-replica__icon-button {
  display: grid;
  width: 32px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
}

.infinite-canvas-replica__icon-button:hover,
.infinite-canvas-replica__account:hover {
  background: var(--canvas-float-block-hover);
}

.infinite-canvas-replica__icon-button:focus-visible,
.infinite-canvas-replica__account:focus-visible {
  outline: 2px solid var(--brand-main-default);
  outline-offset: 2px;
}

.infinite-canvas-replica__icon-button svg {
  width: 18px;
  height: 18px;
}

.infinite-canvas-replica__project-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.infinite-canvas-replica__project-meta strong {
  max-width: min(42vw, 360px);
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.infinite-canvas-replica__project-meta span {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 14px;
}

.infinite-canvas-replica__account {
  display: flex;
  height: 40px;
  align-items: center;
  gap: 9px;
  padding: 4px 8px 4px 5px;
  border-radius: 10px;
  font: inherit;
}

.infinite-canvas-replica__account img,
.infinite-canvas-replica__account-fallback {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.infinite-canvas-replica__account img {
  object-fit: cover;
}

.infinite-canvas-replica__account-fallback {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #ff9d45 0%, #ff5f76 52%, #8b5cf6 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.infinite-canvas-replica__account-name {
  max-width: 180px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.infinite-canvas-replica__account > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.infinite-canvas-replica__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--canvas-bg, var(--bg-body));
}

@media (max-width: 640px) {
  .infinite-canvas-replica__nav {
    padding: 0 8px;
  }

  .infinite-canvas-replica__project-meta strong {
    max-width: 46vw;
  }

  .infinite-canvas-replica__account-name {
    display: none;
  }
}
</style>
