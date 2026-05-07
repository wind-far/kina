<template>
  <div class="jimeng-home-container">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer">
            <div class="container-moSF_y" :style="sideMenuStyleVars">
              <SideMenu />
              <div class="agentic-assets-canvas-shell" :style="sideMenuStyleVars">
                <div class="agentic-assets-canvas-page">
                  <div
                    ref="scrollContainerRef"
                    class="agentic-assets-canvas-scroll"
                    @scroll="handleScroll"
                  >
                    <div class="agentic-assets-canvas-inner">
                      <h1 class="title-n0ETJC">灵感不设限，创作无边界</h1>

                      <div class="content-generator-wrapper">
                        <ContentGenerator
                          :default-expanded="true"
                          @send="handleSend"
                        />
                      </div>

                      <AssetsGridSection
                        :workflows="workflowList"
                        @create="handleCreateWorkflow"
                        @delete="handleDeleteWorkflow"
                        @open="handleOpenWorkflow"
                        @rename="handleRenameWorkflow"
                      />
                    </div>
                  </div>
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
import { ElMessageBox } from 'element-plus'
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SideMenu from '@/components/home/components/SideMenu.vue'
import ContentGenerator from '@/components/generate/ContentGenerator.vue'
import AssetsGridSection from '@/views/agentic-assets-canvas/components/AssetsGridSection.vue'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'
import type { CreationType } from '@/components/generate/selectors'
import {
  deleteWorkflowDefinition,
  listWorkflowDefinitions,
  type WorkflowDefinitionSummary,
  updateWorkflowDefinition,
} from '@/views/workflow/api/definitions'
import './agentic-assets-canvas.css'

interface GeneratorSendOptions {
  model?: string
  modelKey?: string
  ratio?: string
  resolution?: string
  duration?: string
  feature?: string
  skill?: string
  referenceImages?: string[]
}

const router = useRouter()
const route = useRoute()
const { sideMenuStyleVars } = useHomeSideMenuConfig()
const scrollContainerRef = ref<HTMLElement | null>(null)
const workflowList = ref<WorkflowDefinitionSummary[]>([])
const workflowListLoading = ref(false)
const workflowListLoadingMore = ref(false)
const workflowListPage = ref(1)
const workflowListPageSize = 12
const workflowListHasMore = ref(true)
const workflowListTotal = ref(0)

const fetchWorkflowPage = async (page: number) => {
  return await listWorkflowDefinitions({
    scene: 'WORKFLOW_CANVAS',
    page,
    pageSize: workflowListPageSize,
  })
}

// 智能画布页直接使用工作流定义列表，承接最近项目展示。
const loadWorkflowList = async () => {
  workflowListLoading.value = true
  try {
    const response = await fetchWorkflowPage(1)
    workflowList.value = response.items
    workflowListPage.value = response.page
    workflowListTotal.value = response.total
    workflowListHasMore.value = response.hasMore
  } finally {
    workflowListLoading.value = false
  }
}

// 向下滚动时按页续拉工作流，避免一次性加载全部项目。
const loadMoreWorkflowList = async () => {
  if (workflowListLoading.value || workflowListLoadingMore.value || !workflowListHasMore.value) {
    return
  }

  workflowListLoadingMore.value = true
  try {
    const nextPage = workflowListPage.value + 1
    const response = await fetchWorkflowPage(nextPage)
    workflowList.value = workflowList.value.concat(response.items)
    workflowListPage.value = response.page
    workflowListTotal.value = response.total
    workflowListHasMore.value = response.hasMore
  } finally {
    workflowListLoadingMore.value = false
  }
}

const refillWorkflowListAfterMutation = async (expectedCount: number) => {
  workflowList.value = []
  workflowListPage.value = 0
  workflowListTotal.value = 0
  workflowListHasMore.value = true

  while (workflowList.value.length < expectedCount && workflowListHasMore.value) {
    const nextPage = workflowListPage.value + 1
    const response = await fetchWorkflowPage(nextPage)
    workflowList.value = workflowList.value.concat(response.items)
    workflowListPage.value = response.page
    workflowListTotal.value = response.total
    workflowListHasMore.value = response.hasMore
  }
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  const nearBottomThreshold = 160
  const remainingDistance = target.scrollHeight - target.scrollTop - target.clientHeight
  if (remainingDistance <= nearBottomThreshold) {
    void loadMoreWorkflowList()
  }
}

const ensureScrollableWorkflowList = async () => {
  await nextTick()

  const scrollContainer = scrollContainerRef.value
  if (!scrollContainer || workflowListLoading.value || workflowListLoadingMore.value || !workflowListHasMore.value) {
    return
  }

  if (scrollContainer.scrollHeight <= scrollContainer.clientHeight + 40) {
    await loadMoreWorkflowList()
    await ensureScrollableWorkflowList()
  }
}

const handleCreateWorkflow = () => {
  void router.push({
    path: '/workflow',
    query: {
      returnTo: route.fullPath,
    },
  })
}

const handleOpenWorkflow = (workflow: WorkflowDefinitionSummary) => {
  const targetVersionId = workflow.currentVersionId || workflow.latestVersion?.id || ''

  void router.push({
    path: '/workflow',
    query: {
      returnTo: route.fullPath,
      workflowId: workflow.id,
      ...(targetVersionId ? { versionId: targetVersionId } : {}),
    },
  })
}

const handleRenameWorkflow = async (workflow: WorkflowDefinitionSummary) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的项目名称', '重命名项目', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: workflow.name || '',
      inputPlaceholder: '请输入项目名称',
      inputValidator: (inputValue) => {
        return String(inputValue || '').trim() ? true : '项目名称不能为空'
      },
    })

    const nextName = String(value || '').trim()
    if (!nextName || nextName === workflow.name) {
      return
    }

    await updateWorkflowDefinition(workflow.id, {
      name: nextName,
    })

    const loadedItemCount = workflowList.value.length
    await refillWorkflowListAfterMutation(loadedItemCount)
  } catch {
    // 用户取消时不提示错误。
  }
}

const handleDeleteWorkflow = async (workflow: WorkflowDefinitionSummary) => {
  try {
    await ElMessageBox.confirm(
      `确定删除项目“${workflow.name || '未命名项目'}”吗？该操作不可恢复。`,
      '删除项目',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  const nextExpectedCount = Math.max(workflowList.value.length - 1, workflowListPageSize)
  await deleteWorkflowDefinition(workflow.id)
  await refillWorkflowListAfterMutation(nextExpectedCount)
}

const handleSend = (message: string, type: CreationType, options?: GeneratorSendOptions) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('canana:home-header:pending-send', JSON.stringify({
      modelKey: options?.modelKey || '',
      duration: options?.duration || '',
      feature: options?.feature || '',
      referenceImages: Array.isArray(options?.referenceImages) ? options.referenceImages : [],
    }))
  }

  void router.push({
    path: '/generate',
    query: {
      message,
      type,
      ...(options?.model && { model: options.model }),
      ...(options?.skill && { skill: options.skill }),
      ...(options?.ratio && { ratio: options.ratio }),
      ...(options?.resolution && { resolution: options.resolution }),
    },
  })
}

onMounted(() => {
  void (async () => {
    await loadWorkflowList()
    await ensureScrollableWorkflowList()
  })()
})
</script>
