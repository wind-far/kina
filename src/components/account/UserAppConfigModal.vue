<template>
  <Teleport to="body">
    <Transition name="user-config-modal">
      <div
        v-if="modelValue"
        class="user-config-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-config-modal-title"
        @mousedown.self="close"
      >
        <section class="user-config-modal__panel" @mousedown.stop>
          <header class="user-config-modal__header">
            <div>
              <h2 id="user-config-modal-title">配置与用户偏好</h2>
              <p>渠道聚合、默认模型、同步与本地存储</p>
            </div>
            <button type="button" aria-label="关闭配置" title="关闭" @click="close">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <iframe
            ref="configFrame"
            class="user-config-modal__frame"
            src="/infinite-canvas.html#/config?embedded=account"
            title="配置与用户偏好"
            allow="clipboard-read; clipboard-write"
            @load="syncTheme"
          />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useThemePreferenceStore } from '@/stores/theme-preference'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const themeStore = useThemePreferenceStore()
const configFrame = ref<HTMLIFrameElement | null>(null)
let previousBodyOverflow = ''

const close = () => emit('update:modelValue', false)

const syncTheme = () => {
  configFrame.value?.contentWindow?.postMessage({
    type: 'canvasmind:theme',
    theme: themeStore.currentTheme.value,
  }, window.location.origin)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue) close()
}

const handleMessage = (event: MessageEvent) => {
  if (event.origin !== window.location.origin) return
  if (event.source !== configFrame.value?.contentWindow) return
  if (event.data?.type === 'canvasmind:config-close') close()
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.body.classList.add('user-config-modal-open')
      await nextTick()
      syncTheme()
      return
    }
    document.body.style.overflow = previousBodyOverflow
    document.body.classList.remove('user-config-modal-open')
  },
)

watch(() => themeStore.currentTheme.value, syncTheme)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  document.body.classList.remove('user-config-modal-open')
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('message', handleMessage)
})
</script>

<style scoped>
:global(body.user-config-modal-open .theme-toggle) {
  visibility: hidden;
}

.user-config-modal {
  position: fixed;
  /* 主站主题切换按钮使用 9999，配置弹层必须完整遮盖页面级浮动控件。 */
  z-index: 12000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 32px;
  background: rgba(15, 15, 15, .46);
  backdrop-filter: blur(1px);
}

.user-config-modal__panel {
  display: flex;
  width: min(1960px, calc(100vw - 64px));
  height: min(1026px, calc(100vh - 48px));
  min-height: 560px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, .06);
  border-radius: 18px;
  background: var(--bg-surface, #fff);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .24);
}

.user-config-modal__header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  padding: 42px 48px 18px;
  color: var(--text-primary, #1c1917);
}

.user-config-modal__header h2 {
  margin: 0;
  font-size: 30px;
  font-weight: 650;
  line-height: 1.3;
}

.user-config-modal__header p {
  margin: 10px 0 0;
  color: var(--text-secondary, #78716c);
  font-size: 18px;
  line-height: 1.5;
}

.user-config-modal__header button {
  display: grid;
  width: 42px;
  height: 42px;
  margin: -8px -8px 0 0;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary, #78716c);
  cursor: pointer;
}

.user-config-modal__header button:hover {
  background: rgba(0, 0, 0, .05);
  color: var(--text-primary, #1c1917);
}

.user-config-modal__header svg {
  width: 30px;
  height: 30px;
}

.user-config-modal__frame {
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  border: 0;
  background: var(--bg-surface, #fff);
}

.user-config-modal-enter-active,
.user-config-modal-leave-active {
  transition: opacity .18s ease;
}

.user-config-modal-enter-active .user-config-modal__panel,
.user-config-modal-leave-active .user-config-modal__panel {
  transition: transform .18s ease, opacity .18s ease;
}

.user-config-modal-enter-from,
.user-config-modal-leave-to {
  opacity: 0;
}

.user-config-modal-enter-from .user-config-modal__panel,
.user-config-modal-leave-to .user-config-modal__panel {
  opacity: 0;
  transform: translateY(8px) scale(.99);
}

@media (max-width: 768px) {
  .user-config-modal {
    padding: 12px;
  }

  .user-config-modal__panel {
    width: calc(100vw - 24px);
    height: calc(100vh - 24px);
    min-height: 0;
    border-radius: 14px;
  }

  .user-config-modal__header {
    padding: 24px 20px 12px;
  }

  .user-config-modal__header h2 {
    font-size: 22px;
  }

  .user-config-modal__header p {
    font-size: 14px;
  }
}
</style>
