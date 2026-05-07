<template>
  <div class="asset-grid">
    <div class="list-wrapper">
      <div class="title-cq9JYl">最近项目</div>
      <div class="asset-row">
        <div class="asset-item-YH5WOJ" @click="$emit('create')">
          <div class="thumbnail-tyGYmG">
            <div class="create-icon-container">
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <path
                  d="M10 4.167c.46 0 .833.373.833.833v4.167H15c.46 0 .833.373.833.833s-.373.833-.833.833h-4.167V15c0 .46-.373.833-.833.833s-.833-.373-.833-.833v-4.167H5c-.46 0-.833-.373-.833-.833s.373-.833.833-.833h4.167V5c0-.46.373-.833.833-.833Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
          <div class="info-k7gOeC">
            <div class="title-h9gr0i">新建项目</div>
          </div>
        </div>

        <div
          v-for="item in projectCards"
          :key="item.id"
          class="asset-item-YH5WOJ"
          :class="{ 'menu-open-ixfKj3': openedMenuWorkflowId === item.id }"
          @click="$emit('open', item.workflow)"
        >
          <div class="hover-overlay-nFOtt0">
            <div class="cover-wrap">
              <div class="thumbnail-layout">
                <div class="thumbnail-GXvg9R">
                  <div v-if="item.images.length > 1" class="four-images">
                    <div
                      v-for="image in item.images"
                      :key="image"
                      class="image-layout"
                    >
                      <div class="container-AKt0m5">
                        <img class="image-QT6TeF" :src="image" :alt="item.title" />
                      </div>
                    </div>
                  </div>
                  <div v-else-if="item.images[0]" class="container-AKt0m5">
                    <img class="image-QT6TeF" :src="item.images[0]" :alt="item.title" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-k7gOeC">
            <div class="title-h9gr0i">{{ item.title }}</div>
            <div class="date-VzL15B">{{ item.metaText }}</div>
            <div
              class="more-button-vlEtX_"
              :class="{
                'active-Bxjkgn': openedMenuWorkflowId === item.id,
                'lv-dropdown-popup-visible': openedMenuWorkflowId === item.id,
                'lv-dropdown-open': openedMenuWorkflowId === item.id,
              }"
              role="button"
              tabindex="0"
              aria-label="更多操作"
              @click.stop="toggleMenu(item.id)"
              @keydown.enter.stop.prevent="toggleMenu(item.id)"
              @keydown.space.stop.prevent="toggleMenu(item.id)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                preserveAspectRatio="xMidYMid meet"
                fill="none"
                role="presentation"
                aria-hidden="true"
              >
                <path
                  d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div
              v-if="openedMenuWorkflowId === item.id"
              class="lv-dropdown-menu lv-dropdown-menu-light lv-dropdown-menu-vertical lv-dropdown-menu-collapse lv-dropdown-menu-pop dropdown-menu-XkzXxP"
              role="menu"
              @click.stop
            >
              <div class="lv-dropdown-menu-inner">
                <div
                  class="lv-dropdown-menu-item lv-dropdown-menu-item-size-default dropdown-menu-item-x6PnQ_"
                  tabindex="0"
                  role="menuitem"
                  @click.stop="handleRename(item)"
                  @keydown.enter.stop.prevent="handleRename(item)"
                  @keydown.space.stop.prevent="handleRename(item)"
                >
                  <svg viewBox="0 0 24 24" class="icon-CzcmWk" aria-hidden="true">
                    <path
                      d="M9.024 20.055a1 1 0 0 0 .465-.263L19.906 9.375a3.735 3.735 0 1 0-5.282-5.281L4.207 14.51a1 1 0 0 0-.263.464l-1.289 5.157a1 1 0 0 0 1.213 1.212l5.156-1.289Zm7.014-14.547L5.818 15.73 5 19l3.27-.818 10.222-10.22a1.733 1.733 0 0 0-.563-2.83 1.735 1.735 0 0 0-1.89.376Zm3.878 15.242a1.083 1.083 0 0 0 0-2.167h-5.342a.17.17 0 0 0-.124.055l-1.623 1.758a.211.211 0 0 0 .155.354h6.934Z"
                      fill="currentColor"
                    />
                  </svg>
                  <div>重命名</div>
                </div>
                <div
                  class="lv-dropdown-menu-item lv-dropdown-menu-item-size-default dropdown-menu-item-x6PnQ_"
                  tabindex="0"
                  role="menuitem"
                  @click.stop="handleDelete(item)"
                  @keydown.enter.stop.prevent="handleDelete(item)"
                  @keydown.space.stop.prevent="handleDelete(item)"
                >
                  <svg viewBox="0 0 24 24" class="icon-CzcmWk" aria-hidden="true">
                    <path
                      d="M10.5 2.277a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM3.572 5.27a1 1 0 1 0 0 2H4.86v10a4 4 0 0 0 4 4h6.336a4 4 0 0 0 4-4v-10h1.231a1 1 0 1 0 0-2H3.571Zm3.289 12v-10h10.336v10a2 2 0 0 1-2 2H8.86a2 2 0 0 1-2-2Z"
                      fill="currentColor"
                    />
                  </svg>
                  <div>删除</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WorkflowDefinitionSummary, WorkflowDefinitionVersionDetail } from '@/views/workflow/api/definitions'
import type { WorkflowCanvasNode } from '@/views/workflow/composables/useWorkflowCanvas'

const emit = defineEmits<{
  create: []
  open: [workflow: WorkflowDefinitionSummary]
  rename: [workflow: WorkflowDefinitionSummary]
  delete: [workflow: WorkflowDefinitionSummary]
}>()

interface ProjectCardItem {
  id: string
  title: string
  metaText: string
  images: string[]
  workflow: WorkflowDefinitionSummary
}

const props = defineProps<{
  workflows: WorkflowDefinitionSummary[]
}>()

const openedMenuWorkflowId = ref('')

const formatWorkflowDate = (value?: string | null) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) {
    return '最近'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

const readWorkflowPreviewVersion = (workflow: WorkflowDefinitionSummary) => {
  return workflow.currentVersion || workflow.latestVersion || null
}

// 只复用现有卡片结构，所以这里只保留已有预览图的工作流数据。
const extractPreviewImages = (version: WorkflowDefinitionVersionDetail | null) => {
  if (!version || !Array.isArray(version.nodesJson)) {
    return []
  }

  const nodes = version.nodesJson as WorkflowCanvasNode[]
  const urls = nodes
    .map((node) => {
      if (node?.type === 'image' || node?.type === 'video') {
        return String((node.data as { url?: string })?.url || '').trim()
      }
      return ''
    })
    .filter(Boolean)

  return Array.from(new Set(urls)).slice(0, 4)
}

const buildMetaText = (workflow: WorkflowDefinitionSummary) => {
  const dateText = formatWorkflowDate(workflow.updatedAt || workflow.createdAt)
  return `${dateText}修改`
}

const projectCards = computed<ProjectCardItem[]>(() => {
  return props.workflows
    .map((workflow) => {
      const version = readWorkflowPreviewVersion(workflow)
      const images = extractPreviewImages(version)

      return {
        id: workflow.id,
        title: workflow.name || '未命名项目',
        metaText: buildMetaText(workflow),
        images,
        workflow,
      }
    })
})

const closeMenu = () => {
  openedMenuWorkflowId.value = ''
}

const toggleMenu = (workflowId: string) => {
  openedMenuWorkflowId.value = openedMenuWorkflowId.value === workflowId ? '' : workflowId
}

const handleRename = (item: ProjectCardItem) => {
  closeMenu()
  emit('rename', item.workflow)
}

const handleDelete = (item: ProjectCardItem) => {
  closeMenu()
  emit('delete', item.workflow)
}

const handleDocumentMouseDown = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (!target.closest('.asset-item-YH5WOJ')) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})
</script>
