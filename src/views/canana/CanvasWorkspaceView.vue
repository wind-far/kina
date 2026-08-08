<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CANVAS_STORAGE_VERSION,
  clampCanvasScale,
  createCanvasStorageKey,
  normalizeCanvasTitle,
  resolveCanvasReturnTo,
} from './canvas-reference-state'
import './canvas-workspace.css'

type NodeType = 'image' | 'artboard' | 'text'
type UploadPurpose = 'canvas' | 'agent'
type ConfirmAction = 'clear' | 'restore' | null

interface CropState {
  scale: number
  offsetX: number
  offsetY: number
}

interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  w: number
  h: number
  label: string
  text?: string
  src?: string
  crop?: CropState
  background?: string
}

interface ChatAttachment {
  id: string
  name: string
  src: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'local-agent'
  text: string
  attachments: ChatAttachment[]
  createdAt: number
}

interface DragState {
  kind: 'canvas' | 'node'
  nodeId?: string
  startX: number
  startY: number
  originX: number
  originY: number
}

const SMALL_SCREEN = 1100
const DEFAULT_VIEW = { x: 0, y: 0, scale: 0.1 }
const POSTER_URL = '/local-canvas-assets/ai-editorial-poster.webp'
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_IMPORTED_NODES = 120
const MAX_IMPORTED_MESSAGES = 200
const MAX_IMPORTED_ATTACHMENTS = 12
const MAX_TEXT_LENGTH = 10_000

const route = useRoute()
const router = useRouter()

const viewportRef = ref<HTMLElement | null>(null)
const worldRef = ref<HTMLElement | null>(null)
const selectionRef = ref<HTMLElement | null>(null)
const composerRef = ref<HTMLFormElement | null>(null)
const composerInputRef = ref<HTMLInputElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const panelInputRef = ref<HTMLTextAreaElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const projectInputRef = ref<HTMLInputElement | null>(null)
const projectMenuRef = ref<HTMLElement | null>(null)

const title = ref('生成二次元手办多风格…')
const editingTitle = ref(false)
const saveState = ref('已保存')
const prompt = ref('')
const panelPrompt = ref('')
const composerActive = ref(false)
const toast = ref('')
const isCompact = ref(false)
const spacePanning = ref(false)
const agentOpen = ref(false)
const inspirationOn = ref(false)
const creativeOn = ref(false)
const agentMode = ref('Agent 模式')
const generationType = ref('自动')
const darkMode = ref(false)
const zoomLabel = ref(10)
const activeTool = ref<'select' | 'crop'>('select')
const selectedNodeId = ref<string | null>(null)
const hoveredNodeId = ref<string | null>(null)
const editingTextId = ref<string | null>(null)
const textDraft = ref('')
const cropDraft = ref<(CropState & { nodeId: string }) | null>(null)
const failedImageIds = ref<Set<string>>(new Set())
const messages = ref<ChatMessage[]>([])
const agentAttachments = ref<ChatAttachment[]>([])
const projectMenuOpen = ref(false)
const helpOpen = ref(false)
const infoDialog = ref<{ title: string; body: string } | null>(null)
const confirmAction = ref<ConfirmAction>(null)

const view = reactive({ ...DEFAULT_VIEW })
const nodes = ref<CanvasNode[]>(createDefaultNodes())
let dragState: DragState | null = null
let uploadPurpose: UploadPurpose = 'canvas'
let queuedFrame = 0
let toastTimer = 0
let saveTimer = 0
let previousCompact = false
let restoring = false
let faviconElement: HTMLLinkElement | null = null
let previousFaviconHref = ''

const storageKey = computed(() => createCanvasStorageKey(route.query.projectId))
const drawerVisible = computed(() => agentOpen.value)
const sendReady = computed(() => Boolean(prompt.value.trim()))
const panelSendReady = computed(() => Boolean(panelPrompt.value.trim() || agentAttachments.value.length))
const selectedNode = computed(() => nodes.value.find(node => node.id === selectedNodeId.value) || null)
const frameNode = computed(() => selectedNode.value || nodes.value.find(node => node.id === hoveredNodeId.value) || null)
const selectionVisible = computed(() => Boolean(frameNode.value))
const chatTitle = computed(() => {
  const firstUserMessage = messages.value.find(message => message.role === 'user')?.text.trim()
  return firstUserMessage ? firstUserMessage.slice(0, 12) : '未命名对话'
})

function uid(prefix: string) {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`
}

function boundedText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : fallback
}

function finiteNumber(value: unknown, fallback: number, min = -50_000, max = 50_000) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function isSafeLocalImageSrc(value: unknown): value is string {
  return typeof value === 'string'
    && (value === POSTER_URL || /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value))
}

function normalizeCrop(value: unknown): CropState {
  const crop = value && typeof value === 'object' ? value as Partial<CropState> : {}
  return {
    scale: finiteNumber(crop.scale, 1, 1, 3),
    offsetX: finiteNumber(crop.offsetX, 0, -50, 50),
    offsetY: finiteNumber(crop.offsetY, 0, -50, 50),
  }
}

function normalizeNode(value: unknown): CanvasNode | null {
  if (!value || typeof value !== 'object') return null
  const node = value as Partial<CanvasNode>
  const type = node.type
  if ((type !== 'image' && type !== 'artboard' && type !== 'text') || typeof node.id !== 'string' || !node.id.trim()) return null
  const geometry = {
    x: finiteNumber(node.x, 0),
    y: finiteNumber(node.y, 0),
    w: finiteNumber(node.w, 1, 1, 40_000),
    h: finiteNumber(node.h, 1, 1, 40_000),
  }
  const label = boundedText(node.label, type === 'text' ? '文字' : type === 'artboard' ? '画板' : '本地图片')

  if (type === 'image') {
    if (!isSafeLocalImageSrc(node.src)) return null
    return { id: node.id, type, ...geometry, label, src: node.src, crop: normalizeCrop(node.crop) }
  }
  if (type === 'artboard') {
    const background = typeof node.background === 'string' && /^#[0-9a-f]{3,8}$/i.test(node.background)
      ? node.background
      : '#ffffff'
    return { id: node.id, type, ...geometry, label, background }
  }
  return { id: node.id, type, ...geometry, label, text: boundedText(node.text, '文字') || '文字' }
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.slice(0, MAX_IMPORTED_ATTACHMENTS).flatMap((item): ChatAttachment[] => {
    if (!item || typeof item !== 'object') return []
    const attachment = item as Partial<ChatAttachment>
    if (typeof attachment.id !== 'string' || !attachment.id || ids.has(attachment.id) || !isSafeLocalImageSrc(attachment.src)) return []
    ids.add(attachment.id)
    return [{ id: attachment.id, name: boundedText(attachment.name, '本地参考图'), src: attachment.src }]
  })
}

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.slice(0, MAX_IMPORTED_MESSAGES).flatMap((item): ChatMessage[] => {
    if (!item || typeof item !== 'object') return []
    const message = item as Partial<ChatMessage>
    if (typeof message.id !== 'string' || !message.id || ids.has(message.id)) return []
    if (message.role !== 'user' && message.role !== 'local-agent') return []
    const text = boundedText(message.text)
    if (!text) return []
    ids.add(message.id)
    return [{
      id: message.id,
      role: message.role,
      text,
      attachments: normalizeAttachments(message.attachments),
      createdAt: finiteNumber(message.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    }]
  })
}

function createDefaultNodes(): CanvasNode[] {
  return [{
    id: 'local-poster',
    type: 'image',
    x: 4340,
    y: 1820,
    w: 3700,
    h: 2081,
    label: '参考图',
    src: POSTER_URL,
    crop: { scale: 1, offsetX: 0, offsetY: 0 },
  }]
}

function getNode(id: string | null | undefined) {
  return id ? nodes.value.find(node => node.id === id) || null : null
}

function getNodeStyle(node: CanvasNode) {
  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.w}px`,
    height: `${node.h}px`,
    zIndex: node.type === 'artboard' ? 1 : 2,
  }
}

function getImageTransform(node: CanvasNode) {
  const preview = cropDraft.value?.nodeId === node.id ? cropDraft.value : node.crop
  const crop = preview || { scale: 1, offsetX: 0, offsetY: 0 }
  return {
    transform: `translate3d(${crop.offsetX}%, ${crop.offsetY}%, 0) scale(${crop.scale})`,
  }
}

function markImageFailed(nodeId: string) {
  failedImageIds.value = new Set([...failedImageIds.value, nodeId])
}

function updateSelectionFrame() {
  const frame = selectionRef.value
  const node = frameNode.value
  if (!frame || !node) return
  frame.style.transform = `translate3d(${view.x + node.x * view.scale}px, ${view.y + node.y * view.scale}px, 0)`
  frame.style.width = `${node.w * view.scale}px`
  frame.style.height = `${node.h * view.scale}px`
}

function updateWorld() {
  if (queuedFrame) return
  queuedFrame = requestAnimationFrame(() => {
    queuedFrame = 0
    if (worldRef.value) {
      worldRef.value.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`
    }
    updateSelectionFrame()
    zoomLabel.value = Math.round(view.scale * 100)
  })
}

function snapshot() {
  return {
    version: CANVAS_STORAGE_VERSION,
    title: title.value,
    prompt: prompt.value,
    panelPrompt: panelPrompt.value,
    inspirationOn: inspirationOn.value,
    creativeOn: creativeOn.value,
    agentMode: agentMode.value,
    generationType: generationType.value,
    darkMode: darkMode.value,
    view: { ...view },
    nodes: nodes.value,
    messages: messages.value,
    agentAttachments: agentAttachments.value,
  }
}

function persistLocalState() {
  if (restoring) return
  try {
    window.localStorage.setItem(storageKey.value, JSON.stringify(snapshot()))
    saveState.value = '已保存'
  } catch {
    saveState.value = '仅本次会话'
    showToast('本地存储空间不足，当前内容仅保留在本次会话')
  }
}

function schedulePersist() {
  if (restoring) return
  saveState.value = '保存中…'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(persistLocalState, 140)
}

function applySnapshot(saved: Record<string, unknown>) {
  restoring = true
  title.value = typeof saved.title === 'string' ? normalizeCanvasTitle(saved.title) : '未命名项目'
  prompt.value = typeof saved.prompt === 'string' ? saved.prompt : ''
  panelPrompt.value = typeof saved.panelPrompt === 'string' ? saved.panelPrompt : ''
  inspirationOn.value = Boolean(saved.inspirationOn)
  creativeOn.value = Boolean(saved.creativeOn)
  agentMode.value = saved.agentMode === '仅记录' ? '仅记录' : 'Agent 模式'
  generationType.value = ['自动', '图像', '视频'].includes(String(saved.generationType)) ? String(saved.generationType) : '自动'
  darkMode.value = Boolean(saved.darkMode)
  view.scale = clampCanvasScale((saved.view as Record<string, unknown> | undefined)?.scale, DEFAULT_VIEW.scale)
  view.x = Number.isFinite(Number((saved.view as Record<string, unknown> | undefined)?.x)) ? Number((saved.view as Record<string, unknown>).x) : 0
  view.y = Number.isFinite(Number((saved.view as Record<string, unknown> | undefined)?.y)) ? Number((saved.view as Record<string, unknown>).y) : 0
  const importedIds = new Set<string>()
  nodes.value = Array.isArray(saved.nodes)
    ? saved.nodes.slice(0, MAX_IMPORTED_NODES).flatMap((node): CanvasNode[] => {
      const normalized = normalizeNode(node)
      if (!normalized || importedIds.has(normalized.id)) return []
      importedIds.add(normalized.id)
      return [normalized]
    })
    : createDefaultNodes()
  messages.value = normalizeMessages(saved.messages)
  agentAttachments.value = normalizeAttachments(saved.agentAttachments)
  restoring = false
}

function restoreLocalState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey.value) || 'null')
    if (!saved || saved.version !== CANVAS_STORAGE_VERSION) return false
    applySnapshot(saved)
    return true
  } catch {
    return false
  }
}

function resetReferenceState() {
  restoring = true
  title.value = '生成二次元手办多风格…'
  prompt.value = ''
  panelPrompt.value = ''
  inspirationOn.value = false
  creativeOn.value = false
  agentMode.value = 'Agent 模式'
  generationType.value = '自动'
  darkMode.value = false
  nodes.value = createDefaultNodes()
  messages.value = []
  agentAttachments.value = []
  selectedNodeId.value = null
  hoveredNodeId.value = null
  cropDraft.value = null
  agentOpen.value = false
  Object.assign(view, DEFAULT_VIEW)
  restoring = false
}

function initializeBreakpoint(restored: boolean) {
  const compact = window.innerWidth < SMALL_SCREEN
  isCompact.value = compact
  previousCompact = compact
  if (!restored) view.x = compact ? -205 : 0
}

function checkBreakpoint() {
  const nextCompact = window.innerWidth < SMALL_SCREEN
  isCompact.value = nextCompact
  if (nextCompact !== previousCompact) {
    view.x = nextCompact ? -205 : 0
    previousCompact = nextCompact
    agentOpen.value = false
    updateWorld()
    schedulePersist()
  }
}

function setZoom(next: number, anchor?: { x: number; y: number }) {
  const rect = viewportRef.value?.getBoundingClientRect()
  const scale = clampCanvasScale(next, view.scale)
  if (rect && anchor) {
    const localX = anchor.x - rect.left
    const localY = anchor.y - rect.top
    const worldX = (localX - view.x) / view.scale
    const worldY = (localY - view.y) / view.scale
    view.x = localX - worldX * scale
    view.y = localY - worldY * scale
  }
  view.scale = scale
  updateWorld()
  schedulePersist()
}

function stepZoom(delta: number) {
  const rect = viewportRef.value?.getBoundingClientRect()
  const anchor = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined
  setZoom(view.scale + delta / 100, anchor)
}

function resetView() {
  view.scale = DEFAULT_VIEW.scale
  view.x = isCompact.value ? -205 : 0
  view.y = 0
  updateWorld()
  schedulePersist()
  projectMenuOpen.value = false
  showToast('视图已恢复为 10%')
}

function onWheel(event: WheelEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  event.preventDefault()
  setZoom(view.scale * (event.deltaY < 0 ? 1.12 : 0.89), { x: event.clientX, y: event.clientY })
}

function getVisibleWorldCenter(width: number, height: number) {
  const rect = viewportRef.value?.getBoundingClientRect()
  const screenWidth = rect?.width || window.innerWidth
  const screenHeight = rect?.height || window.innerHeight
  return {
    x: (screenWidth / 2 - view.x) / view.scale - width / 2,
    y: (screenHeight / 2 - view.y) / view.scale - height / 2,
  }
}

function bringNodeToFront(nodeId: string) {
  const index = nodes.value.findIndex(node => node.id === nodeId)
  if (index < 0 || index === nodes.value.length - 1) return
  const [node] = nodes.value.splice(index, 1)
  if (node) nodes.value.push(node)
}

function selectNode(nodeId: string | null) {
  selectedNodeId.value = nodeId
  activeTool.value = 'select'
  updateWorld()
}

function onPointerDown(event: PointerEvent, node?: CanvasNode) {
  if (event.button !== 0) return
  const target = event.target as HTMLElement
  if (target.closest('button,input,textarea,select,[contenteditable="true"]')) return

  const shouldPan = spacePanning.value || !node
  if (shouldPan) {
    selectedNodeId.value = null
    cropDraft.value = null
    dragState = { kind: 'canvas', startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y }
  } else {
    event.stopPropagation()
    if (activeTool.value === 'crop' && node.type === 'image') {
      startCrop(node)
      return
    }
    selectNode(node.id)
    bringNodeToFront(node.id)
    dragState = { kind: 'node', nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y }
  }
  viewportRef.value?.setPointerCapture(event.pointerId)
  updateWorld()
}

function onPointerMove(event: PointerEvent) {
  if (!dragState) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (dragState.kind === 'canvas') {
    view.x = dragState.originX + dx
    view.y = dragState.originY + dy
  } else {
    const node = getNode(dragState.nodeId)
    if (!node) return
    node.x = dragState.originX + dx / view.scale
    node.y = dragState.originY + dy / view.scale
  }
  updateWorld()
}

function stopPointer(event: PointerEvent) {
  if (!dragState) return
  dragState = null
  if (viewportRef.value?.hasPointerCapture(event.pointerId)) viewportRef.value.releasePointerCapture(event.pointerId)
  schedulePersist()
}

function addArtboard() {
  const index = nodes.value.filter(node => node.type === 'artboard').length + 1
  const size = { w: 3200, h: 1800 }
  const position = getVisibleWorldCenter(size.w, size.h)
  const node: CanvasNode = {
    id: uid('artboard'), type: 'artboard', x: position.x, y: position.y, w: size.w, h: size.h,
    label: `画板 ${index}`, background: '#ffffff',
  }
  nodes.value.unshift(node)
  selectNode(node.id)
  schedulePersist()
  showToast(`已新建${node.label}`)
}

function addTextNode() {
  const size = { w: 2200, h: 520 }
  const position = getVisibleWorldCenter(size.w, size.h)
  const node: CanvasNode = {
    id: uid('text'), type: 'text', x: position.x, y: position.y, w: size.w, h: size.h,
    label: '文字', text: '双击编辑文字',
  }
  nodes.value.push(node)
  selectNode(node.id)
  startTextEditing(node)
  schedulePersist()
}

function startTextEditing(node: CanvasNode) {
  if (node.type !== 'text') return
  editingTextId.value = node.id
  textDraft.value = node.text || ''
  nextTick(() => {
    const editor = document.querySelector(`[data-text-editor="${node.id}"]`) as HTMLTextAreaElement | null
    editor?.focus()
    editor?.select()
  })
}

function finishTextEditing(node: CanvasNode) {
  node.text = textDraft.value.trim() || '文字'
  editingTextId.value = null
  schedulePersist()
}

function deleteSelectedNode() {
  if (!selectedNodeId.value) return
  const index = nodes.value.findIndex(node => node.id === selectedNodeId.value)
  if (index < 0) return
  nodes.value.splice(index, 1)
  selectedNodeId.value = null
  cropDraft.value = null
  schedulePersist()
  updateWorld()
  showToast('元素已删除')
}

function duplicateSelectedNode() {
  const node = selectedNode.value
  if (!node) return
  const copy: CanvasNode = {
    ...node,
    id: uid(node.type),
    x: node.x + 180,
    y: node.y + 180,
    label: `${node.label} 副本`,
    crop: node.crop ? { ...node.crop } : undefined,
  }
  nodes.value.push(copy)
  selectNode(copy.id)
  schedulePersist()
  showToast('已创建副本')
}

function startCrop(node = selectedNode.value) {
  if (!node || node.type !== 'image') {
    showToast('请先选择一张图片')
    return
  }
  selectedNodeId.value = node.id
  activeTool.value = 'crop'
  const crop = node.crop || { scale: 1, offsetX: 0, offsetY: 0 }
  cropDraft.value = { nodeId: node.id, ...crop }
  updateWorld()
}

function applyCrop() {
  const draft = cropDraft.value
  const node = getNode(draft?.nodeId)
  if (!draft || !node) return
  node.crop = { scale: draft.scale, offsetX: draft.offsetX, offsetY: draft.offsetY }
  cropDraft.value = null
  activeTool.value = 'select'
  schedulePersist()
  showToast('裁剪效果已应用')
}

function cancelCrop() {
  cropDraft.value = null
  activeTool.value = 'select'
  updateWorld()
}

function requestImageUpload(purpose: UploadPurpose) {
  uploadPurpose = purpose
  imageInputRef.value?.click()
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function compressImage(file: File) {
  const fallback = async () => ({ src: await readFileAsDataUrl(file), width: 1600, height: 900 })
  let objectUrl: string | null = null
  try {
    objectUrl = URL.createObjectURL(file)
    const image = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('图片解码失败'))
    })
    image.src = objectUrl
    await loaded
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建图片画布')
    context.drawImage(image, 0, 0, width, height)
    return { src: canvas.toDataURL('image/webp', 0.86), width, height }
  } catch {
    return fallback()
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件')
    return
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    showToast('单张图片不能超过 12MB')
    return
  }

  showToast('正在处理本地图片…')
  const result = await compressImage(file)
  if (uploadPurpose === 'agent') {
    agentAttachments.value.push({ id: uid('attachment'), name: file.name, src: result.src })
    agentOpen.value = true
    panelInputRef.value?.focus()
    schedulePersist()
    showToast('参考图已附加到本地对话')
    return
  }

  const worldWidth = 2800
  const worldHeight = Math.max(900, Math.round(worldWidth * result.height / result.width))
  const position = getVisibleWorldCenter(worldWidth, worldHeight)
  const node: CanvasNode = {
    id: uid('image'), type: 'image', x: position.x, y: position.y, w: worldWidth, h: worldHeight,
    label: file.name.replace(/\.[^.]+$/, '') || '本地图片', src: result.src,
    crop: { scale: 1, offsetX: 0, offsetY: 0 },
  }
  nodes.value.push(node)
  selectNode(node.id)
  schedulePersist()
  showToast('图片已添加到画布')
}

function removeAttachment(id: string) {
  agentAttachments.value = agentAttachments.value.filter(item => item.id !== id)
  schedulePersist()
}

function appendMessage(text: string, attachments: ChatAttachment[] = []) {
  messages.value.push({ id: uid('message'), role: 'user', text, attachments: attachments.map(item => ({ ...item })), createdAt: Date.now() })
  messages.value.push({
    id: uid('message'), role: 'local-agent',
    text: agentMode.value === '仅记录'
      ? '内容已保存到本地项目。'
      : '已记录你的想法。当前为本地参考模式，未连接 AI 生成服务。',
    attachments: [], createdAt: Date.now() + 1,
  })
  agentOpen.value = true
  nextTick(scrollChatToBottom)
  schedulePersist()
}

function submitCanvasPrompt() {
  const text = prompt.value.trim()
  if (!text) return
  appendMessage(text)
  prompt.value = ''
  composerActive.value = false
  composerInputRef.value?.blur()
  showToast('想法已加入本地对话')
}

function submitPanelPrompt() {
  const text = panelPrompt.value.trim()
  if (!text && !agentAttachments.value.length) return
  appendMessage(text || '请参考这张图片', agentAttachments.value)
  panelPrompt.value = ''
  agentAttachments.value = []
  nextTick(() => panelInputRef.value?.focus())
}

function scrollChatToBottom() {
  const list = document.querySelector('.canvas-workspace__messages')
  list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
}

function activateComposer() {
  if (composerActive.value) return
  composerActive.value = true
  requestAnimationFrame(() => composerInputRef.value?.focus())
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    composerActive.value = false
    composerInputRef.value?.blur()
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitCanvasPrompt()
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') agentOpen.value = false
  else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submitPanelPrompt()
  }
}

function showToast(message: string) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 1900)
}

function toggleAgent() {
  agentOpen.value = !agentOpen.value
  if (agentOpen.value) nextTick(scrollChatToBottom)
}

function openEditor() {
  editingTitle.value = true
  nextTick(() => titleInputRef.value?.focus())
}

function finishEditor() {
  title.value = normalizeCanvasTitle(title.value)
  editingTitle.value = false
  persistLocalState()
}

async function copyShareLink() {
  const link = window.location.href
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = link
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  showToast('本地项目链接已复制')
}

function exportProject() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${normalizeCanvasTitle(title.value)}.canvas.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  projectMenuOpen.value = false
  showToast('项目文件已导出')
}

function requestProjectImport() {
  projectMenuOpen.value = false
  projectInputRef.value?.click()
}

async function importProject(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const payload = JSON.parse(await file.text())
    if (!payload || payload.version !== CANVAS_STORAGE_VERSION || !Array.isArray(payload.nodes)) throw new Error('invalid')
    applySnapshot(payload)
    selectedNodeId.value = null
    cropDraft.value = null
    persistLocalState()
    updateWorld()
    showToast('项目文件已导入')
  } catch {
    showToast('项目文件格式不正确')
  }
}

function requestConfirm(action: Exclude<ConfirmAction, null>) {
  confirmAction.value = action
  projectMenuOpen.value = false
}

function runConfirmedAction() {
  const action = confirmAction.value
  confirmAction.value = null
  if (action === 'clear') {
    nodes.value = []
    selectedNodeId.value = null
    cropDraft.value = null
    schedulePersist()
    showToast('画布已清空')
  } else if (action === 'restore') {
    resetReferenceState()
    initializeBreakpoint(false)
    persistLocalState()
    updateWorld()
    showToast('示例项目已恢复')
  }
}

function showInfo(titleText: string, body: string) {
  infoDialog.value = { title: titleText, body }
}

function handleBack() {
  const returnTo = resolveCanvasReturnTo(route.query.returnTo, route.path)
  if (returnTo) void router.push(returnTo)
  else if (window.history.state?.back) router.back()
  else void router.push('/')
}

function useLocalFavicon() {
  faviconElement = document.querySelector('link[rel="icon"]')
  if (!faviconElement) {
    faviconElement = document.createElement('link')
    faviconElement.rel = 'icon'
    document.head.appendChild(faviconElement)
  }
  previousFaviconHref = faviconElement.getAttribute('href') || ''
  faviconElement.href = '/vite.svg'
}

function restoreFavicon() {
  if (faviconElement && previousFaviconHref) faviconElement.href = previousFaviconHref
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (!composerRef.value?.contains(target) && !prompt.value.trim()) composerActive.value = false
  if (projectMenuOpen.value && !projectMenuRef.value?.contains(target)) projectMenuOpen.value = false
}

function nudgeSelectedNode(event: KeyboardEvent) {
  const node = selectedNode.value
  if (!node) return
  const screenStep = event.shiftKey ? 10 : 1
  const worldStep = screenStep / view.scale
  if (event.key === 'ArrowLeft') node.x -= worldStep
  if (event.key === 'ArrowRight') node.x += worldStep
  if (event.key === 'ArrowUp') node.y -= worldStep
  if (event.key === 'ArrowDown') node.y += worldStep
  updateWorld()
  schedulePersist()
}

function onGlobalKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const editable = target?.matches('input, textarea, select, [contenteditable="true"]')
  if (editable) return

  const interactive = target?.closest('button, a, [role="button"], [role="menuitem"]')
  if (interactive && event.key !== 'Escape') return

  const modifier = event.ctrlKey || event.metaKey
  if (event.code === 'Space') {
    event.preventDefault()
    spacePanning.value = true
    return
  }
  if (modifier && event.key === '0') {
    event.preventDefault()
    resetView()
    return
  }
  if (modifier && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    duplicateSelectedNode()
    return
  }
  if (modifier) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteSelectedNode()
    return
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault()
    nudgeSelectedNode(event)
    return
  }
  if (event.key.toLowerCase() === 't') addTextNode()
  if (event.key.toLowerCase() === 'a') addArtboard()
  if (event.key === '?') helpOpen.value = true
  if (event.key === 'Escape') {
    if (helpOpen.value) helpOpen.value = false
    else if (infoDialog.value) infoDialog.value = null
    else if (confirmAction.value) confirmAction.value = null
    else if (cropDraft.value) cancelCrop()
    else if (projectMenuOpen.value) projectMenuOpen.value = false
    else if (selectedNodeId.value) selectedNodeId.value = null
    else agentOpen.value = false
    updateWorld()
  }
}

function onGlobalKeyup(event: KeyboardEvent) {
  if (event.code === 'Space') spacePanning.value = false
}

function releaseSpacePan() {
  spacePanning.value = false
}

watch(
  [title, prompt, panelPrompt, inspirationOn, creativeOn, agentMode, generationType, darkMode, nodes, messages, agentAttachments],
  schedulePersist,
  { deep: true },
)
watch([selectedNodeId, hoveredNodeId], updateWorld)
watch(storageKey, () => {
  resetReferenceState()
  const restored = restoreLocalState()
  initializeBreakpoint(restored)
  nextTick(updateWorld)
})

onMounted(() => {
  useLocalFavicon()
  const restored = restoreLocalState()
  initializeBreakpoint(restored)
  window.addEventListener('resize', checkBreakpoint)
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('keyup', onGlobalKeyup)
  window.addEventListener('blur', releaseSpacePan)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  updateWorld()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkBreakpoint)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('keyup', onGlobalKeyup)
  window.removeEventListener('blur', releaseSpacePan)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  restoreFavicon()
  window.clearTimeout(toastTimer)
  window.clearTimeout(saveTimer)
  if (queuedFrame) cancelAnimationFrame(queuedFrame)
})
</script>

<template>
  <div class="canvas-workspace" :class="{ 'is-drawer-open': drawerVisible, 'is-dark': darkMode }">
    <header class="canvas-workspace__header">
      <div class="canvas-workspace__header-left">
        <button type="button" class="cw-icon-button is-plain" aria-label="返回" data-tooltip="返回上一页" data-tooltip-position="bottom" @click="handleBack">
          <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" class="canvas-workspace__project" data-tooltip="点击编辑项目名称" data-tooltip-position="bottom" @click="openEditor">
          <input v-if="editingTitle" ref="titleInputRef" v-model="title" aria-label="项目名称" @blur="finishEditor" @keyup.enter="finishEditor">
          <template v-else><span>{{ title }}</span><small>{{ saveState }}</small></template>
        </button>
        <div ref="projectMenuRef" class="canvas-workspace__menu-anchor">
          <button type="button" class="cw-icon-button is-plain" aria-label="项目菜单" data-tooltip="项目操作" data-tooltip-position="bottom" :aria-expanded="projectMenuOpen" @click="projectMenuOpen = !projectMenuOpen">
            <svg viewBox="0 0 24 24"><path d="M6 8h12M6 16h12" /></svg>
          </button>
          <div v-if="projectMenuOpen" class="canvas-workspace__project-menu" role="menu">
            <button type="button" role="menuitem" @click="resetView">恢复 10% 视图 <kbd>⌘0</kbd></button>
            <button type="button" role="menuitem" @click="exportProject">导出本地项目</button>
            <button type="button" role="menuitem" @click="requestProjectImport">导入本地项目</button>
            <span />
            <button type="button" role="menuitem" @click="requestConfirm('clear')">清空画布</button>
            <button type="button" role="menuitem" class="is-danger" @click="requestConfirm('restore')">恢复初始示例</button>
          </div>
        </div>
      </div>
      <div class="canvas-workspace__header-right">
        <button type="button" class="canvas-workspace__points" data-tooltip="本地积分说明" data-tooltip-position="bottom" @click="showInfo('本地积分展示', '积分和会员属于线上能力，本地参考画布不会伪造账户数据或支付流程。')">
          <svg viewBox="0 0 24 24"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /></svg><span>9</span>
        </button>
        <button type="button" class="canvas-workspace__member" data-tooltip="会员能力说明" data-tooltip-position="bottom" @click="showInfo('会员中心未连接', '这是本地交互参考页，不包含账号、会员订阅或支付能力。')">会员中心</button>
        <button type="button" class="cw-icon-button is-plain" aria-label="分享" data-tooltip="复制本地项目链接" data-tooltip-position="bottom" @click="copyShareLink">
          <svg viewBox="0 0 24 24"><path d="m12 16 4-4-4-4M16 12H5m13-6h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" /></svg>
        </button>
        <button type="button" class="canvas-workspace__dialog-button" data-tooltip="打开本地对话" data-tooltip-position="bottom" :aria-expanded="drawerVisible" aria-controls="canvas-agent-drawer" @click="toggleAgent">
          <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H6l-3 2v-9a8 8 0 1 1 18-1Z" /></svg><span>对话</span>
        </button>
      </div>
    </header>

    <main
      ref="viewportRef"
      class="canvas-workspace__viewport"
      :class="{ 'is-space-panning': spacePanning }"
      @wheel="onWheel"
      @pointerdown.self="onPointerDown($event)"
      @pointermove="onPointerMove"
      @pointerup="stopPointer"
      @pointercancel="stopPointer"
    >
      <div ref="worldRef" class="canvas-workspace__world">
        <article
          v-for="node in nodes"
          :key="node.id"
          class="canvas-workspace__node"
          :class="[`is-${node.type}`, { 'is-selected': selectedNodeId === node.id }]"
          :style="getNodeStyle(node)"
          @pointerdown="onPointerDown($event, node)"
          @mouseenter="hoveredNodeId = node.id"
          @mouseleave="hoveredNodeId = null"
          @dblclick.stop="node.type === 'text' && startTextEditing(node)"
        >
          <span v-if="node.type === 'artboard'" class="canvas-workspace__node-label">{{ node.label }}</span>
          <div class="canvas-workspace__node-content" :style="node.type === 'artboard' ? { background: node.background } : undefined">
            <template v-if="node.type === 'image'">
              <img v-if="node.src && !failedImageIds.has(node.id)" :src="node.src" :alt="node.label" :style="getImageTransform(node)" @error="markImageFailed(node.id)">
              <div v-else class="canvas-workspace__image-fallback"><strong>本地图片不可用</strong><span>{{ node.label }}</span></div>
            </template>
            <template v-else-if="node.type === 'text'">
              <textarea
                v-if="editingTextId === node.id"
                v-model="textDraft"
                :data-text-editor="node.id"
                aria-label="编辑画布文字"
                @blur="finishTextEditing(node)"
                @keydown.esc.prevent="editingTextId = null"
                @keydown.meta.enter.prevent="finishTextEditing(node)"
                @keydown.ctrl.enter.prevent="finishTextEditing(node)"
              />
              <p v-else>{{ node.text }}</p>
            </template>
          </div>
        </article>
      </div>

      <div v-show="selectionVisible" ref="selectionRef" class="canvas-workspace__selection-frame" :class="{ 'is-cropping': cropDraft }">
        <div v-if="selectedNode && !cropDraft" class="canvas-workspace__selection-actions">
          <button type="button" title="创建副本" @click.stop="duplicateSelectedNode">复制</button>
          <button v-if="selectedNode.type === 'image'" type="button" title="裁剪图片" @click.stop="startCrop()">裁剪</button>
          <button type="button" class="is-danger" title="删除元素" @click.stop="deleteSelectedNode">删除</button>
        </div>
      </div>

      <aside class="canvas-workspace__tools" aria-label="画布工具">
        <button type="button" class="canvas-workspace__tool" :class="{ 'is-active': activeTool === 'select' }" aria-label="选择工具" data-tooltip="选择 / 移动（V）" data-tooltip-position="right" @click="activeTool = 'select'; cancelCrop()">
          <svg viewBox="0 0 24 24"><path d="m5 3 14 8-6.3 2.1L10.6 19 5 3Z" /><path d="m13 13 4 5" /></svg>
        </button>
        <button type="button" class="canvas-workspace__tool" aria-label="上传" data-tooltip="添加本地图片" data-tooltip-position="right" @click="requestImageUpload('canvas')">
          <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" /></svg>
        </button>
        <button type="button" class="canvas-workspace__tool" aria-label="新建画板" data-tooltip="新建画板（A）" data-tooltip-position="right" @click="addArtboard">
          <svg viewBox="0 0 24 24"><rect x="4" y="5" width="12" height="12" rx="2" /><path d="M12 12h8m-4-4v8" /></svg>
        </button>
        <button type="button" class="canvas-workspace__tool" aria-label="文字" data-tooltip="添加文字（T）" data-tooltip-position="right" @click="addTextNode">
          <svg viewBox="0 0 24 24"><path d="M5 5h14M12 5v14m-4 0h8" /></svg>
        </button>
        <button type="button" class="canvas-workspace__tool" :class="{ 'is-active': activeTool === 'crop' }" aria-label="裁剪" data-tooltip="裁剪选中图片" data-tooltip-position="right" @click="startCrop()">
          <svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4m0 8v4h-4M8 20H4v-4m4-4h8m-4-4v8" /></svg>
        </button>
      </aside>

      <section v-if="cropDraft" class="canvas-workspace__crop-panel" aria-label="裁剪设置">
        <div><label for="crop-scale">缩放</label><input id="crop-scale" v-model.number="cropDraft.scale" type="range" min="1" max="3" step="0.05"><output>{{ cropDraft.scale.toFixed(2) }}×</output></div>
        <div><label for="crop-x">水平</label><input id="crop-x" v-model.number="cropDraft.offsetX" type="range" min="-50" max="50" step="1"><output>{{ cropDraft.offsetX }}%</output></div>
        <div><label for="crop-y">垂直</label><input id="crop-y" v-model.number="cropDraft.offsetY" type="range" min="-50" max="50" step="1"><output>{{ cropDraft.offsetY }}%</output></div>
        <footer><button type="button" @click="cancelCrop">取消</button><button type="button" class="is-primary" @click="applyCrop">应用裁剪</button></footer>
      </section>

      <div class="canvas-workspace__zoom">
        <button type="button" class="cw-icon-button" aria-label="帮助" data-tooltip="查看快捷键" @click="helpOpen = true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.5 2.1c-1 .8-2 1.3-2 2.9m.02 3h.01" /></svg>
        </button>
        <div class="canvas-workspace__zoom-set">
          <button type="button" aria-label="缩小" data-tooltip="缩小画布" @click="stepZoom(-10)"><svg viewBox="0 0 24 24"><path d="M6 12h12" /></svg></button>
          <span role="button" tabindex="0" aria-label="双击恢复 100%" data-tooltip="双击恢复 100%" @dblclick="setZoom(1)" @keydown.enter="setZoom(1)">{{ zoomLabel }}%</span>
          <button type="button" aria-label="放大" data-tooltip="放大画布" @click="stepZoom(10)"><svg viewBox="0 0 24 24"><path d="M12 6v12m-6-6h12" /></svg></button>
        </div>
      </div>

      <form ref="composerRef" class="canvas-workspace__composer" :class="{ 'is-active': composerActive }" :aria-expanded="composerActive" @click="activateComposer" @submit.prevent="submitCanvasPrompt">
        <button type="button" class="canvas-workspace__composer-add" aria-label="上传参考到画布" data-tooltip="添加本地参考图" @click.stop="requestImageUpload('canvas')">＋</button>
        <input ref="composerInputRef" v-model="prompt" aria-label="创作输入" placeholder="输入想法或上传参考，支持“/”使用技能、“@”添加主体，和Agent一起创作" @focus="composerActive = true" @keydown="onComposerKeydown">
        <button type="submit" class="canvas-workspace__send" :class="{ 'is-ready': sendReady }" :disabled="!sendReady" aria-label="发送">
          <svg viewBox="0 0 24 24"><path d="m12 18V6m0 0-4 4m4-4 4 4" /></svg>
        </button>
      </form>

      <button type="button" class="canvas-workspace__theme" :aria-label="darkMode ? '切换浅色主题' : '切换深色主题'" :data-tooltip="darkMode ? '切换浅色主题' : '切换深色主题'" :aria-pressed="darkMode" @click="darkMode = !darkMode; showToast(darkMode ? '已切换深色主题' : '已切换浅色主题')">
        <svg v-if="!darkMode" viewBox="0 0 24 24"><path d="M20.7 15.6A8.4 8.4 0 0 1 8.4 3.3 8.4 8.4 0 1 0 20.7 15.6Z" /></svg>
        <svg v-else viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      </button>
    </main>

    <aside id="canvas-agent-drawer" class="canvas-workspace__drawer" :class="{ 'is-open': drawerVisible }" :aria-hidden="!drawerVisible" :inert="!drawerVisible">
      <div class="canvas-workspace__drawer-top"><strong>{{ chatTitle }}</strong><button type="button" class="cw-icon-button" aria-label="关闭对话" @click="agentOpen = false"><svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg></button></div>
      <div v-if="!messages.length" class="canvas-workspace__drawer-empty">
        <div>✦</div><h1>和 Agent 聊聊你的想法</h1><p>从已有素材开始</p>
        <button type="button" @click="requestImageUpload('agent')"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" /></svg>上传参考图</button>
        <span>没有好创意？先记录想法，或者添加一张本地参考图吧。</span>
      </div>
      <div v-else class="canvas-workspace__messages" aria-live="polite">
        <article v-for="message in messages" :key="message.id" :class="`is-${message.role}`">
          <div v-if="message.attachments.length" class="canvas-workspace__message-images"><img v-for="item in message.attachments" :key="item.id" :src="item.src" :alt="item.name"></div>
          <p>{{ message.text }}</p><small>{{ message.role === 'user' ? '你' : '本地 Agent' }}</small>
        </article>
      </div>
      <div class="canvas-workspace__drawer-input">
        <div v-if="agentAttachments.length" class="canvas-workspace__attachments">
          <figure v-for="item in agentAttachments" :key="item.id"><img :src="item.src" :alt="item.name"><button type="button" :aria-label="`移除 ${item.name}`" @click="removeAttachment(item.id)">×</button></figure>
        </div>
        <div class="canvas-workspace__drawer-textarea">
          <textarea ref="panelInputRef" v-model="panelPrompt" placeholder="上传参考、输入文字或主体，内容仅保存在本地" @keydown="onPanelKeydown" />
          <button type="button" class="canvas-workspace__drawer-add" aria-label="添加参考" @click="requestImageUpload('agent')">＋</button>
          <button type="button" class="canvas-workspace__send" :class="{ 'is-ready': panelSendReady }" :disabled="!panelSendReady" aria-label="发送" @click="submitPanelPrompt"><svg viewBox="0 0 24 24"><path d="m12 18V6m0 0-4 4m4-4 4 4" /></svg></button>
        </div>
        <div class="canvas-workspace__drawer-controls">
          <select v-model="agentMode" aria-label="Agent 模式"><option>Agent 模式</option><option>仅记录</option></select>
          <select v-model="generationType" aria-label="内容类型"><option>自动</option><option>图像</option><option>视频</option></select>
          <button type="button" :class="{ 'is-toggled': inspirationOn }" :aria-pressed="inspirationOn" @click="inspirationOn = !inspirationOn">灵感搜索</button>
          <button type="button" :class="{ 'is-toggled': creativeOn }" :aria-pressed="creativeOn" @click="creativeOn = !creativeOn">创意设计</button>
        </div>
      </div>
    </aside>

    <input ref="imageInputRef" class="canvas-workspace__hidden-input" type="file" accept="image/*" @change="handleImageUpload">
    <input ref="projectInputRef" class="canvas-workspace__hidden-input" type="file" accept="application/json,.json" @change="importProject">

    <div v-if="helpOpen" class="canvas-workspace__modal" role="dialog" aria-modal="true" aria-labelledby="canvas-help-title" @click.self="helpOpen = false">
      <section><header><h2 id="canvas-help-title">画布快捷操作</h2><button type="button" aria-label="关闭帮助" @click="helpOpen = false">×</button></header>
        <dl><div><dt>平移画布</dt><dd>拖动空白处 / 按住空格拖动</dd></div><div><dt>缩放</dt><dd>⌘/Ctrl + 滚轮</dd></div><div><dt>添加画板 / 文字</dt><dd>A / T</dd></div><div><dt>移动元素</dt><dd>方向键，Shift 加速</dd></div><div><dt>复制 / 删除</dt><dd>⌘/Ctrl + D / Delete</dd></div><div><dt>恢复视图</dt><dd>⌘/Ctrl + 0</dd></div></dl>
      </section>
    </div>

    <div v-if="infoDialog" class="canvas-workspace__modal" role="dialog" aria-modal="true" @click.self="infoDialog = null"><section><header><h2>{{ infoDialog.title }}</h2><button type="button" aria-label="关闭" @click="infoDialog = null">×</button></header><p>{{ infoDialog.body }}</p><footer><button type="button" class="is-primary" @click="infoDialog = null">知道了</button></footer></section></div>

    <div v-if="confirmAction" class="canvas-workspace__modal" role="alertdialog" aria-modal="true"><section><header><h2>{{ confirmAction === 'clear' ? '清空画布？' : '恢复初始示例？' }}</h2></header><p>这会覆盖当前项目的本地画布内容，操作无法撤销。</p><footer><button type="button" @click="confirmAction = null">取消</button><button type="button" class="is-danger" @click="runConfirmedAction">确认</button></footer></section></div>

    <div v-if="toast" class="canvas-workspace__toast" role="status">{{ toast }}</div>
  </div>
</template>
