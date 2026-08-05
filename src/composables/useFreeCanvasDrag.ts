import { computed, reactive, type Ref } from 'vue'
import type { InfiniteCanvasImageSnapshot } from '@/types/infinite-canvas'

interface CanvasViewport {
  x: number
  y: number
  scale: number
}

export function useFreeCanvasDrag(images: Ref<InfiniteCanvasImageSnapshot[]>) {
  const dragState = reactive({
    imageId: '' as string | number,
    startMouseX: 0,
    startMouseY: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    currentScreenX: 0,
    currentScreenY: 0,
  })

  const draggingPosition = computed(() => ({
    x: dragState.currentScreenX,
    y: dragState.currentScreenY,
  }))

  const startDrag = (imageId: string | number, mouseX: number, mouseY: number, viewport: CanvasViewport) => {
    const image = images.value.find(item => item.id === imageId)
    if (!image) return
    dragState.imageId = imageId
    dragState.startMouseX = mouseX
    dragState.startMouseY = mouseY
    dragState.startX = image.x
    dragState.startY = image.y
    dragState.currentX = image.x
    dragState.currentY = image.y
    dragState.currentScreenX = viewport.x + image.x * viewport.scale
    dragState.currentScreenY = viewport.y + image.y * viewport.scale
  }

  const updateDrag = (mouseX: number, mouseY: number, viewport: CanvasViewport) => {
    const scale = viewport.scale || 1
    dragState.currentX = dragState.startX + (mouseX - dragState.startMouseX) / scale
    dragState.currentY = dragState.startY + (mouseY - dragState.startMouseY) / scale
    dragState.currentScreenX = viewport.x + dragState.currentX * scale
    dragState.currentScreenY = viewport.y + dragState.currentY * scale
  }

  const endDrag = (imageId: string | number) => {
    const image = images.value.find(item => item.id === imageId)
    const result = {
      oldX: dragState.startX,
      oldY: dragState.startY,
      newX: dragState.currentX,
      newY: dragState.currentY,
    }
    if (image) {
      image.x = result.newX
      image.y = result.newY
    }
    dragState.imageId = ''
    return result
  }

  const hasMovedBeyondThreshold = (mouseX: number, mouseY: number, threshold = 5) => (
    Math.abs(mouseX - dragState.startMouseX) > threshold
    || Math.abs(mouseY - dragState.startMouseY) > threshold
  )

  return {
    dragState,
    draggingPosition,
    startDrag,
    updateDrag,
    endDrag,
    hasMovedBeyondThreshold,
  }
}
