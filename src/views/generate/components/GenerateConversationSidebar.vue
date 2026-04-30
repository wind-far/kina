<template>
  <aside v-if="!collapsed" class="sidebar-Q5Aoit">
    <div class="header-MPVCyQ">
      <div class="header-left-sIxFfE">
        <span class="title-text-RdcKCa">{{ title }}</span>
      </div>
      <div class="header-right-Vyu_6e">
        <button
          class="lv-btn lv-btn-text lv-btn-size-default lv-btn-shape-square lv-btn-icon-only icon-button-Ao3wcq"
          type="button"
          @click="emit('toggle-sidebar')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path data-follow-fill="currentColor" :d="collapseToggleIconPath" fill="currentColor"></path>
            </g>
          </svg>
        </button>
      </div>
    </div>

    <div ref="listRef" class="list-JWYG84">
      <div class="sticky-top-xH7Ldi" :class="{ 'scrolled-V1kU7f': isListScrolled }">
        <div class="new-conversation-entry-_B5dlN active-aic4ZS" @click="emit('create-session')">
          <div class="new-conversation-icon-kkgjyz">
            <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path data-follow-fill="currentColor" d="M11 2.592a1 1 0 1 1 0 2H7.566a3 3 0 0 0-3 3v8.894a3 3 0 0 0 3 3h8.895a3 3 0 0 0 3-3V13a1 1 0 0 1 2 0v3.486a5 5 0 0 1-5 5H7.566l-.256-.006a5 5 0 0 1-4.744-4.994V7.592a5 5 0 0 1 5-5H11ZM19.012 2A2.99 2.99 0 0 1 22 4.988a2.989 2.989 0 0 1-.875 2.113l-8.295 8.294a.984.984 0 0 1-.465.263l-3.748.938a1 1 0 0 1-1.213-1.213l.938-3.748a1 1 0 0 1 .262-.465L16.9 2.875c.56-.56 1.32-.875 2.113-.875Zm0 2a.988.988 0 0 0-.698.29l-8.1 8.098-.466 1.863 1.863-.466 8.1-8.098A.987.987 0 0 0 19.01 4Z" fill="currentColor"></path>
              </g>
            </svg>
          </div>
          <span class="new-conversation-text-ltRCwk">新对话</span>
        </div>
        <div class="sticky-divider-FrrR_Y"></div>
      </div>

      <div class="tooltip-trigger-shell-Lq7jCE">
        <div
          class="conversation-item-MI_69d is-default-trS4Ii"
          :class="{ 'active-aic4ZS': activeSessionId === defaultSession.id }"
          @click="emit('select-default')"
        >
          <div class="item-media-IKBsbV">
            <div v-if="defaultSession.imageUrl" class="item-media-img-nt18oM">
              <img :src="defaultSession.imageUrl" :alt="defaultSession.title" crossorigin="anonymous">
            </div>
            <div v-else class="item-media-icon-Ln2eHX">
              <svg class="media-icon-svg-fF5VvP" width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" d="M20 6a2 2 0 0 1 2 2v7.5A2.5 2.5 0 0 1 19.5 18H14l-3.293 3.293a1 1 0 0 1-1.414-1.414L10.586 18H4.5A2.5 2.5 0 0 1 2 15.5V8a2 2 0 0 1 2-2h16Z" fill="currentColor"></path>
                </g>
              </svg>
            </div>
          </div>
          <div class="item-text-area-GbxMR4">
            <span class="item-name-k1u50X">{{ defaultSession.title }}</span>
          </div>
        </div>
      </div>

      <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
      <div class="section-label-N9IWUc">最近</div>

      <div v-if="loading" class="session-status-URzD3W">
        <span class="session-status-text-Qs0Qyf">会话加载中...</span>
      </div>

      <div v-else-if="!sessions.length" class="session-status-URzD3W">
        <span class="session-status-text-Qs0Qyf">还没有最近会话</span>
      </div>

      <div
        v-else
        v-for="session in sessions"
        :key="session.id"
        class="tooltip-trigger-shell-Lq7jCE"
      >
        <div
          class="conversation-item-MI_69d"
          :class="{
            'active-aic4ZS': activeSessionId === session.id,
            'menu-open-lVbR4V': openedSessionMenuId === session.id,
          }"
          @click="emit('select-session', session.id)"
        >
          <div class="item-media-IKBsbV">
            <div v-if="session.imageUrl" class="item-media-img-nt18oM">
              <img :src="session.imageUrl" :alt="session.title" crossorigin="anonymous">
            </div>
            <div v-else class="item-media-icon-Ln2eHX">
              <svg class="media-icon-svg-fF5VvP" width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" d="M20 6a2 2 0 0 1 2 2v7.5A2.5 2.5 0 0 1 19.5 18H14l-3.293 3.293a1 1 0 0 1-1.414-1.414L10.586 18H4.5A2.5 2.5 0 0 1 2 15.5V8a2 2 0 0 1 2-2h16Z" fill="currentColor"></path>
                </g>
              </svg>
            </div>
          </div>
          <div class="item-text-area-GbxMR4">
            <span class="item-name-k1u50X">{{ session.title }}</span>
          </div>
          <el-dropdown
            class="more-dropdown-trigger-JKx2pQ"
            trigger="click"
            placement="bottom-end"
            :offset="2"
            popper-class="conversation-dropdown-panel-YLxZyR"
            @visible-change="openedSessionMenuId = $event ? session.id : ''"
            @command="handleSessionDropdownCommand(session.id, $event)"
          >
            <div class="more-button-LARylx" @click.stop>
              <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <path data-follow-fill="currentColor" d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
                </g>
              </svg>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item class="menu-item-IIjppP" command="rename">
                  <span class="menu-item-content-o9vlmB">
                    <svg class="menu-item-icon-K8w8qM" width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path data-follow-fill="currentColor" d="M16.293 3.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-9.5 9.5a1 1 0 0 1-.464.263l-4 1a1 1 0 0 1-1.213-1.213l1-4a1 1 0 0 1 .263-.464l9.5-9.5Zm.707 2.121-8.883 8.884-.5 2 2-.5L18.5 6.914l-1.5-1.5ZM4 20a1 1 0 0 1 1-1h15a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" fill="currentColor"></path>
                      </g>
                    </svg>
                    <span class="menu-item-label-IYf2z9">重命名</span>
                  </span>
                </el-dropdown-item>
                <el-dropdown-item class="menu-item-IIjppP danger-zMx4rT" command="delete">
                  <span class="menu-item-content-o9vlmB">
                    <svg class="menu-item-icon-K8w8qM" width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path data-follow-fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v11a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm5 2h-4V5h4V5Zm-6 2h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7Zm2 3a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Z" fill="currentColor"></path>
                      </g>
                    </svg>
                    <span class="menu-item-label-IYf2z9">删除</span>
                  </span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="list-scrollbar-oNfnSF" style="display:none"></div>
    </div>
  </aside>
  <aside v-else class="collapsed-bar-YV_HpR">
    <button class="collapsed-text-v2gTI4" type="button" @click="emit('create-session')">
      新对话
    </button>
    <span class="collapsed-divider-O1XKbf"></span>
    <button
      class="lv-btn lv-btn-text lv-btn-size-default lv-btn-shape-square lv-btn-icon-only collapsed-icon-button-O8MpoM"
      type="button"
      @click="emit('toggle-sidebar')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path data-follow-fill="currentColor" :d="collapseToggleIconPath" fill="currentColor"></path>
        </g>
      </svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface GenerateConversationSidebarItem {
  id: string
  title: string
  imageUrl?: string
}

withDefaults(defineProps<{
  title?: string
  activeSessionId?: string
  collapsed?: boolean
  loading?: boolean
  defaultSession?: GenerateConversationSidebarItem
  sessions?: GenerateConversationSidebarItem[]
}>(), {
  title: '开启创作',
  activeSessionId: '',
  collapsed: false,
  loading: false,
  defaultSession: () => ({
    id: 'default',
    title: '默认创作',
    imageUrl: '',
  }),
  sessions: () => [],
})

const emit = defineEmits<{
  'toggle-sidebar': []
  'create-session': []
  'select-default': []
  'select-session': [id: string]
  'rename-session': [id: string]
  'delete-session': [id: string]
}>()

// 折叠/展开切换图标统一复用，避免前后两处图标路径漂移。
const collapseToggleIconPath = 'M17.5 3A4.5 4.5 0 0 1 22 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-11A4.5 4.5 0 0 1 2 16.5v-9A4.5 4.5 0 0 1 6.5 3h11Zm-6.3 16h6.3a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 17.5 5h-6.3v14ZM6.5 5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19h2.7V5H6.5Z'

const listRef = ref<HTMLElement | null>(null)
const isListScrolled = ref(false)
const openedSessionMenuId = ref('')

// 对齐参考 HTML 的吸顶分割线表现：列表滚动后显示细分隔线。
const syncListScrolledState = () => {
  isListScrolled.value = (listRef.value?.scrollTop || 0) > 0
}

onMounted(() => {
  nextTick(() => {
    syncListScrolledState()
    listRef.value?.addEventListener('scroll', syncListScrolledState, { passive: true })
  })
})

watch(listRef, (currentElement, previousElement) => {
  if (previousElement) {
    previousElement.removeEventListener('scroll', syncListScrolledState)
  }
  if (currentElement) {
    syncListScrolledState()
    currentElement.addEventListener('scroll', syncListScrolledState, { passive: true })
  }
})

onBeforeUnmount(() => {
  listRef.value?.removeEventListener('scroll', syncListScrolledState)
})

const handleSessionCommand = (id: string, command: string | number | object) => {
  if (command === 'rename') {
    emit('rename-session', id)
    return
  }

  if (command === 'delete') {
    emit('delete-session', id)
  }
}

const handleSessionDropdownCommand = (id: string, command: string | number | object) => {
  handleSessionCommand(id, command)
  openedSessionMenuId.value = ''
}
</script>

<style>
.sidebar-Q5Aoit {
    background: var(--bg-surface, #fff);
    border-left: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    border-right: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100%;
    min-width: 240px;
    padding-top: 12px;
    position: relative;
    width: 240px
}

.header-MPVCyQ {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex-shrink: 0;
    height: 52px;
    justify-content: space-between;
    padding: 8px 16px 8px 12px
}

.header-left-sIxFfE {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
    padding: 0 8px
}

.title-text-RdcKCa {
    color: var(--component-primary-text-button-default, #0f1419);
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
}

.header-right-Vyu_6e {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 4px
}

.icon-button-Ao3wcq {
    -webkit-appearance: none;
    appearance: none;
    align-items: center;
    background: transparent;
    border: none;
    box-sizing: border-box;
    box-shadow: none;
    cursor: pointer;
    display: flex;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background-color .2s ease, color .15s ease
}

.icon-button-Ao3wcq.lv-btn-text:not(.lv-btn-disabled) {
    color: var(--text-primary, #0f1419)
}

.icon-button-Ao3wcq.lv-btn-text:not(.lv-btn-disabled):not(.lv-btn-loading):hover {
    background-color: var(--bg-block-primary-hover, rgba(0, 0, 0, .04));
    border-color: transparent;
    color: var(--text-primary, #0f1419)
}

.icon-button-Ao3wcq.lv-btn-text:not(.lv-btn-disabled):not(.lv-btn-loading):active {
    background-color: var(--bg-block-primary-pressed, rgba(0, 0, 0, .06));
    border-color: transparent;
    color: var(--text-primary, #0f1419)
}

.icon-button-Ao3wcq:disabled {
    cursor: not-allowed;
    opacity: .4
}

.list-JWYG84 {
    display: flex;
    flex: 1 1;
    flex-direction: column;
    gap: 4px;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 16px 20px;
    -ms-scroll-chaining: none;
    overscroll-behavior: none;
    scrollbar-width: none
}

.list-JWYG84::-webkit-scrollbar {
    height: 0;
    width: 0
}

.collapsed-bar-YV_HpR {
    align-items: center;
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    background: var(--component-float-bar-bg, hsla(0, 0%, 100%, .92));
    border: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    border-radius: 8px;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    height: 36px;
    justify-content: center;
    left: 40px;
    padding: 0 4px;
    position: absolute;
    top: 20px;
    transition: border-color .2s ease, background-color .2s ease;
    z-index: 10
}

.collapsed-bar-YV_HpR:hover {
    border-color: var(--stroke-primary, rgba(0, 0, 0, .07))
}

.collapsed-bar-YV_HpR .lv-btn-shape-square {
    border-radius: 6px !important
}

.collapsed-text-v2gTI4 {
    -webkit-appearance: none;
    appearance: none;
    align-items: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    box-shadow: none;
    color: var(--component-primary-text-button-default, #0f1419);
    cursor: pointer;
    display: flex;
    font-size: 13px;
    font-weight: 500;
    gap: 4px;
    height: 28px;
    justify-content: center;
    line-height: 22px;
    margin: 0;
    outline: none;
    overflow: hidden;
    padding: 0 8px;
    -webkit-tap-highlight-color: transparent;
    text-overflow: ellipsis;
    transition: background-color .15s ease;
    white-space: nowrap
}

.collapsed-text-v2gTI4:hover {
    background: var(--bg-block-secondary-hover, rgba(0, 0, 0, .05))
}

.collapsed-divider-O1XKbf {
    background: var(--stroke-secondary, rgba(0, 0, 0, .05));
    flex-shrink: 0;
    height: 10px;
    width: 1px
}

.collapsed-icon-button-O8MpoM {
    -webkit-appearance: none;
    appearance: none;
    align-items: center;
    background: transparent;
    border: none;
    box-sizing: border-box;
    box-shadow: none;
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    margin: 0;
    outline: none;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    transition: background-color .2s ease
}

.collapsed-icon-button-O8MpoM.lv-btn-text:not(.lv-btn-disabled) {
    color: var(--text-primary, #0f1419)
}

.collapsed-icon-button-O8MpoM.lv-btn-text:not(.lv-btn-disabled):not(.lv-btn-loading):hover {
    background-color: var(--bg-block-secondary-hover, rgba(0, 0, 0, .03));
    border-color: transparent;
    color: var(--text-primary, #0f1419)
}

.collapsed-icon-button-O8MpoM.lv-btn-text:not(.lv-btn-disabled):not(.lv-btn-loading):active {
    border-color: transparent;
    color: var(--text-primary, #0f1419)
}

.session-status-URzD3W {
    align-items: center;
    border-radius: 8px;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    min-height: 72px;
    padding: 8px 12px
}

.session-status-text-Qs0Qyf {
    color: var(--text-placeholder, rgba(83, 100, 113, .35));
    font-size: 12px;
    line-height: 20px;
    text-align: center
}

.sticky-top-xH7Ldi {
    background: var(--bg-surface, #fff);
    display: flex;
    flex-direction: column;
    margin-bottom: -4px;
    position: sticky;
    top: 0;
    z-index: 1
}

.sticky-divider-FrrR_Y {
    align-items: center;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 4px;
    justify-content: flex-end;
    max-height: 4px;
    min-height: 4px;
    overflow: hidden;
    padding: 0 4px;
    transition: height .15s ease
}

.sticky-divider-FrrR_Y:after {
    border-top: .5px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    content: "";
    display: block;
    height: 0;
    opacity: 0;
    transition: opacity .15s ease;
    width: 100%
}

.sticky-top-xH7Ldi.scrolled-V1kU7f .sticky-divider-FrrR_Y:after {
    opacity: 1
}

.new-conversation-entry-_B5dlN {
    align-items: center;
    border-radius: 8px;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    gap: 10px;
    min-height: 36px;
    padding: 2px 12px 2px 2px;
    transition: background-color .15s ease
}

.new-conversation-entry-_B5dlN:hover {
    background: var(--bg-block-secondary-hover, rgba(0, 0, 0, .03))
}

.new-conversation-entry-_B5dlN:active {
    background: var(--bg-block-secondary-pressed, rgba(0, 0, 0, .05))
}

.new-conversation-entry-_B5dlN.active-aic4ZS {
    background: var(--bg-block-primary-default, rgba(0, 0, 0, .05))
}

.new-conversation-icon-kkgjyz {
    align-items: center;
    background: var(--bg-block-secondary-default, rgba(0, 0, 0, .08));
    border: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    border-radius: 6px;
    box-sizing: border-box;
    display: flex;
    flex-shrink: 0;
    height: 32px;
    justify-content: center;
    width: 32px
}

.new-conversation-icon-kkgjyz svg {
    color: var(--text-primary, #0f1419);
    height: 16px;
    width: 16px
}

.new-conversation-text-ltRCwk {
    color: var(--text-primary, #0f1419);
    flex: 1 1;
    font-size: 13px;
    font-weight: 400;
    line-height: 22px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
}

.section-label-N9IWUc {
    color: var(--text-placeholder, rgba(83, 100, 113, .35));
    font-size: 12px;
    font-weight: 400;
    line-height: 20px;
    padding: 12px 2px 4px 4px
}

.tooltip-trigger-shell-Lq7jCE {
    display: block;
    width: 100%
}

.conversation-item-MI_69d {
    align-items: center;
    border-radius: 8px;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    gap: 10px;
    min-height: 36px;
    padding: 2px 8px 2px 2px;
    position: relative;
    transition: background-color .15s ease
}

.conversation-item-MI_69d:hover {
    background: var(--bg-block-secondary-hover, rgba(0, 0, 0, .05))
}

.conversation-item-MI_69d:active {
    background: var(--bg-block-secondary-pressed, rgba(0, 0, 0, .07))
}

.conversation-item-MI_69d.active-aic4ZS {
    background: var(--bg-block-primary-default, rgba(0, 0, 0, .05))
}

.item-media-IKBsbV {
    flex-shrink: 0;
    height: 32px;
    width: 32px
}

.item-media-img-nt18oM {
    border-radius: 6px;
    box-sizing: border-box;
    height: 32px;
    overflow: hidden;
    position: relative;
    width: 32px
}

.item-media-img-nt18oM img {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%
}

.item-media-img-nt18oM:after {
    border: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    border-radius: 6px;
    bottom: 0;
    content: "";
    left: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0
}

.item-media-icon-Ln2eHX {
    align-items: center;
    background: var(--bg-block-secondary-default, rgba(0, 0, 0, .08));
    border: 1px solid var(--stroke-secondary, rgba(0, 0, 0, .05));
    border-radius: 6px;
    box-sizing: border-box;
    display: flex;
    height: 32px;
    justify-content: center;
    width: 32px
}

.item-media-icon-Ln2eHX .media-icon-svg-fF5VvP,
.media-icon-svg-fF5VvP {
    color: var(--text-primary, #0f1419);
    height: 16px;
    width: 16px
}

.item-text-area-GbxMR4 {
    align-items: center;
    display: flex;
    flex: 1 1;
    gap: 4px;
    min-width: 0
}

.conversation-item-MI_69d:not(.is-default-trS4Ii):not(.editing-q9fj2e):hover .item-text-area-GbxMR4 {
    margin-right: 32px
}

.item-name-k1u50X {
    color: var(--text-primary, #0f1419);
    font-size: 13px;
    font-weight: 400;
    line-height: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
}

.more-button-LARylx {
    align-items: center;
    background: transparent;
    color: var(--component-primary-text-button-default, #0f1419);
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    min-height: 24px;
    min-width: 24px;
    opacity: 0;
    padding: 0;
    pointer-events: none;
    transition: opacity .15s ease, color .15s ease
}

.more-dropdown-trigger-JKx2pQ {
    align-items: center;
    display: flex;
    height: 24px;
    justify-content: center;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    z-index: 1
}

.more-button-LARylx:hover {
    color: var(--component-primary-text-button-hover, #191e23)
}

.more-button-LARylx:active {
    color: var(--component-primary-text-button-pressed, #050a0f)
}

.conversation-item-MI_69d:hover .more-button-LARylx {
    opacity: 1;
    pointer-events: auto
}

.conversation-item-MI_69d.menu-open-lVbR4V .more-button-LARylx {
    opacity: 1;
    pointer-events: auto
}

.menu-item-IIjppP:hover {
    background: var(--bg-block-secondary-hover, rgba(255, 255, 255, .08))
}

.menu-item-IIjppP:active {
    background: var(--bg-block-secondary-pressed, rgba(255, 255, 255, .12))
}

.conversation-dropdown-panel-YLxZyR {
    background: var(--bg-dropdown-menu, #1c1e22) !important;
    border: 1px solid var(--stroke-primary, rgba(204, 221, 255, .1)) !important;
    border-radius: 12px !important;
    box-shadow: var(--shadow-dropdown-menu, 0 8px 24px rgba(0, 0, 0, .24)) !important;
    margin-top: -2px !important;
    min-width: 160px;
    padding: 0 !important;
    transform-origin: top right !important;
}

.conversation-dropdown-panel-YLxZyR .el-popper__arrow,
.conversation-dropdown-panel-YLxZyR .el-popper__arrow:before {
    display: none !important
}

.conversation-dropdown-panel-YLxZyR .el-dropdown-menu {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0
}

.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item {
    align-items: stretch;
    border-radius: 12px;
    color: var(--text-primary, #f5fbff);
    display: flex;
    min-height: 40px;
    padding: 0
}

.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:not(.is-disabled):focus {
    background: var(--bg-block-secondary-hover, rgba(255, 255, 255, .08));
    color: var(--text-primary, #f5fbff)
}

.menu-item-content-o9vlmB {
    align-items: center;
    display: flex;
    gap: 10px;
    min-height: 40px;
    padding: 0 12px;
    width: 100%
}

.menu-item-icon-K8w8qM {
    color: inherit;
    flex-shrink: 0;
    height: 16px;
    width: 16px
}

.menu-item-label-IYf2z9 {
    color: var(--text-primary, #f5fbff);
    font-size: 14px;
    font-weight: 400;
    line-height: 22px
}

.conversation-dropdown-panel-YLxZyR .danger-zMx4rT {
    color: var(--text-primary, #f5fbff)
}

.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:hover,
.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:hover .menu-item-label-IYf2z9,
.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:hover .menu-item-icon-K8w8qM,
.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:focus,
.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:focus .menu-item-label-IYf2z9,
.conversation-dropdown-panel-YLxZyR .el-dropdown-menu__item:focus .menu-item-icon-K8w8qM {
    color: var(--text-primary, #f5fbff)
}
</style>
