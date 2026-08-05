<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  useViewport,
  useCanvasState,
  useImageResize,
  useHistory,
  usePointerEvents,
  useShortcut
} from '@/composables'
import { useFreeCanvasDrag } from '@/composables/useFreeCanvasDrag'
import {
  getInfiniteCanvasBounds,
  getLegacyCanvasPosition,
  normalizeInfiniteCanvasImages,
} from '@/shared/infinite-canvas-layout'

const props = defineProps({
  zoom: { type: Number, default: 100 },
  // 新图片的默认尺寸与旧版网格迁移参数
  gridCols: { type: Number, default: 4 },
  cellWidth: { type: Number, default: 1728 },
  cellHeight: { type: Number, default: 2304 },
  gap: { type: Number, default: 96 },
  padding: { type: Number, default: 192 },
  // 缩放限制
  minZoom: { type: Number, default: 1 },
  maxZoom: { type: Number, default: 200 }
})

const emit = defineEmits(['zoom-change', 'selection-change', 'snapshot-change'])

// ============ 数据 ============
const containerRef = ref(null)

const images = ref([])
let suppressSnapshotEmit = false
let hasRestoredSnapshot = false
let snapshotEmitTimer = null

// 添加外部图片（从资产选择器选择的图片）
async function addImages(assetItems) {
  if (!assetItems || assetItems.length === 0) return

  for (let i = 0; i < assetItems.length; i++) {
    const asset = assetItems[i]
    // 加载图片获取实际尺寸
    const url = String(asset.url || asset.fileUrl || asset.previewUrl || '').trim()
    if (!url) continue
    const imgSize = asset.width && asset.height
      ? { width: Number(asset.width), height: Number(asset.height) }
      : await getImageSize(url)

    const index = images.value.length
    const position = getLegacyCanvasPosition(index)
    images.value.push({
      id: `asset-${asset.id || Date.now()}-${i}`,
      src: url,
      w: imgSize.width || props.cellWidth,
      h: imgSize.height || props.cellHeight,
      x: position.x,
      y: position.y,
      zIndex: index,
      rotation: 0,
      index,
      assetId: asset.id ? String(asset.id) : undefined,
      name: String(asset.name || asset.title || ''),
      source: asset.source === 'generated' || asset.source === 'upload' ? asset.source : 'asset',
    })
  }

  // 添加后居中显示全部内容
  setTimeout(() => {
    centerCanvasContent()
  }, 100)
}

// 获取图片尺寸
function getImageSize(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // 按比例缩放到网格尺寸
      const aspectRatio = img.width / img.height
      let width, height

      if (aspectRatio > props.cellWidth / props.cellHeight) {
        // 图片更宽，以宽度为准
        width = props.cellWidth
        height = Math.round(props.cellWidth / aspectRatio)
      } else {
        // 图片更高，以高度为准
        height = props.cellHeight
        width = Math.round(props.cellHeight * aspectRatio)
      }

      resolve({ width, height })
    }
    img.onerror = () => {
      // 加载失败使用默认尺寸
      resolve({ width: props.cellWidth, height: props.cellHeight })
    }
    img.src = url
  })
}

// ============ Composables ============
const viewport = useViewport({
  minScale: props.minZoom / 100,
  maxScale: props.maxZoom / 100
})
const canvasState = useCanvasState()
const freeCanvasDrag = useFreeCanvasDrag(images)
const imageResize = useImageResize(images)
const history = useHistory()
const pointer = usePointerEvents()

const getSnapshot = () => ({
  schemaVersion: 2,
  images: JSON.parse(JSON.stringify(images.value)),
  viewport: {
    x: viewport.viewport.x,
    y: viewport.viewport.y,
    scale: viewport.viewport.scale,
  },
})

const applySnapshot = (snapshot) => {
  suppressSnapshotEmit = true
  hasRestoredSnapshot = true
  images.value = normalizeInfiniteCanvasImages(snapshot?.images)
  viewport.viewport.x = Number(snapshot?.viewport?.x || 0)
  viewport.viewport.y = Number(snapshot?.viewport?.y || 0)
  viewport.viewport.scale = Math.max(0.01, Number(snapshot?.viewport?.scale || 1) || 1)
  history.clear()
  canvasState.deselect()
  emit('zoom-change', Math.round(viewport.viewport.scale * 100))
  setTimeout(() => { suppressSnapshotEmit = false }, 0)
}

const clearCanvas = () => {
  images.value = []
  history.clear()
  canvasState.deselect()
}

// 暴露项目持久化所需的最小快照 API。
defineExpose({ addImages, getSnapshot, applySnapshot, clearCanvas })

// ============ 计算属性 ============
const selectedImage = computed(() => {
  if (!canvasState.selectedId.value) return null
  return images.value.find(img => img.id === canvasState.selectedId.value)
})

const draggingImage = computed(() => {
  if (!canvasState.draggedId.value) return null
  return images.value.find(img => img.id === canvasState.draggedId.value)
})

const contentBounds = computed(() => getInfiniteCanvasBounds(images.value))

const canvasFrameStyle = computed(() => ({
  width: Math.max(1, contentBounds.value.maxX + props.padding) + 'px',
  height: Math.max(1, contentBounds.value.maxY + props.padding) + 'px',
}))

// 虚拟化：只渲染视口内的图片
// 显式依赖 viewport 状态以确保响应性
const visibleImages = computed(() => {
  // 显式读取 viewport 状态触发响应式更新
  const { x, y, scale } = viewport.viewport
  
  if (!containerRef.value || !scale) return images.value
  
  const rect = containerRef.value.getBoundingClientRect()
  // 手动计算视口边界（避免函数调用丢失响应性）
  const viewportLeft = -x / scale
  const viewportTop = -y / scale
  const viewportRight = (rect.width - x) / scale
  const viewportBottom = (rect.height - y) / scale
  
  // 添加缓冲区（画布坐标系）
  const buffer = 500 / scale
  const bounds = {
    left: viewportLeft - buffer,
    top: viewportTop - buffer,
    right: viewportRight + buffer,
    bottom: viewportBottom + buffer
  }
  
  return images.value.filter(img => {
    const imgRight = img.x + img.w
    const imgBottom = img.y + img.h
    
    // 检查是否与视口相交
    return !(
      imgRight < bounds.left ||
      img.x > bounds.right ||
      imgBottom < bounds.top ||
      img.y > bounds.bottom
    )
  })
})

// 浮动工具栏位置
const floatingToolbarStyle = computed(() => {
  if (!selectedImage.value || !containerRef.value || canvasState.isDragging.value) {
    return { display: 'none' }
  }
  
  const img = selectedImage.value
  const screen = viewport.canvasToScreen(img.x + img.w / 2, img.y)
  
  // 确保位置值有效
  if (!isFinite(screen.x) || !isFinite(screen.y)) {
    return { display: 'none' }
  }
  
  return { 
    left: screen.x + 'px', 
    top: (screen.y - 52) + 'px', 
    transform: 'translateX(-50%)' 
  }
})

// 尺寸标签位置
const sizeLabelStyle = computed(() => {
  if (!selectedImage.value || !containerRef.value) return { display: 'none' }
  
  const img = selectedImage.value
  const scale = viewport.viewport.scale || 1
  
  if (canvasState.isDragging.value) {
    const pos = freeCanvasDrag.draggingPosition.value
    if (!isFinite(pos.x) || !isFinite(pos.y)) return { display: 'none' }
    return { 
      left: (pos.x + img.w * scale / 2) + 'px',
      top: (pos.y + img.h * scale + 8) + 'px',
      transform: 'translateX(-50%)' 
    }
  }
  
  const screen = viewport.canvasToScreen(img.x + img.w / 2, img.y + img.h)
  
  if (!isFinite(screen.x) || !isFinite(screen.y)) return { display: 'none' }
  
  return { 
    left: screen.x + 'px', 
    top: (screen.y + 8) + 'px', 
    transform: 'translateX(-50%)' 
  }
})

// 选中框位置
const selectionOverlayStyle = computed(() => {
  if (!selectedImage.value || !containerRef.value) return { display: 'none' }
  
  const img = selectedImage.value
  const screen = viewport.canvasToScreen(img.x, img.y)
  const scale = viewport.viewport.scale || 1
  
  // 确保位置值有效
  if (!isFinite(screen.x) || !isFinite(screen.y)) {
    return { display: 'none' }
  }
  
  return { 
    left: screen.x + 'px', 
    top: screen.y + 'px', 
    width: (img.w * scale) + 'px', 
    height: (img.h * scale) + 'px' 
  }
})

// 拖拽中图片样式
const draggingImageStyle = computed(() => {
  if (!canvasState.isDragging.value || !draggingImage.value) return { display: 'none' }
  const pos = freeCanvasDrag.draggingPosition.value
  return {
    left: pos.x + 'px',
    top: pos.y + 'px',
    width: (draggingImage.value.w * viewport.viewport.scale) + 'px',
    height: (draggingImage.value.h * viewport.viewport.scale) + 'px'
  }
})

// ============ 事件处理 ============
function handleMouseDown(e) {
  // 检查是否应该平移
  if (e.button === 1 || (e.button === 0 && (canvasState.spacePressed.value || e.altKey))) {
    e.preventDefault()
    canvasState.startPan()
    viewport.startPan(e.clientX, e.clientY)
  }
}

function handleMouseMove(e) {
  // 平移
  if (canvasState.isPanning.value) {
    pendingPanX = e.clientX
    pendingPanY = e.clientY
    schedulePanFrame()
    return
  }

  // 缩放图片
  if (canvasState.isResizing.value && selectedImage.value) {
    pendingResizeX = e.clientX
    pendingResizeY = e.clientY
    scheduleResizeFrame()
    return
  }

  // 拖拽图片
  if (canvasState.draggedId.value) {
    // 检查是否超过阈值
    if (!canvasState.isDragging.value && freeCanvasDrag.hasMovedBeyondThreshold(e.clientX, e.clientY)) {
      canvasState.markMoved()
      canvasState.startDrag(canvasState.draggedId.value)
    }

    if (canvasState.isDragging.value) {
      pendingDragX = e.clientX
      pendingDragY = e.clientY
      scheduleDragFrame()
    }
  }
}

// 使用 requestAnimationFrame 合并高频指针事件，避免每像素都触发响应式更新与重排
let panFrameId = 0
let resizeFrameId = 0
let dragFrameId = 0
let pendingPanX = 0
let pendingPanY = 0
let pendingResizeX = 0
let pendingResizeY = 0
let pendingDragX = 0
let pendingDragY = 0

function schedulePanFrame() {
  if (panFrameId) return
  panFrameId = requestAnimationFrame(() => {
    panFrameId = 0
    if (canvasState.isPanning.value) {
      viewport.updatePan(pendingPanX, pendingPanY)
    }
  })
}

function scheduleResizeFrame() {
  if (resizeFrameId) return
  resizeFrameId = requestAnimationFrame(() => {
    resizeFrameId = 0
    if (canvasState.isResizing.value && selectedImage.value) {
      imageResize.updateResize(
        canvasState.selectedId.value,
        pendingResizeX,
        pendingResizeY,
        canvasState.resizeHandle.value,
        viewport.viewport.scale,
      )
    }
  })
}

function scheduleDragFrame() {
  if (dragFrameId) return
  dragFrameId = requestAnimationFrame(() => {
    dragFrameId = 0
    if (canvasState.isDragging.value) {
      freeCanvasDrag.updateDrag(pendingDragX, pendingDragY, viewport.viewport)
    }
  })
}

function handleMouseUp() {
  // 结束缩放
  if (canvasState.isResizing.value) {
    // 记录缩放历史
    const img = selectedImage.value
    if (img) {
      const oldW = imageResize.resizeState.startWidth
      const oldH = imageResize.resizeState.startHeight
      const oldX = imageResize.resizeState.startX
      const oldY = imageResize.resizeState.startY
      const newW = img.w
      const newH = img.h
      const newX = img.x
      const newY = img.y
      const imgId = img.id
      
      if (oldW !== newW || oldH !== newH || oldX !== newX || oldY !== newY) {
        history.push({
          type: 'resize',
          data: { imgId, oldW, oldH, oldX, oldY, newW, newH, newX, newY },
          undo: (data) => {
            const target = images.value.find(i => i.id === data.imgId)
            if (target) {
              target.w = data.oldW
              target.h = data.oldH
              target.x = data.oldX
              target.y = data.oldY
            }
          },
          redo: (data) => {
            const target = images.value.find(i => i.id === data.imgId)
            if (target) {
              target.w = data.newW
              target.h = data.newH
              target.x = data.newX
              target.y = data.newY
            }
          }
        })
      }
    }
    
    imageResize.endResize()
    canvasState.endResize()
    return
  }
  
  // 结束拖拽
  if (canvasState.draggedId.value) {
    const currentDraggedId = canvasState.draggedId.value
    
    if (canvasState.isDragging.value) {
      const move = freeCanvasDrag.endDrag(currentDraggedId)
      if (move.oldX !== move.newX || move.oldY !== move.newY) {
        history.push({
          type: 'move',
          data: { imgId: currentDraggedId, ...move },
          undo: (data) => {
            const target = images.value.find(i => i.id === data.imgId)
            if (target) { target.x = data.oldX; target.y = data.oldY }
          },
          redo: (data) => {
            const target = images.value.find(i => i.id === data.imgId)
            if (target) { target.x = data.newX; target.y = data.newY }
          }
        })
      }
    }
    
    const moved = canvasState.endDrag()
    
    // 如果没有移动过，保持选中状态（点击选中）
    if (!moved) {
      canvasState.select(currentDraggedId)
    }
    return
  }
  
  // 结束平移
  if (canvasState.isPanning.value) {
    canvasState.endPan()
  }
}

function handleWheel(e) {
  e.preventDefault()
  const rect = containerRef.value.getBoundingClientRect()
  
  if (e.metaKey || e.ctrlKey) {
    const newScale = viewport.zoomAt(e.clientX, e.clientY, e.deltaY, rect)
    emit('zoom-change', Math.round(newScale * 100))
  } else {
    viewport.pan(e.deltaX, e.deltaY)
  }
}

function handleKeyDown(e) {
  // Space：进入临时 panning 模式（按住模式，需配对 keyup 释放，因此不走 useShortcut）
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    canvasState.setSpacePressed(true)
  }
}

// 单次触发快捷键统一走 useShortcut：自动管理生命周期 + 输入框焦点屏蔽
useShortcut(
  'Escape',
  () => {
    if (canvasState.isDragging.value || canvasState.isResizing.value) {
      canvasState.cancel()
    } else {
      canvasState.deselect()
    }
  },
  // Esc 不阻止默认，让 el-dialog / el-popover 等浮层也能关闭
  { preventDefault: false },
)
useShortcut('CmdOrCtrl+Z', () => history.undo())
useShortcut(['CmdOrCtrl+Shift+Z', 'CmdOrCtrl+Y'], () => history.redo())

function handleKeyUp(e) {
  if (e.code === 'Space') {
    canvasState.setSpacePressed(false)
  }
}

// ============ 触摸事件处理 ============
function handleTouchStart(e) {
  pointer.handleTouchStart(e, {
    onPinchStart: () => {
      // 双指缩放开始
    },
    onPointerDown: (x, y) => {
      // 单指触摸 - 可能是平移或选择
      if (!e.target.closest('.image-item')) {
        canvasState.startPan()
        viewport.startPan(x, y)
      }
    }
  })
}

function handleTouchMove(e) {
  pointer.handleTouchMove(e, {
    onPinch: (centerX, centerY, scale, dx, dy) => {
      // 双指缩放和平移
      const rect = containerRef.value.getBoundingClientRect()
      
      // 应用缩放
      const oldScale = viewport.viewport.scale
      const newScale = Math.max(props.minZoom / 100, Math.min(props.maxZoom / 100, oldScale * scale))
      
      if (newScale !== oldScale) {
        const mouseX = centerX - rect.left
        const mouseY = centerY - rect.top
        const scaleRatio = newScale / oldScale
        
        viewport.viewport.x = mouseX - (mouseX - viewport.viewport.x) * scaleRatio
        viewport.viewport.y = mouseY - (mouseY - viewport.viewport.y) * scaleRatio
        viewport.viewport.scale = newScale
        
        emit('zoom-change', Math.round(newScale * 100))
      }
      
      // 应用平移
      viewport.viewport.x += dx
      viewport.viewport.y += dy
    },
    onPointerMove: (x, y) => {
      if (canvasState.isPanning.value) {
        viewport.updatePan(x, y)
      }
    }
  })
}

function handleTouchEnd(e) {
  pointer.handleTouchEnd(e, {
    onPinchEnd: () => {
      // 双指缩放结束
    },
    onPointerUp: () => {
      if (canvasState.isPanning.value) {
        canvasState.endPan()
      }
    }
  })
}

function handleCanvasClick(e) {
  // 如果点击的是图片，不取消选中
  if (e.target.closest('.image-item')) return
  if (!canvasState.isDragging.value) {
    canvasState.deselect()
  }
}

function handleImageDragStart(e, img) {
  if (e.button !== 0) return
  
  canvasState.select(img.id)
  freeCanvasDrag.startDrag(img.id, e.clientX, e.clientY, viewport.viewport)
  
  // 先记录 draggedId，等移动超过阈值再真正进入拖拽状态
  canvasState.prepareDrag(img.id)
}

function handleResizeStart(e, handle) {
  if (e.button !== 0 || !selectedImage.value) return
  e.stopPropagation()
  
  imageResize.startResize(canvasState.selectedId.value, e.clientX, e.clientY)
  canvasState.startResize(handle)
}

// ============ 同步外部 zoom ============
watch(() => props.zoom, (newZoom) => {
  if (!containerRef.value) {
    // 初始化时直接设置 scale
    viewport.viewport.scale = newZoom / 100
    return
  }
  const rect = containerRef.value.getBoundingClientRect()
  viewport.setZoom(newZoom, rect)
}, { immediate: true })

// ============ 选中变化通知 ============
watch(() => canvasState.selectedId.value, (newId) => {
  emit('selection-change', newId ? selectedImage.value : null)
})

watch(
  [images, () => ({ ...viewport.viewport })],
  () => {
    if (suppressSnapshotEmit) return
    if (snapshotEmitTimer) clearTimeout(snapshotEmitTimer)
    snapshotEmitTimer = setTimeout(() => {
      emit('snapshot-change', getSnapshot())
    }, 180)
  },
  { deep: true },
)

// ============ 生命周期 ============
function initCanvasPosition() {
  viewport.viewport.scale = props.zoom / 100
  centerCanvasContent()
}

function centerCanvasContent() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const scale = viewport.viewport.scale || 1
  viewport.viewport.x = rect.width / 2 - contentBounds.value.centerX * scale
  viewport.viewport.y = rect.height / 2 - contentBounds.value.centerY * scale
}

onMounted(() => {
  setTimeout(() => {
    if (!hasRestoredSnapshot) initCanvasPosition()
  }, 100)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  if (panFrameId) cancelAnimationFrame(panFrameId)
  if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
  if (dragFrameId) cancelAnimationFrame(dragFrameId)
  if (snapshotEmitTimer) clearTimeout(snapshotEmitTimer)
})

</script>

<template>
  <div 
    ref="containerRef"
    class="canvas-container"
    :class="{ 
      panning: canvasState.isPanning.value, 
      'space-pressed': canvasState.spacePressed.value 
    }"
    @mousedown="handleMouseDown"
    @wheel.prevent="handleWheel"
    @contextmenu.prevent
    @click="handleCanvasClick"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div class="main-container">
      <div class="canvas-layer" :style="viewport.transformStyle.value">
        <div 
          class="canvas-frame" 
          :style="canvasFrameStyle"
        >
          <!-- 自由坐标图片（虚拟化渲染） -->
          <div 
            v-for="img in visibleImages"
            :key="img.id"
            class="image-item"
            :class="{ hidden: canvasState.isDragging.value && canvasState.draggedId.value === img.id }"
            :style="{ 
              left: img.x + 'px',
              top: img.y + 'px',
              width: img.w + 'px', 
              height: img.h + 'px',
              zIndex: img.zIndex
            }"
            @mousedown.stop="handleImageDragStart($event, img)"
          >
            <img :src="img.src"  loading="lazy" draggable="false" />
            <div class="ai-tag">AI生成</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 拖拽中的图片 -->
    <div v-if="canvasState.isDragging.value && draggingImage" class="dragging-image" :style="draggingImageStyle">
      <img :src="draggingImage.src"  draggable="false" />
      <div class="corner-handle top-left"></div>
      <div class="corner-handle top-right"></div>
      <div class="corner-handle bottom-left"></div>
      <div class="corner-handle bottom-right"></div>
    </div>
    
    <!-- 选中框覆盖层 -->
    <div v-if="selectedImage && !canvasState.isDragging.value" class="selection-overlay" :style="selectionOverlayStyle">
      <div class="selection-border"></div>
      <div class="corner-handle top-left" @mousedown="handleResizeStart($event, 'top-left')"></div>
      <div class="corner-handle top-right" @mousedown="handleResizeStart($event, 'top-right')"></div>
      <div class="corner-handle bottom-left" @mousedown="handleResizeStart($event, 'bottom-left')"></div>
      <div class="corner-handle bottom-right" @mousedown="handleResizeStart($event, 'bottom-right')"></div>
    </div>
    
    <!-- 浮动工具栏 -->
    <div v-if="selectedImage && !canvasState.isDragging.value" class="floating-toolbar" :style="floatingToolbarStyle" @click.stop>
      <button class="toolbar-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        <span>重新编辑</span>
      </button>
      <button class="toolbar-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4V2.5a.5.5 0 0 1 .854-.354l2.646 2.647a.5.5 0 0 1 0 .707L12.854 8.146A.5.5 0 0 1 12 7.793V6a6 6 0 1 0 6 6 1 1 0 1 1 2 0 8 8 0 1 1-8-8Z" fill="currentColor"/></svg>
        <span>再次生成</span>
      </button>
      <button class="toolbar-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17.67 16.55a1 1 0 0 1 1.414 0l2.121 2.12a1.007 1.007 0 0 1 0 1.415l-2.121 2.122a1 1 0 0 1-1.414-1.415l.414-.414h-4.211a1 1 0 0 1 0-2h4.211l-.414-.414a1 1 0 0 1 0-1.414Z" fill="currentColor"/><path d="M16.39 2.607a5 5 0 0 1 5 5v8.421l-.892-.891a2.985 2.985 0 0 0-1.108-.7v-6.83a3 3 0 0 0-3-3H7.604a3 3 0 0 0-3 3v8.786c0 .188.02.372.052.55.143-.418.381-.813.719-1.151l2.797-2.797a3 3 0 0 1 4.092-.14l3.13 2.726c.113.1.215.206.31.314-.08.156-.145.319-.195.484h-1.636a3 3 0 0 0-3 3c0 .776.298 1.481.781 2.014h-4.05l-.256-.007a5 5 0 0 1-4.737-4.737l-.007-.256V7.607a5 5 0 0 1 5-5h8.786Z" fill="currentColor"/></svg>
        <span>添加到对话</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-icon-btn" title="详情">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9-3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm0 4a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0v-4Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>
      </button>
      <button class="toolbar-icon-btn" title="下载">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2a1 1 0 0 1 1 1v10.586l2.293-2.293a1 1 0 0 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1ZM5 17a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>
      </button>
    </div>
    
    <!-- 尺寸标签 -->
    <div v-if="selectedImage" class="size-label" :style="sizeLabelStyle">
      {{ selectedImage.w }} × {{ selectedImage.h }}
    </div>
  </div>
</template>

<style scoped>
.canvas-container {
  flex: 1 1;
  height: 100%;
  overflow: hidden;
  position: relative;
  width: 100%;
  z-index: 1;
  background-color: var(--canvas-bg);
  cursor: default;
  touch-action: none;
}
.canvas-container.space-pressed { cursor: grab; }
.canvas-container.panning { cursor: grabbing; }

.main-container {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  overflow: hidden;
  user-select: none;
}

.canvas-layer {
  position: absolute;
  top: 0; left: 0;
  will-change: transform;
}

.canvas-frame {
  position: relative;
  box-sizing: border-box;
  min-width: 1px;
  min-height: 1px;
  background: transparent;
  overflow: visible;
}

.image-item {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  overflow: visible;
  border-radius: 8px;
  cursor: move;
}
.image-item.hidden { opacity: 0.3; }

.image-item img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
  border-radius: 8px;
}

.selection-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 100000;
}

.selection-border {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border: 3px solid #00cae0;
  border-radius: 8px;
  pointer-events: none;
  box-sizing: border-box;
}

.ai-tag {
  position: absolute;
  top: 8px; left: 8px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 10px;
  font-weight: 500;
  pointer-events: none;
  z-index: 1;
}

.corner-handle {
  position: absolute;
  width: 14px; height: 14px;
  background: #00cae0;
  border: 3px solid #fff;
  border-radius: 50%;
  pointer-events: auto;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.corner-handle.top-left { top: -7px; left: -7px; cursor: nwse-resize; }
.corner-handle.top-right { top: -7px; right: -7px; cursor: nesw-resize; }
.corner-handle.bottom-left { bottom: -7px; left: -7px; cursor: nesw-resize; }
.corner-handle.bottom-right { bottom: -7px; right: -7px; cursor: nwse-resize; }

.dragging-image {
  position: fixed;
  z-index: 100002;
  pointer-events: none;
  border-radius: 8px;
  outline: 3px solid #00cae0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
.dragging-image img {
  width: 100%; height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.floating-toolbar {
  position: absolute;
  z-index: 100001;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  background: var(--canvas-float-block-default);
  backdrop-filter: blur(var(--canvas-float-backdrop-blur));
  border: 0.5px solid var(--stroke-tertiary);
  border-radius: 10px;
  box-shadow: var(--shadow-generator-float-block);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.toolbar-btn:hover { background: var(--menu-item-hover); }
.toolbar-btn svg { flex-shrink: 0; }

.toolbar-divider {
  width: 1px; height: 20px;
  background: var(--stroke-tertiary);
  margin: 0 6px;
}

.toolbar-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px; height: 32px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}
.toolbar-icon-btn:hover { background: var(--menu-item-hover); }

.size-label {
  position: absolute;
  z-index: 100000;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
}
</style>
