<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import CanvasAppearancePanel from './CanvasAppearancePanel.vue'

const props = defineProps<{
  miniMapOpen: boolean
  snapToGrid: boolean
  alignmentGuides: boolean
}>()

const emit = defineEmits<{
  (event: 'toggleMiniMap'): void
  (event: 'toggleSnapToGrid'): void
  (event: 'toggleAlignmentGuides'): void
  (event: 'openAssetLibrary'): void
  (event: 'clear'): void
}>()

const { viewport, zoomTo, zoomIn, zoomOut, fitView } = useVueFlow()
const zoomPercent = computed(() => Math.round(viewport.value.zoom * 100))
const zoomInput = ref('100')
const zoomMenuOpen = ref(false)
const appearanceOpen = ref(false)
const shortcutsOpen = ref(false)
const controlsRef = ref<HTMLElement | null>(null)

watch(zoomPercent, value => {
  if (!zoomMenuOpen.value) zoomInput.value = String(value)
})

const closePanels = () => {
  zoomMenuOpen.value = false
  appearanceOpen.value = false
  shortcutsOpen.value = false
}

const closeSiblingPanels = (panel: 'zoom' | 'appearance' | 'shortcuts') => {
  if (panel !== 'zoom') zoomMenuOpen.value = false
  if (panel !== 'appearance') appearanceOpen.value = false
  if (panel !== 'shortcuts') shortcutsOpen.value = false
}

const toggleZoomMenu = () => {
  closeSiblingPanels('zoom')
  zoomMenuOpen.value = !zoomMenuOpen.value
  zoomInput.value = String(zoomPercent.value)
}

const toggleAppearance = () => {
  closeSiblingPanels('appearance')
  appearanceOpen.value = !appearanceOpen.value
}

const toggleShortcuts = () => {
  closeSiblingPanels('shortcuts')
  shortcutsOpen.value = !shortcutsOpen.value
}

const setZoom = (percent: number) => {
  const next = Math.min(800, Math.max(10, Math.round(percent)))
  zoomInput.value = String(next)
  zoomTo(next / 100, { duration: 160 })
}

const applyZoomInput = () => {
  const value = Number.parseInt(zoomInput.value.replace(/[^0-9]/g, ''), 10)
  if (Number.isFinite(value)) setZoom(value)
  else zoomInput.value = String(zoomPercent.value)
}

const handleFitView = () => {
  fitView({ duration: 220, padding: 0.2 })
  zoomMenuOpen.value = false
}

const shortcutSections = [
  {
    title: '创作',
    rows: [
      ['成组', ['⌘', 'G']],
      ['解组', ['⌘', '⇧', 'G']],
      ['连线', ['⌘', 'L']],
      ['复制节点和连线', ['⌘', 'D']],
      ['生成', ['⌘', 'Enter']],
      ['新建节点', ['Tab']],
      ['节点复制', ['⌥', '拖动节点']],
      ['创建副本', ['⌥', '拖动']],
    ],
  },
  {
    title: '缩放',
    rows: [
      ['放大', ['⌘', '+']],
      ['缩小', ['⌘', '−']],
      ['适应画布', ['⌘', '0']],
      ['触控板', ['双指缩放']],
      ['鼠标', ['⌘', '滚轮']],
    ],
  },
  {
    title: '移动画布',
    rows: [
      ['键盘', ['Space']],
      ['触控板', ['双指移动']],
      ['鼠标', ['中键拖动']],
      ['整理画布', ['⌥', '⇧', 'F']],
    ],
  },
  {
    title: '其他',
    rows: [
      ['撤销', ['⌘', 'Z']],
      ['重做', ['⌘', '⇧', 'Z']],
      ['全选', ['⌘', 'A']],
      ['复制 / 粘贴', ['⌘', 'C / V']],
      ['删除', ['⌫']],
    ],
  },
] as const

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (controlsRef.value?.contains(event.target as Node)) return
  closePanels()
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closePanels()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div ref="controlsRef" class="canvas-zoom-controls" data-canvas-no-zoom @click.stop>
    <button
      type="button"
      class="canvas-zoom-controls__btn"
      :class="{ 'is-active': miniMapOpen }"
      aria-label="小地图"
      title="小地图"
      @click="emit('toggleMiniMap')"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="m9 15 2-5 5-2-2 5-5 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>

    <div class="canvas-zoom-controls__zoom">
      <button
        type="button"
        class="canvas-zoom-controls__percent"
        :class="{ 'is-active': zoomMenuOpen }"
        aria-label="缩放百分比"
        @click="toggleZoomMenu"
      >{{ zoomPercent }}%</button>

      <Transition name="canvas-controls-pop">
        <div v-if="zoomMenuOpen" class="canvas-zoom-menu" role="dialog" aria-label="缩放设置" @click.stop>
          <label class="canvas-zoom-menu__input-wrap">
            <input
              v-model="zoomInput"
              class="canvas-zoom-menu__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              aria-label="缩放百分比输入"
              @blur="applyZoomInput"
              @keydown.enter="applyZoomInput"
            />
            <span class="canvas-zoom-menu__suffix">%</span>
          </label>
          <button type="button" class="canvas-zoom-menu__item" @click="zoomIn({ duration: 160 })">
            <span>放大</span><span class="canvas-zoom-menu__shortcut">⌘ +</span>
          </button>
          <button type="button" class="canvas-zoom-menu__item" @click="zoomOut({ duration: 160 })">
            <span>缩小</span><span class="canvas-zoom-menu__shortcut">⌘ -</span>
          </button>
          <button type="button" class="canvas-zoom-menu__item" @click="handleFitView">
            <span>适合屏幕</span><span class="canvas-zoom-menu__shortcut">⌘ 0</span>
          </button>
          <div class="canvas-zoom-menu__divider" aria-hidden="true" />
          <button v-for="preset in [50, 100, 800]" :key="preset" type="button" class="canvas-zoom-menu__item" @click="setZoom(preset)">
            <span>缩放至{{ preset }}%</span>
          </button>
        </div>
      </Transition>
    </div>

    <span class="canvas-zoom-controls__divider" aria-hidden="true" />

    <button
      type="button"
      class="canvas-zoom-controls__btn"
      :class="{ 'is-active': snapToGrid }"
      :aria-pressed="snapToGrid"
      aria-label="网格吸附"
      title="网格吸附"
      @click="emit('toggleSnapToGrid')"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m9.5 14.5-2 2a3.2 3.2 0 0 1-4.5-4.5l3-3a3.2 3.2 0 0 1 4.5 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="m14.5 9.5 2-2a3.2 3.2 0 0 1 4.5 4.5l-3 3a3.2 3.2 0 0 1-4.5 0M8.5 15.5l7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>

    <button type="button" class="canvas-zoom-controls__btn" :class="{ 'is-active': appearanceOpen }" aria-label="画布外观" title="画布外观" @click="toggleAppearance">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="2.2" stroke="currentColor" stroke-width="1.6"/>
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.64 5.64l1.77 1.77m9.18 9.18 1.77 1.77m0-12.72-1.77 1.77m-9.18 9.18-1.77 1.77" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>

    <button type="button" class="canvas-zoom-controls__btn" aria-label="剪辑" title="适应画布" @click="handleFitView">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="m8.7 7.8 9.8 9.7M8.7 16.2 18.5 6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>

    <button type="button" class="canvas-zoom-controls__btn" aria-label="素材库" title="素材库" @click="emit('openAssetLibrary')">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 7.5h6l2-2h9v13h-17v-11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 9.5h17" stroke="currentColor" stroke-width="1.7"/></svg>
    </button>

    <button type="button" class="canvas-zoom-controls__btn canvas-zoom-controls__btn--danger" aria-label="清空画布" title="清空画布" @click="emit('clear')">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14m-9-3h4m-7 3 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>

    <button type="button" class="canvas-zoom-controls__btn" :class="{ 'is-active': shortcutsOpen }" aria-label="快捷键" title="快捷键" @click="toggleShortcuts">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M7 10h2m2 0h2m2 0h2M7 14h7m2 0h1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
    </button>

    <Transition name="canvas-controls-pop">
      <div v-if="appearanceOpen" class="canvas-zoom-controls__appearance" @click.stop>
        <CanvasAppearancePanel
          :snap-to-grid="props.snapToGrid"
          :alignment-guides="props.alignmentGuides"
          @toggle-snap-to-grid="emit('toggleSnapToGrid')"
          @toggle-alignment-guides="emit('toggleAlignmentGuides')"
        />
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="canvas-shortcut-help">
        <div v-if="shortcutsOpen" class="canvas-shortcut-help" role="dialog" aria-modal="false" aria-label="快捷键说明" @click.stop>
          <button type="button" class="canvas-shortcut-help__close" aria-label="关闭快捷键说明" @click="shortcutsOpen = false">×</button>
          <div class="canvas-shortcut-help__layout">
            <section v-for="section in shortcutSections" :key="section.title" class="canvas-shortcut-help__section">
              <h3 class="canvas-shortcut-help__title">{{ section.title }}</h3>
              <div class="canvas-shortcut-help__list">
                <div v-for="row in section.rows" :key="row[0]" class="canvas-shortcut-help__row">
                  <span class="canvas-shortcut-help__label">{{ row[0] }}</span>
                  <span class="canvas-shortcut-help__keys">
                    <kbd v-for="key in row[1]" :key="key" class="canvas-shortcut-help__key" :class="{ 'is-text': key.length > 3 }">{{ key }}</kbd>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.canvas-zoom-controls { position:absolute; bottom:20px; left:calc(20px + var(--canvas-left-chrome-offset, 0px)); z-index:50; display:inline-flex; align-items:center; gap:8px; width:315px; height:40px; padding:0 10px; box-sizing:border-box; border:0; border-radius:8px; background:transparent; color:var(--text-primary); user-select:none; }
.canvas-zoom-controls__btn,.canvas-zoom-controls__percent { display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--text-secondary); cursor:pointer; transition:background-color .12s,color .12s; }
.canvas-zoom-controls__btn { width:26px; flex:0 0 26px; }
.canvas-zoom-controls__btn svg { width:16px; height:16px; }
.canvas-zoom-controls__zoom { position:relative; width:44px; height:26px; }
.canvas-zoom-controls__percent { width:44px; padding:0 8px; font-size:12px; font-variant-numeric:tabular-nums; }
.canvas-zoom-controls__btn:hover,.canvas-zoom-controls__percent:hover,.canvas-zoom-controls__btn.is-active,.canvas-zoom-controls__percent.is-active { background:var(--canvas-float-block-hover); color:var(--text-primary); }
.canvas-zoom-controls__btn:nth-of-type(2).is-active { background:var(--brand-main-block-default); color:var(--brand-main-default); }
.canvas-zoom-controls__btn--danger:hover { background:rgba(239,68,68,.12); color:#ef4444; }
.canvas-zoom-controls__divider { width:1px; height:20px; margin:0 2px; background:var(--stroke-tertiary); }
.canvas-zoom-controls__appearance { position:absolute; bottom:calc(100% + 8px); left:0; z-index:60; }
.canvas-zoom-menu { position:absolute; left:0; bottom:36px; z-index:61; width:238px; padding:8px; box-sizing:border-box; border:1px solid var(--stroke-secondary); border-radius:14px; background:var(--canvas-float-block-default); box-shadow:0 8px 56px rgba(0,0,0,.08); backdrop-filter:blur(var(--canvas-float-backdrop-blur)); }
.canvas-zoom-menu__input-wrap { display:flex; align-items:center; width:220px; height:38px; margin-bottom:6px; padding:0 12px; box-sizing:border-box; border:1px solid var(--stroke-tertiary); border-radius:10px; background:var(--canvas-bg-block-default); }
.canvas-zoom-menu__input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:var(--text-primary); font:inherit; }
.canvas-zoom-menu__suffix,.canvas-zoom-menu__shortcut { color:var(--text-secondary); }
.canvas-zoom-menu__item { display:flex; align-items:center; justify-content:space-between; width:220px; height:36px; padding:0 10px; border:0; border-radius:8px; background:transparent; color:var(--text-secondary); font:inherit; line-height:1.15; cursor:pointer; }
.canvas-zoom-menu__item:hover { background:var(--canvas-float-block-hover); color:var(--text-primary); }
.canvas-zoom-menu__divider { height:1px; margin:6px 0; background:var(--stroke-secondary); }
.canvas-shortcut-help { position:fixed; left:20.5px; right:20.5px; bottom:10px; z-index:120; height:400px; padding:20px 24px; box-sizing:border-box; border:1px solid var(--stroke-secondary, rgba(0,0,0,.05)); border-radius:24px; background:#fefeff; color:var(--text-primary, #0f1419); }
.canvas-shortcut-help__close { position:absolute; top:14px; right:18px; width:28px; height:28px; border:0; border-radius:6px; background:transparent; color:var(--text-secondary); font-size:24px; line-height:1; cursor:pointer; }
.canvas-shortcut-help__close:hover { background:var(--canvas-float-block-hover); }
.canvas-shortcut-help__layout { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); height:100%; }
.canvas-shortcut-help__section { min-width:0; padding:0 16px; border-left:1px solid var(--stroke-secondary); }
.canvas-shortcut-help__section:first-child { padding-left:0; border-left:0; }
.canvas-shortcut-help__title { margin:0 0 12px; color:var(--text-secondary); font-size:14px; font-weight:500; }
.canvas-shortcut-help__list { display:grid; gap:4px; }
.canvas-shortcut-help__row { display:flex; align-items:center; justify-content:space-between; min-height:37px; gap:12px; color:var(--text-secondary); font-size:14px; }
.canvas-shortcut-help__keys { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
.canvas-shortcut-help__key { display:inline-flex; align-items:center; justify-content:center; min-width:30px; height:32px; padding:0 8px; box-sizing:border-box; border:1px solid var(--stroke-tertiary); border-radius:8px; background:rgba(241,242,243,.68); color:var(--text-secondary); font:inherit; box-shadow:0 1px 1px rgba(0,0,0,.02); white-space:nowrap; }
.canvas-shortcut-help__key.is-text { min-width:auto; }
.canvas-controls-pop-enter-active,.canvas-controls-pop-leave-active,.canvas-shortcut-help-enter-active,.canvas-shortcut-help-leave-active { transition:opacity .15s ease,transform .15s ease; }
.canvas-controls-pop-enter-from,.canvas-controls-pop-leave-to { opacity:0; transform:translateY(4px); }
.canvas-shortcut-help-enter-from,.canvas-shortcut-help-leave-to { opacity:0; transform:translateY(8px); }
@media (max-width:768px) { .canvas-shortcut-help { left:10px; right:10px; height:min(70vh,520px); overflow:auto; } .canvas-shortcut-help__layout { grid-template-columns:1fr; height:auto; } .canvas-shortcut-help__section { padding:18px 0; border-left:0; border-top:1px solid var(--stroke-secondary); } .canvas-shortcut-help__section:first-child { border-top:0; } }
</style>
