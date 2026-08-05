<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Header from '@components/canana/Header.vue'
import LeftToolbar from '@components/canana/LeftToolbar.vue'
import InfiniteCanvas from '@components/canana/InfiniteCanvas.vue'
import BottomToolbar from '@components/canana/BottomToolbar.vue'
import ContentGenerator from '@/components/generate/ContentGenerator.vue'
import RightPanel from '@components/canana/RightPanel.vue'
import CanvasEmptyState from '@components/canana/CanvasEmptyState.vue'
import { uploadAssetItem } from '@/api/asset-items'
import { useInfiniteCanvasProject } from '@/composables/useInfiniteCanvasProject'

const route = useRoute()
const router = useRouter()

const {
  currentProjectId,
  projects,
  saving,
  loading,
  listProjects,
  loadProject,
  autosaveProject,
  renameProject,
  removeProject,
  resetProject,
} = useInfiniteCanvasProject()

const zoom = ref(10)
const projectTitle = ref('生成二次元手办多风格图片')
const rightPanelOpen = ref(false)
const selectedImage = ref(null)
const canvasRef = ref(null)
const canvasCreated = ref(false)
const fileInputRef = ref(null)
const projectDialogOpen = ref(false)
const projectKeyword = ref('')
const latestSnapshot = ref(null)
const saveState = ref('idle')
const saveError = ref('')
const backLoading = ref(false)
let saveTimer = null
let saveInFlight = null

const saveStatusText = computed(() => {
  if (saving.value || saveState.value === 'saving') return '保存中…'
  if (saveState.value === 'error') return saveError.value || '保存失败'
  if (saveState.value === 'saved') return '已保存'
  return currentProjectId.value ? '自动保存已开启' : ''
})

const handleZoomChange = (newZoom) => {
  zoom.value = Math.max(1, Math.min(200, newZoom))
}

const toggleRightPanel = () => {
  rightPanelOpen.value = !rightPanelOpen.value
}

const handleSelectionChange = (image) => {
  selectedImage.value = image
}

const handleUpload = () => {
  fileInputRef.value?.click()
}

const handleSelectAsset = () => {
  // 资产选择器自身负责拉取数据，这里只保留父级事件入口。
}

// 处理资产选择完成 - 渲染到画布
const handleAssetSelected = (assets) => {
  if (!assets || assets.length === 0) return

  if (!canvasCreated.value) {
    canvasCreated.value = true
    nextTick(() => {
      canvasRef.value?.addImages(assets)
    })
  } else {
    canvasRef.value?.addImages(assets)
  }
}

const readImageDimensions = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve({ width: image.naturalWidth, height: image.naturalHeight })
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    resolve({})
  }
  image.src = url
})

const handleFilesSelected = async (event) => {
  const input = event.target
  const files = Array.from(input.files || []).filter(file => file.type.startsWith('image/'))
  if (!files.length) return

  try {
    const uploadedAssets = []
    for (const file of files) {
      const dimensions = await readImageDimensions(file)
      const asset = await uploadAssetItem(file, 'image', {
        ...dimensions,
        title: file.name,
      })
      uploadedAssets.push({
        id: asset.id,
        url: asset.fileUrl,
        width: asset.width,
        height: asset.height,
        name: asset.title || file.name,
        source: 'upload',
      })
    }
    handleAssetSelected(uploadedAssets)
  } catch (error) {
    ElMessage.error(error?.message || '图片上传失败')
  } finally {
    input.value = ''
  }
}

// 处理中间底部发送的消息
const pendingMessage = ref('')
const handlePromptSend = (message, type) => {
  pendingMessage.value = message
  rightPanelOpen.value = true
}

const syncProjectRoute = async (projectId) => {
  const nextQuery = { ...route.query }
  if (projectId) nextQuery.projectId = projectId
  else delete nextQuery.projectId
  await router.replace({ path: route.path, query: nextQuery })
}

const flushAutosave = async () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (saveInFlight) {
    const saved = await saveInFlight
    if (saved && saveState.value === 'idle') return flushAutosave()
    return saved
  }
  if (!latestSnapshot.value || saveState.value === 'saved') return true

  const snapshotToSave = latestSnapshot.value
  saveState.value = 'saving'
  saveError.value = ''
  saveInFlight = (async () => {
    try {
      const detail = await autosaveProject({
        title: projectTitle.value || '未命名创作项目',
        snapshot: snapshotToSave,
      })
      saveState.value = latestSnapshot.value === snapshotToSave ? 'saved' : 'idle'
      await syncProjectRoute(detail.definition.id)
      return true
    } catch (error) {
      saveState.value = 'error'
      saveError.value = error?.message || '自动保存失败'
      return false
    }
  })()

  const saved = await saveInFlight
  saveInFlight = null
  if (saved && saveState.value === 'idle') return flushAutosave()
  return saved
}

const handleBack = async () => {
  if (backLoading.value) return
  backLoading.value = true
  try {
    const saved = await flushAutosave()
    if (!saved) {
      ElMessage.error(saveError.value || '画布保存失败，已留在当前页面')
      return
    }
    const hasPreviousRoute = Boolean(window.history.state?.back)
    if (hasPreviousRoute) {
      router.back()
    } else {
      await router.push({ name: 'Home' })
    }
  } catch (error) {
    ElMessage.error(error?.message || '返回失败，请稍后重试')
  } finally {
    backLoading.value = false
  }
}

const handleSnapshotChange = (snapshot) => {
  latestSnapshot.value = snapshot
  saveState.value = 'idle'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void flushAutosave() }, 1200)
}

const handleTitleUpdate = async (title) => {
  projectTitle.value = title
  if (!currentProjectId.value) return
  try {
    await renameProject(title)
    saveState.value = 'saved'
  } catch (error) {
    saveState.value = 'error'
    saveError.value = error?.message || '重命名失败'
  }
}

const createNewProject = async () => {
  await flushAutosave()
  resetProject()
  latestSnapshot.value = null
  canvasCreated.value = false
  projectTitle.value = '未命名创作项目'
  selectedImage.value = null
  saveState.value = 'idle'
  await syncProjectRoute('')
}

const openProjectLibrary = async () => {
  projectDialogOpen.value = true
  try {
    await listProjects(projectKeyword.value)
  } catch (error) {
    ElMessage.error(error?.message || '加载项目列表失败')
  }
}

const openProject = async (project) => {
  await flushAutosave()
  try {
    const result = await loadProject(project.id)
    canvasCreated.value = true
    projectTitle.value = result.detail.definition.name
    await nextTick()
    canvasRef.value?.applySnapshot(result.snapshot)
    latestSnapshot.value = result.snapshot
    zoom.value = Math.round(result.snapshot.viewport.scale * 100)
    saveState.value = 'saved'
    projectDialogOpen.value = false
    await syncProjectRoute(project.id)
  } catch (error) {
    ElMessage.error(error?.message || '打开项目失败')
  }
}

const deleteProject = async (project) => {
  try {
    await ElMessageBox.confirm(`确认删除项目“${project.name}”？`, '删除项目', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const deletingCurrent = currentProjectId.value === project.id
    if (deletingCurrent) latestSnapshot.value = null
    await removeProject(project.id)
    if (deletingCurrent) await createNewProject()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '删除项目失败')
    }
  }
}

const handleHeaderMenuAction = (action) => {
  if (action === 'new') void createNewProject()
  if (action === 'open') void openProjectLibrary()
}

const handleGeneratedImage = (asset) => {
  if (!asset?.url) return
  handleAssetSelected([{ url: asset.url, source: 'generated', name: 'AI 生成结果' }])
}

onMounted(async () => {
  const projectId = String(route.query.projectId || '').trim()
  if (!projectId) return
  await openProject({ id: projectId })
})

// 覆盖浏览器后退、侧边导航等所有路由离开方式，避免只有头部返回按钮会等待保存。
onBeforeRouteLeave(async () => {
  const saved = await flushAutosave()
  if (!saved) {
    ElMessage.error(saveError.value || '画布保存失败，已取消离开当前页面')
    return false
  }
  return true
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div class="image-editor-container">
    <div class="workbench" :class="{ 'right-panel-open': rightPanelOpen }" :style="{ '--right-panel-width': '440px' }">
      <div class="workbench-main-content">
        <div class="workbench-content">
          <!-- 顶部栏 -->
          <Header
              :title="projectTitle"
              :save-status="saveStatusText"
              :back-loading="backLoading"
              @update:title="handleTitleUpdate"
              @back="handleBack"
              @toggle-panel="toggleRightPanel"
              @menu-action="handleHeaderMenuAction"
          />

          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="handleFilesSelected"
          >

          <!-- 主内容区 -->
          <main class="main-content-G8f_tC">
            <!-- 顶部工具栏 - 选中图片时显示 -->
            <div class="toolbar-zDoGgL top-toolbar" :class="{ visible: selectedImage }">
              <div class="top-toolbar-content" v-if="selectedImage">
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 15v-4H7l5-7v4h4l-5 7Z" fill="currentColor"/></svg>
                  <span>局部重绘</span>
                </button>
                <button class="top-tool-btn has-dropdown">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V5h14v14Zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4v4Z" fill="currentColor"/></svg>
                  <span>超清</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" class="dropdown-icon"><path d="M7 10l5 5 5-5H7Z" fill="currentColor"/></svg>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" fill="currentColor"/></svg>
                  <span>抠图</span>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 3H9v2h6V3Zm-4 13h2V8h-2v8Zm8.03-6.61 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 5a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9c0-2.12-.74-4.07-1.97-5.61ZM12 21c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7Z" fill="currentColor"/></svg>
                  <span>扩图</span>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 4v1h-2V4c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H6V4c0-.55-.45-1-1-1s-1 .45-1 1v16c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1V4c0-.55-.45-1-1-1s-1 .45-1 1ZM8 17H6v-2h2v2Zm0-4H6v-2h2v2Zm0-4H6V7h2v2Zm10 8h-2v-2h2v2Zm0-4h-2v-2h2v2Zm0-4h-2V7h2v2Z" fill="currentColor"/></svg>
                  <span>生成视频</span>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58ZM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6Z" fill="currentColor"/></svg>
                  <span>消除笔</span>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 17v2h6v-2H3ZM3 5v2h10V5H3Zm10 16v-2h8v-2h-8v-2h-2v6h2ZM7 9v2H3v2h4v2h2V9H7Zm14 4v-2H11v2h10Zm-6-4h2V7h4V5h-4V3h-2v6Z" fill="currentColor"/></svg>
                  <span>画面微调</span>
                </button>
                <button class="top-tool-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2.5 4v3h5v12h3V7h5V4h-13Zm19 5h-9v3h3v7h3v-7h3V9Z" fill="currentColor"/></svg>
                  <span>文字重绘</span>
                </button>
              </div>
            </div>

            <!-- 画布容器 -->
            <div class="canvas-container-ciI9cJ">
              <!-- 空状态 - 使用可复用组件 -->
              <CanvasEmptyState
                v-if="!canvasCreated"
                @upload="handleUpload"
                @select-asset="handleSelectAsset"
                @asset-selected="handleAssetSelected"
              />
              <!-- 画布 -->
              <InfiniteCanvas
                v-else
                ref="canvasRef"
                :zoom="zoom"
                @zoom-change="handleZoomChange"
                @selection-change="handleSelectionChange"
                @snapshot-change="handleSnapshotChange"
              />
            </div>

            <div class="toolbar-zDoGgL bottom-toolbar-PE8gbm"></div>
          </main>
        </div>

        <!-- 左侧工具栏 -->
        <nav class="toolbar-zDoGgL left-toolbar-R3x3z9">
          <LeftToolbar />
        </nav>

        <!-- 底部左侧控件 -->
        <div class="bottom-left-widget-jcEzp3">
          <BottomToolbar
              :zoom="zoom"
              @zoom-change="handleZoomChange"
          />
        </div>

        <!-- 内容生成器 - 右侧面板关闭时显示 -->
        <ContentGenerator
          v-show="!rightPanelOpen"
          class="canvas-content-generator"
          :collapsible="true"
          :default-expanded="false"
          popup-placement="top"
          @send="handlePromptSend"
        />
      </div>

      <!-- 调整大小手柄 - 仅在右侧面板打开时可见 -->
      <div v-show="rightPanelOpen" class="resize-handle"></div>

      <!-- 右侧面板 -->
      <aside class="right-panel-gZhdnT">
        <RightPanel
            :title="projectTitle"
            :visible="rightPanelOpen"
            :initial-message="pendingMessage"
            @close="rightPanelOpen = false"
            @message-received="pendingMessage = ''"
            @add-image-to-canvas="handleGeneratedImage"
        />
      </aside>
    </div>

    <el-dialog v-model="projectDialogOpen" title="打开创作项目" width="640px">
      <div class="canvas-project-toolbar">
        <input v-model="projectKeyword" placeholder="搜索项目名称" @keyup.enter="openProjectLibrary">
        <button type="button" @click="openProjectLibrary">搜索</button>
      </div>
      <div v-if="loading" class="canvas-project-empty">正在加载…</div>
      <div v-else-if="!projects.length" class="canvas-project-empty">还没有保存过的创作项目</div>
      <div v-else class="canvas-project-list">
        <div v-for="project in projects" :key="project.id" class="canvas-project-item">
          <button class="canvas-project-open" type="button" @click="openProject(project)">
            <strong>{{ project.name }}</strong>
            <span>V{{ project.latestVersionNo }} · {{ new Date(project.updatedAt).toLocaleString('zh-CN') }}</span>
          </button>
          <button class="canvas-project-delete" type="button" @click="deleteProject(project)">删除</button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style>
/* 导入全局画布样式（非 scoped，以便正确应用到所有元素） */
@import './styles/index.css';
@import './styles/empty-state.css';
@import './styles/canvas.css';
@import './styles/sidebar-empty-state.css';

.canvas-project-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.canvas-project-toolbar input { flex: 1; border: 1px solid var(--stroke-secondary); border-radius: 8px; padding: 9px 12px; background: var(--bg-primary); color: var(--text-primary); }
.canvas-project-toolbar button, .canvas-project-delete { border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; }
.canvas-project-list { display: flex; flex-direction: column; gap: 8px; max-height: 440px; overflow: auto; }
.canvas-project-item { display: flex; align-items: center; gap: 8px; border: 1px solid var(--stroke-secondary); border-radius: 10px; padding: 8px; }
.canvas-project-open { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
.canvas-project-open span, .canvas-project-empty { color: var(--text-tertiary); font-size: 12px; }
.canvas-project-delete { color: #ef4444; background: transparent; }
</style>
