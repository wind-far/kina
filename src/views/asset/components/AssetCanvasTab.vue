<template>
  <div class="content-1rx" :class="{ 'hidden-w3p': !active }">
    <div class="tab-entry-mxq">
      <div class="canvasEntryContainer-dp8">
        <div class="header-2ov">
          <div class="container-c5d">
            <div class="header-2wr">
              <div class="filter-wxj">
                <button
                  v-for="option in canvasFilterOptions"
                  :key="option.value"
                  type="button"
                  class="filter-qxo"
                  :class="{ [option.activeClass]: canvasFilter === option.value }"
                  @click="emit('set-canvas-filter', option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
              <div class="select-ald">
                <form class="operateArea-aqq" @submit.prevent="submitSearch">
                  <label class="canvas-project-search" aria-label="搜索项目">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4.563 10.75a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm6.5-8.5a8.5 8.5 0 1 0 5.261 15.176l3.406 3.406a1 1 0 0 0 1.415-1.414l-3.407-3.406A8.5 8.5 0 0 0 11.062 2.25Z" fill="currentColor" />
                    </svg>
                    <input v-model="keyword" type="search" placeholder="搜索项目" @search="submitSearch" />
                  </label>
                  <button type="submit" class="canvas-project-search__submit">搜索</button>
                  <span class="divider-hb7" aria-hidden="true"></span>
                  <button type="button" class="btn-g4h canvas-project-batch" @click="emit('enter-batch-mode')">批量操作</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div class="canvasWrapper-ysg" @scroll="handleScroll">
          <div class="container-c5d">
            <div class="canvasList-oos">
              <button type="button" class="canvasCard-yoo canvasCard-yoo--create" @click="emit('create-project')">
                <span class="emptyItem-jk6">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.8 20a1.2 1.2 0 0 0 2.4 0v-6.8H20a1.2 1.2 0 1 0 0-2.4h-6.8V4a1.2 1.2 0 0 0-2.4 0v6.8H4a1.2 1.2 0 0 0 0 2.4h6.8V20Z" fill="currentColor" />
                  </svg>
                </span>
                <span class="canvasTitle-j2c">新建项目</span>
              </button>

              <article
                v-for="project in projectCards"
                :key="project.id"
                class="canvasCard-yoo cavasNewCard-xsi"
                role="button"
                tabindex="0"
                @click="emit('open-project', project.project)"
                @keydown.enter.prevent="emit('open-project', project.project)"
              >
                <div class="image-d9m">
                  <div v-if="project.image" class="image-grw">
                    <img :src="project.image" :alt="project.title" />
                  </div>
                  <div v-else class="canvas-project-preview-empty" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v12.5A1.75 1.75 0 0 1 18.25 20H5.75A1.75 1.75 0 0 1 4 18.25V5.75Zm2.4 11.85h11.2l-3.18-3.18a1 1 0 0 0-1.42 0l-1.76 1.76-1.09-1.08a1 1 0 0 0-1.41 0L6.4 17.6ZM8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
                <span class="canvasTitle-j2c">{{ project.title }}</span>
                <span class="updateTime-dyo">{{ project.updatedText }}</span>

                <button
                  type="button"
                  class="canvasControls-rkg"
                  aria-label="项目更多操作"
                  @click.stop="toggleMenu(project.id)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
                  </svg>
                </button>
                <div v-if="openedProjectId === project.id" class="canvas-project-menu" role="menu" @click.stop>
                  <button type="button" role="menuitem" @click="emitProjectAction('rename-project', project.project)">重命名</button>
                  <button type="button" role="menuitem" class="canvas-project-menu__danger" @click="emitProjectAction('delete-project', project.project)">删除</button>
                </div>
              </article>
            </div>

            <div v-if="loading" class="canvas-project-status">正在加载项目…</div>
            <div v-else-if="!projectCards.length" class="canvas-project-status">暂无项目，创建一个开始吧</div>
            <button v-else-if="hasMore" type="button" class="canvas-project-load-more" :disabled="loadingMore" @click="emit('load-more')">
              {{ loadingMore ? '正在加载…' : '加载更多' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { buildAssetUrl } from '@/api/http'
import { extractWorkflowPreviewImages } from '@/views/agentic-assets-canvas/workflow-preview'
import type { WorkflowDefinitionSummary } from '@/views/workflow/api/definitions'
import type { CanvasFilterType, FilterOption } from '@/views/asset/types'

const props = defineProps<{
  active: boolean
  canvasFilterOptions: FilterOption<CanvasFilterType>[]
  canvasFilter: CanvasFilterType
  projects: WorkflowDefinitionSummary[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  'set-canvas-filter': [filter: CanvasFilterType]
  'enter-batch-mode': []
  'create-project': []
  'open-project': [project: WorkflowDefinitionSummary]
  'rename-project': [project: WorkflowDefinitionSummary]
  'delete-project': [project: WorkflowDefinitionSummary]
  search: [keyword: string]
  'load-more': []
}>()

const keyword = ref('')
const openedProjectId = ref('')

const projectCards = computed(() => props.projects.map((project) => ({
  id: project.id,
  title: project.name || '未命名项目',
  image: extractWorkflowPreviewImages(project)[0] ? buildAssetUrl(extractWorkflowPreviewImages(project)[0]) : '',
  updatedText: formatUpdatedAt(project.updatedAt || project.createdAt),
  project,
})))

const formatUpdatedAt = (value?: string | null) => {
  const timestamp = value ? new Date(value).getTime() : 0
  if (!timestamp || Number.isNaN(timestamp)) return '最近修改'
  const delta = Math.max(0, Date.now() - timestamp)
  const hours = Math.floor(delta / 3_600_000)
  if (hours < 1) return '刚刚修改'
  if (hours < 24) return `${hours}小时前修改`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前修改`
  return `${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(timestamp))}修改`
}

const submitSearch = () => {
  openedProjectId.value = ''
  emit('search', keyword.value)
}

const toggleMenu = (projectId: string) => {
  openedProjectId.value = openedProjectId.value === projectId ? '' : projectId
}

const emitProjectAction = (event: 'rename-project' | 'delete-project', project: WorkflowDefinitionSummary) => {
  openedProjectId.value = ''
  if (event === 'rename-project') {
    emit('rename-project', project)
    return
  }
  emit('delete-project', project)
}

const handleScroll = (event: Event) => {
  const target = event.currentTarget as HTMLElement
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) {
    emit('load-more')
  }
}

const closeMenuOnOutsidePointer = (event: PointerEvent) => {
  const target = event.target
  if (target instanceof Element && !target.closest('.cavasNewCard-xsi')) {
    openedProjectId.value = ''
  }
}

onMounted(() => document.addEventListener('pointerdown', closeMenuOnOutsidePointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeMenuOnOutsidePointer))
</script>
