<script setup lang="ts">
/**
 * 图片节点（RunningHUB 风样板）
 *
 * 视觉对照 HTML 抽出的真实样式：
 *   - 卡片 380×280, border-radius 16
 *   - 标题外置（absolute bottom:100%）
 *   - 4 类状态：空态菜单 / ready-state（有上游连线）/ 加载 / 有图
 *   - 选中态：青绿描边 + 流光边框 + 模糊光晕
 *   - 节点外左右 -56px "+" 按钮
 *   - 选中后下方浮出 CanvasPromptInput（图片模型 + 尺寸/质量/价格 chip）
 *   - 保留批量生图组叠卡能力
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import {
  CopyDocument,
  Download,
  Delete,
  Picture,
  VideoCamera,
  PictureFilled,
  Sunny,
  Upload as UploadIcon,
  Aim,
  EditPen,
  Refresh,
  MoreFilled,
  Crop,
  ZoomIn,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import CanvasGenerationInfo from '@/components/canvas/CanvasGenerationInfo.vue'
import CanvasNodeHoverToolbar, { type NodeToolbarAction } from '@/components/canvas/CanvasNodeHoverToolbar.vue'
import CanvasNodeTopToolbar, { type NodeTopToolbarItem } from '@/components/canvas/CanvasNodeTopToolbar.vue'
import CanvasNodeAddHandle from '@/components/canvas/CanvasNodeAddHandle.vue'
import CanvasNodeResizer from '@/components/canvas/CanvasNodeResizer.vue'
import { useNodeTitleEdit } from '@/composables/useNodeTitleEdit'
import {
  updateNode,
  removeNode,
  duplicateNode,
  addNode,
  addEdge,
  nodes,
  edges,
  manualSaveHistory,
  type WorkflowImageNodeData,
} from '../../composables/useWorkflowCanvas'
import { uploadStorageFile } from '@/api/storage'
import { loadPublicModelCatalog } from '@/config/models'
import { createGenerationTask, subscribeGenerationTaskEvents, resolveGenerationTaskModel } from '@/api/generation-tasks'
import { appendImageReferencesToRequestBody } from '@/shared/image-generation-request'
import {
  commitWorkflowGridNodesAtomically,
  requireCompleteWorkflowGridUpload,
} from '@/shared/workflow-grid-transaction'
import { buildWorkflowGenerationMetadata } from '@/shared/workflow-generation-metadata'

const props = defineProps<{
  id: string
  data: WorkflowImageNodeData & { selected?: boolean }
  selected?: boolean
}>()
const isSelected = computed(() => props.selected || props.data?.selected)
const titleEdit = useNodeTitleEdit(props.id, () => props.data?.label || 'Image')
const { updateNodeInternals, addSelectedNodes, removeSelectedNodes, getNodes } = useVueFlow()

const showActions = ref(false)
const imageUrl = ref(props.data?.url || '')
const isLoading = ref(!!props.data?.loading)
const errorMsg = ref(props.data?.error || '')
const fileInputRef = ref<HTMLInputElement | null>(null)
const cropDialogVisible = ref(false)
const cropAspect = ref<'original' | '1x1' | '4x3' | '16x9' | '3x4'>('1x1')
const cropZoom = ref(1)
const cropX = ref(50)
const cropY = ref(50)
const cropSaving = ref(false)
const cropAspectOptions = ['original', '1x1', '4x3', '16x9', '3x4'] as const

watch(
  [() => props.data?.url, () => props.data?.loading, () => props.data?.error],
  ([url, loading, error]) => {
    if (url !== undefined) imageUrl.value = url
    if (loading !== undefined) isLoading.value = loading
    if (error !== undefined) errorMsg.value = error
  },
)

// 上游连线检测：当 target=本节点 的边存在时，节点处于"已连接参考图片"状态
const hasUpstream = computed(() => edges.value.some((e) => e.target === props.id))

// 4 类状态优先级：加载 > 错误 > 有图 > ready-state（无图但有上游）> 空态菜单
const showLoading = computed(() => isLoading.value)
const showError = computed(() => !isLoading.value && !!errorMsg.value)
const showImage = computed(() => !isLoading.value && !errorMsg.value && !!imageUrl.value)
const showReady = computed(() => !showLoading.value && !showError.value && !showImage.value && hasUpstream.value)
const showEmpty = computed(() => !showLoading.value && !showError.value && !showImage.value && !showReady.value)

// 图片加载、状态切换会改变卡片尺寸；同步通知 Vue Flow 重测 Handle，
// 否则已存在的边会继续使用旧端点，视觉上像是断在节点外的“+”处。
const refreshNodeInternals = () => {
  void nextTick(() => {
    requestAnimationFrame(() => updateNodeInternals([props.id]))
  })
}

// 远端地址失效、跨域拦截或上传文件已被删除时，浏览器只会触发 img 的 error
// 事件。若不处理，节点仍按“有图”状态撑开，留下无法辨认的大块空白区域。
const handleImageLoadError = () => {
  if (!imageUrl.value || errorMsg.value) return

  const error = '图片加载失败'
  imageUrl.value = ''
  errorMsg.value = error
  updateNode(props.id, {
    url: '',
    loading: false,
    error,
    // 失效图片不应继续保留此前拖出的巨大图片画布。
    style: { width: 300, height: 200 },
  })
  refreshNodeInternals()
}

watch([showImage, showReady, () => props.data?.url], refreshNodeInternals)
onMounted(refreshNodeInternals)

const triggerUpload = () => fileInputRef.value?.click()
const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    isLoading.value = true
    updateNode(props.id, { loading: true })
    const uploaded = await uploadStorageFile(file, 'asset')
    if (uploaded) {
      imageUrl.value = uploaded.publicUrl
      errorMsg.value = ''
      updateNode(props.id, { url: uploaded.publicUrl, loading: false, error: '' })
      // 上传成功后：如果还没有下游节点，自动创建一个 ready-state 的下游 image 节点
      autoCreateDownstreamImageNode()
    } else {
      throw new Error('upload returned empty')
    }
  } catch (err) {
    ElMessage.error('图片上传失败')
    updateNode(props.id, { loading: false, error: '上传失败' })
    // eslint-disable-next-line no-console
    console.error('[ImageNode] upload failed', err)
  } finally {
    isLoading.value = false
    input.value = ''
  }
}

// 已有下游节点？
const hasDownstream = computed(() => edges.value.some((e) => e.source === props.id))

/**
 * 自动创建一个下游 image 节点 + 连线，让画布进入 img_5 状态：
 * 「左侧已上传图片节点 → 右侧 ready-state Image 节点 + 底部 PromptInput（自动带 "图片1" 缩略 chip）」
 */
const autoCreateDownstreamImageNode = () => {
  if (hasDownstream.value) return
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('image', { x: node.position.x + 480, y: node.position.y }, { label: 'Image' })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageOrder',
    data: { imageOrder: 1 },
  })
  setTimeout(() => {
    updateNodeInternals([newId])
    const allNodes = getNodes.value
    removeSelectedNodes(allNodes.filter((n) => n.selected))
    const target = allNodes.find((n) => n.id === newId)
    if (target) addSelectedNodes([target])
  }, 100)
}

const focusNode = (nodeId: string) => {
  setTimeout(() => {
    updateNodeInternals([nodeId])
    const allNodes = getNodes.value
    removeSelectedNodes(allNodes.filter(node => node.selected))
    const target = allNodes.find(node => node.id === nodeId)
    if (target) addSelectedNodes([target])
  }, 80)
}

const createDownstreamImageNode = (label: string) => {
  const node = nodes.value.find(item => item.id === props.id)
  if (!node) return ''
  const siblingCount = edges.value.filter(edge => edge.source === props.id).length
  const newId = addNode('image', {
    x: node.position.x + 470,
    y: node.position.y + siblingCount * 310,
  }, { label })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageOrder',
    data: { imageOrder: siblingCount + 1 },
  })
  focusNode(newId)
  return newId
}

const queueImageVariation = (label: string, prompt: string) => {
  if (!requireImage()) return
  const newId = createDownstreamImageNode(label)
  if (!newId) return
  window.dispatchEvent(new CustomEvent('canvasmind:workflow-image-tool-preset', {
    detail: { nodeId: newId, text: prompt },
  }))
  ElMessage.success(`已创建“${label}”结果节点，可在输入栏继续调整后生成`)
}

const handleDownload = async () => {
  if (!imageUrl.value) return
  try {
    const res = await fetch(imageUrl.value)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `image_${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    window.open(imageUrl.value, '_blank')
  }
}

const handleDelete = () => removeNode(props.id)
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) setTimeout(() => updateNodeInternals([newId]), 50)
}

// 批量生图组：当 isBatchRoot 且子图数量 > 1 时显示叠卡 + 计数
const isBatchGroupVisible = computed(() =>
  Boolean(props.data?.isBatchRoot && (props.data.batchChildren?.length ?? 0) > 1),
)
const batchChildCount = computed(() => props.data?.batchChildren?.length ?? 0)
const toggleBatchExpanded = () => {
  if (!isBatchGroupVisible.value) return
  updateNode(props.id, { batchExpanded: !props.data?.batchExpanded })
}
const selectBatchChild = (child: { id: string; url: string }) => {
  if (props.data?.primaryImageId === child.id && imageUrl.value === child.url) return
  updateNode(props.id, { primaryImageId: child.id, url: child.url })
  // 批量组内切换主图是一次完整的画布编辑，立即形成单独的撤销点。
  manualSaveHistory()
}

/** 将批量结果拆为独立图片节点；当前主图保留在原节点，避免破坏已有下游连线。 */
const splitBatchChildren = () => {
  const children = props.data?.batchChildren || []
  const primaryId = props.data?.primaryImageId
  const primaryUrl = imageUrl.value
  const extras = children.filter(child => child.id !== primaryId && child.url !== primaryUrl)
  if (!extras.length) {
    ElMessage.info('批量结果没有可拆分的其他图片')
    return
  }
  const source = nodes.value.find(node => node.id === props.id)
  const baseX = source?.position?.x || 0
  const baseY = source?.position?.y || 0
  extras.forEach((child, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    addNode('image', {
      x: baseX + 340 + column * 300,
      y: baseY + row * 250,
    }, {
      url: child.url,
      label: `批量结果 ${index + 2}`,
      generationMeta: props.data?.generationMeta,
      taskRecordId: props.data?.taskRecordId,
    })
  })
  manualSaveHistory()
  ElMessage.success(`已拆分 ${extras.length} 张批量结果`)
}

// 「尝试」菜单：图生图 / 图生视频 / 图片换背景 / 首帧图生视频
const requireImage = (): boolean => {
  if (imageUrl.value) return true
  ElMessage.info('请先上传图片，再使用该能力')
  triggerUpload()
  return false
}

const handleImageToImage = () => {
  if (!requireImage()) return
  // 已有图：直接创建下游占位节点；没图时 requireImage 已触发上传，handleFileChange 上传成功后会调 autoCreate
  autoCreateDownstreamImageNode()
}
const handleImageToVideo = (role: 'first_frame_image' | 'input_reference' = 'input_reference') => {
  if (!requireImage()) return
  const node = nodes.value.find((n) => n.id === props.id)
  if (!node) return
  const newId = addNode('videoConfig', { x: node.position.x + 380, y: node.position.y })
  addEdge({
    source: props.id,
    target: newId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'imageRole',
    data: { imageRole: role },
  })
  setTimeout(() => updateNodeInternals([newId]), 50)
}
const handleChangeBackground = () => {
  if (!requireImage()) return
  autoCreateDownstreamImageNode()
  ElMessage.success('已创建换背景结果节点，请在输入栏描述目标背景')
}

const openCropDialog = () => {
  if (!requireImage()) return
  cropAspect.value = '1x1'
  cropZoom.value = 1
  cropX.value = 50
  cropY.value = 50
  cropDialogVisible.value = true
}

const cropAspectValue = computed(() => ({
  original: 0,
  '1x1': 1,
  '4x3': 4 / 3,
  '16x9': 16 / 9,
  '3x4': 3 / 4,
})[cropAspect.value])

const saveCrop = async () => {
  if (!imageUrl.value || cropSaving.value) return
  cropSaving.value = true
  try {
    const response = await fetch(imageUrl.value)
    if (!response.ok) throw new Error(`读取图片失败 (${response.status})`)
    const sourceBlob = await response.blob()
    const bitmap = await createImageBitmap(sourceBlob)
    const sourceRatio = bitmap.width / bitmap.height
    const targetRatio = cropAspectValue.value || sourceRatio
    let cropWidth = bitmap.width
    let cropHeight = bitmap.height
    if (sourceRatio > targetRatio) cropWidth = cropHeight * targetRatio
    else cropHeight = cropWidth / targetRatio
    cropWidth /= cropZoom.value
    cropHeight /= cropZoom.value
    const sourceX = (bitmap.width - cropWidth) * (cropX.value / 100)
    const sourceY = (bitmap.height - cropHeight) * (cropY.value / 100)
    const maxOutput = 2048
    const scale = Math.min(1, maxOutput / Math.max(cropWidth, cropHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(cropWidth * scale))
    canvas.height = Math.max(1, Math.round(cropHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持图片裁剪')
    context.drawImage(bitmap, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const outputBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('裁剪结果导出失败')),
      'image/png',
      0.94,
    ))
    const uploaded = await uploadStorageFile(new File([outputBlob], `crop-${Date.now()}.png`, { type: 'image/png' }), 'asset')
    if (!uploaded?.publicUrl) throw new Error('裁剪结果上传失败')
    updateNode(props.id, { url: uploaded.publicUrl, error: '' })
    cropDialogVisible.value = false
    ElMessage.success('图片已裁剪')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '图片裁剪失败')
  } finally {
    cropSaving.value = false
  }
}

const gridSaving = ref(false)
const splitImageGrid = async (rows: number, columns: number) => {
  if (!imageUrl.value || gridSaving.value || !requireImage()) return
  gridSaving.value = true
  try {
    const response = await fetch(imageUrl.value)
    if (!response.ok) throw new Error(`读取图片失败 (${response.status})`)
    const bitmap = await createImageBitmap(await response.blob())
    const cellWidth = bitmap.width / columns
    const cellHeight = bitmap.height / rows
    const outputBlobs: Blob[] = []
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(cellWidth))
        canvas.height = Math.max(1, Math.round(cellHeight))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('浏览器不支持宫格切分')
        context.drawImage(
          bitmap,
          column * cellWidth,
          row * cellHeight,
          cellWidth,
          cellHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        outputBlobs.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('切分图片导出失败')),
          'image/png',
          0.94,
        )))
      }
    }
    bitmap.close()
    const uploaded = requireCompleteWorkflowGridUpload(await Promise.all(outputBlobs.map((blob, index) => uploadStorageFile(
      new File([blob], `grid-${rows}x${columns}-${index + 1}.png`, { type: 'image/png' }),
      'asset',
    ))), outputBlobs.length)
    const sourceNode = nodes.value.find(node => node.id === props.id)
    if (!sourceNode) throw new Error('原图片节点不存在')
    const startX = sourceNode.position.x + 470
    const startY = sourceNode.position.y
    const createdNodeIds = commitWorkflowGridNodesAtomically({
      items: uploaded,
      createNode: (file, index) => {
        const row = Math.floor(index / columns)
        const column = index % columns
        return addNode('image', {
          x: startX + column * 365,
          y: startY + row * 315,
        }, { url: file.publicUrl, label: `宫格 ${index + 1}` })
      },
      connectNode: (newId, _file, index) => addEdge({
        source: props.id,
        target: newId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'imageOrder',
        data: { imageOrder: index + 1 },
      }),
      rollbackNode: removeNode,
    })
    const lastNodeId = createdNodeIds.at(-1) || ''
    if (lastNodeId) focusNode(lastNodeId)
    ElMessage.success(`已切分为 ${rows * columns} 张图片`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '宫格切分失败')
  } finally {
    gridSaving.value = false
  }
}

const hoverActions = computed<NodeToolbarAction[]>(() => {
  const list: NodeToolbarAction[] = [
    { id: 'duplicate', label: '复制', icon: CopyDocument, onClick: handleDuplicate },
  ]
  if (imageUrl.value) {
    list.push({ id: 'download', label: '下载', icon: Download, onClick: handleDownload })
  }
  if (isBatchGroupVisible.value) {
    list.push({ id: 'split-batch', label: '拆分批量结果', icon: CopyDocument, onClick: splitBatchChildren })
  }
  list.push({ id: 'delete', label: '删除', icon: Delete, danger: true, onClick: handleDelete })
  return list
})

const emptyMenuItems = [
  { id: 'i2i', label: '图生图', icon: Picture, onClick: handleImageToImage },
  { id: 'i2v', label: '图生视频', icon: VideoCamera, onClick: () => handleImageToVideo('input_reference') },
  { id: 'bg', label: '图片换背景', icon: Sunny, onClick: handleChangeBackground },
  { id: 'first-frame', label: '首帧图生视频', icon: PictureFilled, onClick: () => handleImageToVideo('first_frame_image') },
]

// 选中态下方浮层：用 ContentGenerator（与 /generate 同款），锁定 image 类型
onMounted(() => {
  void loadPublicModelCatalog()
  resumePendingTask()
})
// 上游图片素材 → 作为图生图参考图（直接拿 url 数组）
// 注意：上游图生图模型（如 gpt-image-2）只接受栅格格式，SVG/PDF/HEIC 等会让 PIL 在
// BytesIO 解码时报 "cannot identify image file"，必须在客户端过滤掉。
const RASTER_REFERENCE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'])
const isRasterReferenceUrl = (url: string): boolean => {
  if (!url) return false
  // data url 直接放行
  if (url.startsWith('data:image/')) return true
  // 截掉 query/hash 再取扩展名
  const cleanUrl = url.split('?')[0].split('#')[0]
  const dotIndex = cleanUrl.lastIndexOf('.')
  if (dotIndex < 0) return true // 无扩展名时不强制拦截
  const ext = cleanUrl.slice(dotIndex + 1).toLowerCase()
  return RASTER_REFERENCE_EXTENSIONS.has(ext)
}
const droppedNonRasterRefsHint = ref(false)
const upstreamReferenceUrls = computed<string[]>(() => {
  const refs: string[] = []
  let droppedCount = 0
  const upstreamEdges = edges.value.filter((e) => e.target === props.id)
  for (const edge of upstreamEdges) {
    const sourceNode = nodes.value.find((n) => n.id === edge.source)
    if (!sourceNode) continue
    if (sourceNode.type === 'image') {
      const url = (sourceNode.data as { url?: string })?.url
      if (!url) continue
      if (isRasterReferenceUrl(url)) {
        refs.push(url)
      } else {
        droppedCount += 1
      }
    }
  }
  if (droppedCount > 0 && !droppedNonRasterRefsHint.value) {
    droppedNonRasterRefsHint.value = true
    ElMessage.warning(`已忽略 ${droppedCount} 张非栅格格式（SVG 等）的参考图，图生图模型不支持`)
    // 下一次重新出现时再次提示
    setTimeout(() => { droppedNonRasterRefsHint.value = false }, 3000)
  }
  return refs
})

const handleToolbarMenu = (group: string, command: string) => {
  const presets: Record<string, { label: string; prompt: string }> = {
    'panorama:wide': { label: '横向全景', prompt: '将参考图扩展为 2:1 横向全景构图，补全两侧环境，保持主体、风格与光线一致。' },
    'panorama:vertical': { label: '纵向全景', prompt: '将参考图扩展为 9:16 纵向全景构图，补全上下环境，保持主体、风格与光线一致。' },
    'panorama:360': { label: '360° 环景', prompt: '基于参考图生成 360 度环景视图，场景衔接自然，保持空间结构和光线一致。' },
    'angle:front': { label: '正视角', prompt: '将参考图调整为正面视角，保持主体外观、服装、材质和场景风格一致。' },
    'angle:side': { label: '侧面 45°', prompt: '将参考图调整为侧面 45 度视角，保持主体外观、材质和光线一致。' },
    'angle:top': { label: '俯视角', prompt: '将参考图调整为从上向下的俯视视角，保持主体与场景一致。' },
    'angle:low': { label: '低机位仰视', prompt: '将参考图调整为低机位仰视视角，保持主体与场景一致。' },
    'light:natural': { label: '自然日光', prompt: '将参考图改为柔和自然日光，保持主体、构图和材质一致。' },
    'light:studio': { label: '摄影棚光', prompt: '将参考图改为专业摄影棚布光，轮廓清晰，保持主体和构图一致。' },
    'light:golden': { label: '黄金时刻', prompt: '将参考图改为黄金时刻的温暖侧光，保持主体与场景结构一致。' },
    'light:night': { label: '霓虹夜景', prompt: '将参考图改为霓虹夜景光效，保持主体、构图与场景结构一致。' },
    'more:upscale': { label: '高清修复', prompt: '高清修复参考图，增强细节与清晰度，保持内容、构图和风格不变。' },
    'more:remove-bg': { label: '去除背景', prompt: '移除参考图背景并输出干净的纯色背景，保持主体边缘与细节完整。' },
    'more:consistent': { label: '风格一致化', prompt: '优化参考图的整体风格一致性，保持主体、构图与关键元素不变。' },
  }
  if (group === 'grid') {
    const [rows, columns] = command.split('x').map(Number)
    void splitImageGrid(rows, columns)
    return
  }
  if (group === 'more' && command === 'duplicate') {
    handleDuplicate()
    return
  }
  const preset = presets[`${group}:${command}`]
  if (preset) queueImageVariation(preset.label, preset.prompt)
}

const addImageToAssistant = () => {
  if (!requireImage()) return
  window.dispatchEvent(new CustomEvent('canvasmind:open-workflow-assistant', {
    detail: { nodeId: props.id },
  }))
}

// 顶部悬浮工具栏：结构与参考页一致，AI 变换先创建下游节点并预填提示词，不自动消耗额度。
const topToolbarItems = computed<NodeTopToolbarItem[]>(() => [
  { id: 'panorama', label: '全景图', icon: Aim, hasDropdown: true, menuItems: [
    { id: 'wide', label: '横向全景 2:1' },
    { id: 'vertical', label: '纵向全景 9:16' },
    { id: '360', label: '360° 环景' },
  ], onMenuSelect: command => handleToolbarMenu('panorama', command) },
  { id: 'edit', label: '编辑', icon: EditPen, onClick: openCropDialog },
  { id: 'mood', label: '情绪', icon: PictureFilled, onClick: () => queueImageVariation('情绪调整', '调整参考图的情绪氛围与色彩表达，保持主体、构图和关键元素一致。') },
  { id: 'grid', label: '宫格切分', icon: Crop, hasDropdown: true, disabled: gridSaving.value, menuItems: [
    { id: '2x2', label: '四宫格 2×2' },
    { id: '2x3', label: '六宫格 2×3' },
    { id: '3x3', label: '九宫格 3×3' },
  ], onMenuSelect: command => handleToolbarMenu('grid', command) },
  { id: 'angle', label: '角度', icon: Refresh, hasDropdown: true, menuItems: [
    { id: 'front', label: '正视角' },
    { id: 'side', label: '侧面 45°' },
    { id: 'top', label: '俯视角' },
    { id: 'low', label: '低机位仰视' },
  ], onMenuSelect: command => handleToolbarMenu('angle', command) },
  { id: 'light', label: '打光', icon: Sunny, hasDropdown: true, menuItems: [
    { id: 'natural', label: '自然日光' },
    { id: 'studio', label: '摄影棚光' },
    { id: 'golden', label: '黄金时刻' },
    { id: 'night', label: '霓虹夜景' },
  ], onMenuSelect: command => handleToolbarMenu('light', command) },
  { id: 'more', label: '更多', icon: MoreFilled, hasDropdown: true, menuItems: [
    { id: 'upscale', label: '高清修复' },
    { id: 'remove-bg', label: '去除背景' },
    { id: 'consistent', label: '风格一致化' },
    { id: 'duplicate', label: '复制节点' },
  ], onMenuSelect: command => handleToolbarMenu('more', command) },
  { type: 'divider' },
  { id: 'crop', label: '裁剪', icon: Crop, iconOnly: true, onClick: openCropDialog },
  { id: 'download-mini', label: '下载', icon: Download, iconOnly: true, onClick: handleDownload },
  { id: 'preview', label: '放大预览', icon: ZoomIn, iconOnly: true, onClick: () => imageUrl.value && window.open(imageUrl.value, '_blank') },
  { type: 'divider' },
  { id: 'agent', label: '加入 Agent', textMark: 'R', onClick: addImageToAssistant },
])

// ContentGenerator 发送：用上游图作为参考 + 用户 prompt 调图生图，结果回填到当前节点
const isGenerating = ref(false)
const taskStreamController = ref<AbortController | null>(null)
/** 直接在图片结果节点发起的任务同样可在刷新后续接，不重新消耗生成额度。 */
const resumePendingTask = () => {
  const taskId = String(props.data?.taskRecordId || '').trim()
  const generationMeta = props.data?.generationMeta
  if (!taskId || !props.data?.loading || !generationMeta || isGenerating.value) return
  isGenerating.value = true
  taskStreamController.value?.abort()
  const controller = new AbortController()
  taskStreamController.value = controller
  void subscribeGenerationTaskEvents(taskId, {
    signal: controller.signal,
    onEvent: (event) => {
      if (event.type === 'snapshot' || event.type === 'completed') {
        const urls = Array.isArray(event.record?.images) ? event.record.images.filter(Boolean) : []
        if (urls.length) {
          updateNode(props.id, { url: urls[0], loading: false, error: '', executed: true, taskRecordId: taskId, generationMeta })
        }
      }
      if (event.type === 'failed' || event.type === 'stopped') {
        updateNode(props.id, { loading: false, error: String(event.message || event.record?.error || (event.type === 'stopped' ? '任务已停止' : '图片生成失败')), generationMeta })
      }
      if (event.done) {
        isGenerating.value = false
        if (taskStreamController.value === controller) taskStreamController.value = null
      }
    },
  }).catch((error: unknown) => {
    if (controller.signal.aborted) return
    updateNode(props.id, { loading: false, error: error instanceof Error ? error.message : '订阅图片任务失败', generationMeta })
    isGenerating.value = false
    if (taskStreamController.value === controller) taskStreamController.value = null
  })
}
const handlePromptSend = async (
  message: string,
  _type: string,
  options?: { modelKey?: string; ratio?: string; resolution?: string; count?: number; referenceImages?: string[] },
) => {
  if ((!message?.trim() && !options?.referenceImages?.length) || isGenerating.value) return
  // 优先用 ContentGenerator 自带的参考图选项（用户在生成器内单独添加的）
  // 没有时落到上游连线的图
  const rawRefImages = Array.isArray(options?.referenceImages) && options.referenceImages.length
    ? options.referenceImages
    : upstreamReferenceUrls.value
  // 再做一次栅格过滤，防止用户直接通过 ContentGenerator 上传 SVG/PDF 等
  const refImages = rawRefImages.filter(isRasterReferenceUrl)
  if (rawRefImages.length > refImages.length) {
    ElMessage.warning('已忽略非栅格格式（SVG 等）的参考图，图生图模型不支持')
  }
  isGenerating.value = true
  taskStreamController.value?.abort()
  updateNode(props.id, { loading: true, error: '' })
  try {
    const fallbackKey = String(options?.modelKey || '').trim() || ''
    const { providerId, modelKey } = resolveGenerationTaskModel({
      modelKey: fallbackKey,
      fallbackModelKey: fallbackKey,
      category: 'IMAGE',
      missingModelMessage: '未匹配到有效图片模型，请先在后台配置模型',
    })
    const normalizedPrompt = message?.trim() || '请根据引用素材生成一张新的图片'
    const requestBody: Record<string, unknown> = {
      model: modelKey,
      prompt: normalizedPrompt,
      n: Math.max(1, Math.min(8, Number(options?.count) || 1)),
      providerId,
    }
    if (options?.ratio) requestBody.size = options.ratio
    if (options?.resolution) requestBody.quality = options.resolution
    const hasRef = refImages.length > 0
    const generationMeta = buildWorkflowGenerationMetadata({
      kind: 'image',
      prompt: normalizedPrompt,
      modelKey,
      ratio: options?.ratio,
      resolution: options?.resolution,
      count: options?.count,
      references: refImages.map(url => ({ url, mediaType: 'image', role: 'reference' })),
    })
    const finalBody = hasRef ? appendImageReferencesToRequestBody(requestBody, refImages) : requestBody

    const saved = await createGenerationTask({
      source: 'workflow',
      type: 'image',
      requestMode: hasRef ? 'image-edit' : 'image-generation',
      prompt: normalizedPrompt,
      modelKey,
      ratio: options?.ratio,
      resolution: options?.resolution,
      referenceImages: hasRef ? [...refImages] : [],
      requestBody: finalBody,
    })
    const taskId = String(saved?.id || '').trim()
    if (!taskId) throw new Error('图片任务创建失败')

    const controller = new AbortController()
    taskStreamController.value = controller
    await subscribeGenerationTaskEvents(taskId, {
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === 'snapshot' || event.type === 'completed') {
          const urls = Array.isArray(event.record?.images) ? event.record.images.filter(Boolean) : []
          if (urls.length) {
            updateNode(props.id, { url: urls[0], loading: false, error: '', executed: true, taskRecordId: taskId, generationMeta })
            isGenerating.value = false
          }
        }
        if (event.type === 'failed') {
          updateNode(props.id, { loading: false, error: String(event.message || event.record?.error || '图片生成失败') })
          isGenerating.value = false
        }
        if (event.type === 'stopped') {
          updateNode(props.id, { loading: false, error: '任务已停止' })
          isGenerating.value = false
        }
      },
    })
  } catch (err: unknown) {
    console.error('[ImageNode] generation failed', err)
    const msg = err instanceof Error ? err.message : '图片生成失败'
    updateNode(props.id, { loading: false, error: msg })
    isGenerating.value = false
  }
}

const retryFromGenerationMetadata = () => {
  const metadata = props.data?.generationMeta
  if (!metadata || metadata.kind !== 'image' || isGenerating.value) return
  void handlePromptSend(metadata.prompt, 'image', {
    modelKey: metadata.modelKey || metadata.model,
    ratio: metadata.size || metadata.ratio,
    resolution: metadata.quality || metadata.resolution,
    count: metadata.count,
    referenceImages: metadata.references.filter(reference => reference.mediaType === 'image').map(reference => reference.url),
  })
}

/** 批量结果以指定子图作为下一次图生图参考，复用该组已保存的参数。 */
const retryFromBatchChild = (child: { id: string; url: string }) => {
  const metadata = props.data?.generationMeta
  if (!metadata || metadata.kind !== 'image' || isGenerating.value) return
  selectBatchChild(child)
  void handlePromptSend(metadata.prompt, 'image', {
    modelKey: metadata.modelKey || metadata.model,
    ratio: metadata.size || metadata.ratio,
    resolution: metadata.quality || metadata.resolution,
    count: 1,
    referenceImages: [child.url],
  })
}

type WorkflowImagePromptDetail = {
  nodeId: string
  text: string
  modelKey?: string
  ratio?: string
  resolution?: string
  count?: number
  referenceImages?: string[]
}

const handleWorkflowImagePrompt = (event: Event) => {
  const detail = (event as CustomEvent<WorkflowImagePromptDetail>).detail
  if (!detail || detail.nodeId !== props.id) return
  void handlePromptSend(detail.text, 'image', {
    modelKey: detail.modelKey,
    ratio: detail.ratio,
    resolution: detail.resolution,
    count: detail.count,
    referenceImages: detail.referenceImages,
  })
}

onMounted(() => window.addEventListener('canvasmind:workflow-image-prompt', handleWorkflowImagePrompt))
onUnmounted(() => window.removeEventListener('canvasmind:workflow-image-prompt', handleWorkflowImagePrompt))
</script>

<template>
  <div class="image-node-wrapper" @mouseenter="showActions = true" @mouseleave="showActions = false">
    <CanvasNodeResizer
      :visible="isSelected"
      :min-width="180"
      :min-height="140"
    />
    <!-- 节点外置标题 -->
    <div class="image-node-title" :title="titleEdit.editing.value ? '' : '双击编辑名称'" @dblclick.stop="titleEdit.start">
      <el-icon class="image-node-title-icon"><Picture /></el-icon>
      <input
        v-if="titleEdit.editing.value"
        :ref="titleEdit.setInputRef"
        v-model="titleEdit.draft.value"
        class="image-node-title-input nodrag"
        :maxlength="40"
        @blur="titleEdit.commit"
        @keydown.enter.prevent="titleEdit.commit"
        @keydown.esc.prevent="titleEdit.cancel"
        @mousedown.stop
        @click.stop
      />
      <span v-else>{{ data?.label || 'Image' }}</span>
    </div>

    <!-- 节点本体 -->
    <div class="image-node-card" :class="{ 'is-selected': isSelected }">
      <!-- 选中态流光边框 -->
      <span v-if="isSelected" class="image-node-flow image-node-flow--ring" aria-hidden="true" />
      <span v-if="isSelected" class="image-node-flow image-node-flow--glow" aria-hidden="true" />

      <!-- 空态：尝试菜单 -->
      <div v-if="showEmpty" class="image-node-empty">
        <div class="image-node-empty-title">尝试：</div>
        <div class="image-node-empty-menu">
          <button
            v-for="item in emptyMenuItems"
            :key="item.id"
            type="button"
            class="image-node-empty-item nodrag nopan"
            @click.stop="item.onClick"
          >
            <el-icon class="image-node-empty-item-icon">
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <button class="image-node-upload-pill nodrag nopan" @click.stop="triggerUpload">
          <el-icon><UploadIcon /></el-icon>
          <span>上传图片</span>
        </button>
      </div>

      <!-- ready-state：有上游连线但本节点没有图 -->
      <div v-else-if="showReady" class="image-node-ready">
        <div class="image-node-ready-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
            <path d="M3 15L7 11L10 14L15 9L21 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="image-node-ready-text">已连接参考图片</div>
        <div class="image-node-ready-hint">选中节点后在下方配置并生成</div>
      </div>

      <!-- 加载 -->
      <div v-else-if="showLoading" class="image-node-loading">
        <div class="image-node-spinner" />
        <span>生成中…</span>
      </div>

      <!-- 错误 -->
      <div v-else-if="showError" class="image-node-error" @click.stop="triggerUpload">
        <span>{{ errorMsg }}，点击重新上传</span>
      </div>

      <!-- 有图 -->
      <div
        v-else
        class="image-node-display"
        :class="{ 'is-batch-root': isBatchGroupVisible, 'is-batch-expanded': data?.batchExpanded }"
        @dblclick.stop="toggleBatchExpanded"
      >
        <template v-if="isBatchGroupVisible && !data?.batchExpanded">
          <div class="image-node-batch-frame image-node-batch-frame--2" aria-hidden="true" />
          <div class="image-node-batch-frame image-node-batch-frame--1" aria-hidden="true" />
        </template>
        <img
          :src="imageUrl"
          alt="生成图片"
          class="image-node-image"
          @load="refreshNodeInternals"
          @error="handleImageLoadError"
        />
        <button
          class="image-node-replace-btn nodrag nopan"
          title="替换图片"
          @mousedown.stop
          @click.stop="triggerUpload"
        >
          <span class="image-node-replace-icon" aria-hidden="true">↑</span>
          <span>替换</span>
        </button>
        <span v-if="isBatchGroupVisible" class="image-node-batch-count" :title="`批量组 ${batchChildCount} 张，双击展开/折叠`">
          {{ batchChildCount }}
        </span>
        <div v-if="isBatchGroupVisible && data?.batchExpanded" class="image-node-batch-grid">
          <div
            v-for="child in data?.batchChildren"
            :key="child.id"
            class="image-node-batch-grid__item"
            :class="{ 'is-primary': child.id === data?.primaryImageId }"
            @click.stop
          >
            <img :src="child.url" alt="批量子图" />
            <button
              class="image-node-batch-set-primary"
              title="设为主图"
              @click.stop="selectBatchChild(child)"
            >
              ★
            </button>
            <button
              v-if="data?.generationMeta"
              class="image-node-batch-retry"
              title="以此图作为参考重试"
              @click.stop="retryFromBatchChild(child)"
            >
              重试
            </button>
          </div>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="handleFileChange"
      />
    </div>

    <CanvasNodeAddHandle side="left" :visible="isSelected" />
    <CanvasNodeAddHandle side="right" :visible="isSelected" />

    <CanvasNodeHoverToolbar :visible="showActions" :actions="hoverActions" />

    <!-- 选中态顶部悬浮工具栏（仅有图时显示） -->
    <CanvasNodeTopToolbar :visible="isSelected && showImage" :items="topToolbarItems" />

    <CanvasGenerationInfo
      v-if="isSelected && showImage && data?.generationMeta"
      :metadata="data.generationMeta"
      @retry="retryFromGenerationMetadata"
    />

    <el-dialog
      v-model="cropDialogVisible"
      title="裁剪图片"
      width="560px"
      append-to-body
      class="workflow-image-crop-dialog"
      :close-on-click-modal="!cropSaving"
    >
      <div class="workflow-image-crop">
        <div class="workflow-image-crop__preview" :style="{ aspectRatio: cropAspectValue || undefined }">
          <img
            :src="imageUrl"
            alt="裁剪预览"
            :style="{
              transform: `translate(${(cropX - 50) * -0.7}%, ${(cropY - 50) * -0.7}%) scale(${cropZoom})`,
            }"
          />
        </div>
        <div class="workflow-image-crop__ratios">
          <button v-for="item in cropAspectOptions" :key="item" type="button" :class="{ 'is-active': cropAspect === item }" @click="cropAspect = item">
            {{ item === 'original' ? '原比例' : item.replace('x', ':') }}
          </button>
        </div>
        <label><span>缩放</span><input v-model.number="cropZoom" type="range" min="1" max="3" step="0.05"><b>{{ cropZoom.toFixed(2) }}×</b></label>
        <label><span>水平位置</span><input v-model.number="cropX" type="range" min="0" max="100" step="1"><b>{{ cropX }}%</b></label>
        <label><span>垂直位置</span><input v-model.number="cropY" type="range" min="0" max="100" step="1"><b>{{ cropY }}%</b></label>
      </div>
      <template #footer>
        <el-button :disabled="cropSaving" @click="cropDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="cropSaving" @click="saveCrop">应用裁剪</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.image-node-wrapper {
  /* 保持在正常文档流中，供 Vue Flow 首次测量自定义节点尺寸。 */
  position: relative;
  width: 100%;
  height: 100%;
  /* 未设置固定宽高的新节点也必须提供可测量的初始尺寸。 */
  min-width: 180px;
  min-height: 140px;
  box-sizing: border-box;
}

.image-node-title {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0 8px 0 2px;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  letter-spacing: 0.2px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.image-node-title:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.image-node-title-icon {
  font-size: 16px;
  color: var(--text-tertiary);
}
.image-node-title-input {
  flex: 1 1 0;
  min-width: 80px;
  max-width: 220px;
  background: transparent;
  border: 1px solid var(--brand-main-default);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
  outline: none;
  box-sizing: border-box;
}

:global(.workflow-image-crop-dialog .el-dialog__body) { padding-top: 8px; }
.workflow-image-crop { display: flex; flex-direction: column; gap: 14px; }
.workflow-image-crop__preview {
  width: min(100%, 420px);
  max-height: 320px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 12px;
  background: #111;
  border: 1px solid var(--stroke-secondary);
}
.workflow-image-crop__preview img {
  width: 100%;
  height: 100%;
  min-height: 220px;
  object-fit: cover;
  transform-origin: center;
}
.workflow-image-crop__ratios { display: flex; justify-content: center; gap: 8px; }
.workflow-image-crop__ratios button {
  padding: 5px 10px;
  border: 1px solid var(--stroke-secondary);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.workflow-image-crop__ratios button.is-active {
  border-color: var(--brand-main-default);
  color: var(--brand-main-default);
  background: rgba(2, 219, 163, 0.08);
}
.workflow-image-crop label {
  display: grid;
  grid-template-columns: 76px 1fr 48px;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}
.workflow-image-crop label input { width: 100%; accent-color: var(--brand-main-default); }
.workflow-image-crop label b { color: var(--text-tertiary); font-weight: 500; text-align: right; }

.image-node-card {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--canvas-node-bg);
  /* 即使未选中也保留可见轮廓，避免浅色画布中丢失节点边界。 */
  border: 1px solid color-mix(in srgb, var(--text-tertiary) 52%, transparent);
  border-radius: 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.16s, box-shadow 0.16s, min-width 0.2s ease;
}
/* 有图态：节点变宽，图片居中（参照 RunningHUB 生成结果布局 img_11） */
.image-node-card:has(.image-node-display) {
  width: 100%;
  height: 100%;
}
.image-node-wrapper:has(.image-node-display) {
  min-width: 180px;
  min-height: 140px;
}
.image-node-card.is-selected {
  border-color: var(--canvas-selection-border);
  box-shadow: 0 0 0 2px var(--canvas-selection-border);
}

/* 流光边框 */
.image-node-flow {
  content: '';
  position: absolute;
  pointer-events: none;
  background-size: 200% 200%;
  animation: image-node-flowing 2.4s linear infinite;
}
.image-node-flow--ring {
  inset: -2px;
  border-radius: 18px;
  background: linear-gradient(
    90deg,
    transparent,
    transparent 20%,
    rgba(2, 219, 163, 0.45) 40%,
    #02dba3 50%,
    rgba(2, 219, 163, 0.45) 60%,
    transparent 80%,
    transparent
  );
  z-index: -1;
}
.image-node-flow--glow {
  inset: -6px;
  border-radius: 22px;
  background: linear-gradient(
    90deg,
    transparent,
    transparent 20%,
    rgba(2, 219, 163, 0.18) 40%,
    rgba(2, 219, 163, 0.42) 50%,
    rgba(2, 219, 163, 0.18) 60%,
    transparent 80%,
    transparent
  );
  filter: blur(8px);
  z-index: -2;
}
@keyframes image-node-flowing {
  0% { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}

/* 空态菜单 */
.image-node-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  justify-content: center;
  padding: 20px;
}
.image-node-empty-title {
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 16px;
  margin-left: 10px;
}
.image-node-empty-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.image-node-empty-item {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  border-radius: 16px;
  width: fit-content;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.image-node-empty-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.image-node-empty-item-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.image-node-empty-item:hover .image-node-empty-item-icon {
  color: var(--text-primary);
}
.image-node-upload-pill {
  margin-top: auto;
  margin-left: 10px;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: 16px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.image-node-upload-pill:hover {
  background: var(--canvas-float-block-hover);
  color: var(--brand-main-default);
}

/* ready-state（有上游连线但空图）*/
.image-node-ready {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-tertiary);
  padding: 24px;
}
.image-node-ready-icon {
  color: var(--text-tertiary);
  opacity: 0.6;
}
.image-node-ready-text {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}
.image-node-ready-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* 加载 / 错误 */
.image-node-loading,
.image-node-error {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.image-node-error {
  color: #ef4444;
  cursor: pointer;
}
.image-node-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--stroke-secondary);
  border-top-color: var(--brand-main-default);
  animation: image-node-spin 0.8s linear infinite;
}
@keyframes image-node-spin {
  to { transform: rotate(360deg); }
}

/* 批量组叠卡 / 有图态：图片居中，最大尺寸限制让节点周围有黑色边距（参照 img_11） */
.image-node-display {
  position: relative;
  flex: 1 1 0;
  display: inline-flex;
  justify-content: center;
  align-items: stretch;
  overflow: hidden;
}
.image-node-image {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
  border-radius: 12px;
}
.image-node-batch-frame {
  position: absolute;
  inset: 0;
  background: var(--canvas-bg-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: var(--lv-border-radius-medium);
  pointer-events: none;
}
.image-node-batch-frame--1 {
  transform: translate(-4px, -4px) rotate(-2deg);
  z-index: 0;
  opacity: 0.6;
}
.image-node-batch-frame--2 {
  transform: translate(-8px, -8px) rotate(-4deg);
  z-index: -1;
  opacity: 0.32;
}
.image-node-batch-count {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  padding: 1px 8px;
  background: var(--brand-main-default);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  pointer-events: none;
}
.image-node-batch-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 6px;
  padding: 8px;
  background: var(--canvas-float-block-default);
  border-radius: var(--lv-border-radius-medium);
  overflow-y: auto;
  z-index: 3;
}
.image-node-batch-grid__item {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--canvas-image-loading-start);
  border-radius: var(--lv-border-radius-small);
  overflow: hidden;
  border: 1.5px solid transparent;
  transition: border-color 0.12s;
}
.image-node-batch-grid__item:hover,
.image-node-batch-grid__item.is-primary {
  border-color: var(--brand-main-default);
}
.image-node-batch-grid__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-node-batch-set-primary {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: var(--canvas-float-block-default);
  border: 0.5px solid var(--stroke-secondary);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.image-node-batch-grid__item.is-primary .image-node-batch-set-primary {
  background: var(--brand-main-default);
  color: #fff;
  border-color: var(--brand-main-default);
}
.image-node-batch-retry {
  position: absolute;
  left: 3px;
  bottom: 3px;
  padding: 2px 5px;
  border: 0.5px solid var(--stroke-secondary);
  border-radius: 5px;
  background: rgba(15, 25, 28, .84);
  color: #72e3ca;
  font-size: 10px;
  line-height: 1.15;
  cursor: pointer;
}

/* 替换按钮（有图态右上角） */
.image-node-replace-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--canvas-float-block-default, rgba(30, 30, 30, 0.9));
  border: 1px solid var(--stroke-secondary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}
.image-node-replace-btn:hover {
  background: var(--canvas-float-block-hover, var(--bg-block-primary-hover, rgba(50, 50, 50, 0.95)));
  border-color: var(--brand-main-default);
  color: var(--brand-main-default);
}
.image-node-replace-icon {
  font-size: 14px;
  line-height: 1;
}

/* 左右 Handle 隐藏（用 .image-node-add-btn 替代） */
.image-node-handle {
  width: 1px !important;
  height: 1px !important;
  opacity: 0 !important;
  pointer-events: none !important;
  border: 0 !important;
  background: transparent !important;
}

/* 外置 "+" 按钮 */
.image-node-add-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--text-tertiary);
  cursor: pointer;
  z-index: 10;
  transition: transform 0.2s, color 0.2s;
}
.image-node-add-btn--left { left: -56px; }
.image-node-add-btn--right { right: -56px; }
.image-node-add-btn__icon {
  width: 20px;
  height: 20px;
  padding: 3px;
  border: 1px solid currentColor;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
}
.image-node-add-btn:hover { color: var(--text-primary); }
.image-node-add-btn:active { transform: translateY(-50%) scale(0.95); }

/* 节点下方浮出 prompt */
.image-node-prompt-panel {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  min-width: 540px;
  max-width: 760px;
  z-index: 5;
}
</style>
