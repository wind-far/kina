<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowDown, Close, Plus, Search, Top } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getWorkflowPromptAvailableReferenceSlots,
  mergeWorkflowPromptReferences,
  WORKFLOW_PROMPT_REFERENCE_ACCEPT,
  WORKFLOW_PROMPT_REFERENCE_LIMIT,
} from '@/shared/workflow-prompt-references'
import { isWorkflowPromptSendDisabled } from '@/shared/workflow-prompt-visibility'
import type { WorkflowVideoFeature } from '@/shared/workflow-video-prompt'

export type WorkflowPromptGenerationMode = 'image' | 'video'

export interface WorkflowPromptModelOption {
  key: string
  label: string
  provider?: string
  price?: string
  maxCount?: number
}

export interface WorkflowPromptReference {
  id: string
  url?: string
  label: string
  isSubject?: boolean
}

export interface WorkflowPromptSendOptions {
  mode: WorkflowPromptGenerationMode
  modelKey: string
  ratio: string
  resolution: string
  count: number
  feature?: 'all-reference' | 'first-last-frame' | 'smart-multi-frame'
  duration?: number
  references: WorkflowPromptReference[]
}

type OpenPanel = 'type' | 'model' | 'image-size' | 'video-feature' | 'video-size' | 'duration' | 'reference' | null

const props = withDefaults(defineProps<{
  modelValue: string
  generationMode?: WorkflowPromptGenerationMode
  modelKey?: string
  modelOptions?: WorkflowPromptModelOption[]
  references?: WorkflowPromptReference[]
  availableReferences?: WorkflowPromptReference[]
  count?: number
  price?: string
  placeholder?: string
  sending?: boolean
  videoFeature?: WorkflowVideoFeature
  hideTypeSelector?: boolean
  createSubjectLabel?: string
}>(), {
  generationMode: 'image',
  modelKey: '',
  modelOptions: () => [],
  references: () => [],
  availableReferences: () => [],
  count: 1,
  price: '',
  placeholder: '描述你想基于当前图片生成的内容，可切换为视频；按 Enter 发送',
  sending: false,
  hideTypeSelector: false,
  createSubjectLabel: '创建主体',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:generationMode', mode: WorkflowPromptGenerationMode): void
  (e: 'update:modelKey', key: string): void
  (e: 'update:videoFeature', feature: WorkflowVideoFeature): void
  (e: 'add-files', files: File[]): void
  (e: 'remove-reference', id: string): void
  (e: 'create-subject'): void
  (e: 'count-change', count: number): void
  (e: 'send', text: string, options: WorkflowPromptSendOptions): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const mentionsRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const settingsTrackRef = ref<HTMLElement | null>(null)
const openPanel = ref<OpenPanel>(null)
const modelSearch = ref('')
const selectedMentionIds = ref<string[]>([])
const mentionTriggerRange = ref<{ start: number; end: number } | null>(null)
const mentionQuery = ref('')
const mentionIndent = ref(0)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const imageRatio = ref('4x3')
const imageResolution = ref('2k')
const internalVideoFeature = ref<WorkflowVideoFeature>('smart-multi-frame')
const videoFeature = computed({
  get: () => props.videoFeature || internalVideoFeature.value,
  set: (value: WorkflowVideoFeature) => {
    internalVideoFeature.value = value
    emit('update:videoFeature', value)
  },
})
const videoRatio = ref('16x9')
const videoResolution = ref('720p')
const videoDuration = ref(5)

const isInspirationOpen = ref(false)
const inspirationTab = ref('运营')
const inspirationCategory = ref('3D海报')
const inspirationSearch = ref('')
const selectedInspirationId = ref('')

const localText = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const currentModel = computed(() => props.modelOptions.find(option => option.key === props.modelKey))
const currentModelLabel = computed(() => currentModel.value?.label || props.modelKey || '请选择模型')
const currentModelPrice = computed(() => currentModel.value?.price || props.price)
const currentMaxCount = computed(() => {
  const value = Number(currentModel.value?.maxCount)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
})
const filteredModels = computed(() => {
  const keyword = modelSearch.value.trim().toLowerCase()
  if (!keyword) return props.modelOptions
  return props.modelOptions.filter(option => `${option.provider || ''} ${option.label}`.toLowerCase().includes(keyword))
})
const filteredAvailableReferences = computed(() => {
  const query = mentionQuery.value.trim().toLocaleLowerCase('zh-CN')
  if (!query) return props.availableReferences
  return props.availableReferences.filter(reference => reference.label.toLocaleLowerCase('zh-CN').includes(query))
})

const selectedMentionReferences = computed(() => selectedMentionIds.value
  .map(id => props.availableReferences.find(reference => reference.id === id))
  .filter((reference): reference is WorkflowPromptReference => Boolean(reference)))

const mergedSendReferences = computed(() => {
  return mergeWorkflowPromptReferences(props.references, selectedMentionReferences.value)
})

const isSendDisabled = computed(() => isWorkflowPromptSendDisabled({
  sending: props.sending,
  modelKey: props.modelKey,
  text: localText.value,
  referenceCount: mergedSendReferences.value.length,
}))
const imageRatioOptions = [
  { label: '智能', value: 'smart', shape: 'smart' },
  { label: '21:9', value: '21x9', shape: 'wide' },
  { label: '16:9', value: '16x9', shape: 'wide' },
  { label: '3:2', value: '3x2', shape: 'wide' },
  { label: '4:3', value: '4x3', shape: 'landscape' },
  { label: '1:1', value: '1x1', shape: 'square' },
  { label: '3:4', value: '3x4', shape: 'portrait' },
  { label: '2:3', value: '2x3', shape: 'portrait' },
  { label: '9:16', value: '9x16', shape: 'tall' },
] as const
const videoRatioOptions = imageRatioOptions.filter(option => ['16x9', '4x3', '1x1', '3x4', '9x16'].includes(option.value))
const imageDimensions: Record<string, Record<string, [number, number]>> = {
  '2k': {
    smart: [2048, 2048], '21x9': [3024, 1296], '16x9': [2560, 1440], '3x2': [2496, 1664],
    '4x3': [2048, 1536], '1x1': [2048, 2048], '3x4': [1536, 2048], '2x3': [1664, 2496], '9x16': [1440, 2560],
  },
  '4k': {
    smart: [4096, 4096], '21x9': [6198, 2656], '16x9': [5404, 3040], '3x2': [4992, 3328],
    '4x3': [4096, 3072], '1x1': [4096, 4096], '3x4': [3072, 4096], '2x3': [3328, 4992], '9x16': [3040, 5404],
  },
}
const currentImageDimensions = computed(() => imageDimensions[imageResolution.value]?.[imageRatio.value] || [2048, 1536])
const imageSizeLabel = computed(() => {
  const ratio = imageRatioOptions.find(item => item.value === imageRatio.value)?.label || '4:3'
  return `${ratio}   ${imageResolution.value === '4k' ? '超清 4K' : '高清 2K'}`
})
const videoSizeLabel = computed(() => {
  const ratio = videoRatioOptions.find(item => item.value === videoRatio.value)?.label || '16:9'
  return `${ratio}   ${videoResolution.value.toUpperCase()}`
})
const videoFeatureLabel = computed(() => ({
  'all-reference': '全能参考',
  'first-last-frame': '首尾帧',
  'smart-multi-frame': '智能多帧',
})[videoFeature.value])

const inspirationTabs = ['运营', 'APP', '海报', '插画', 'IP']
const inspirationCategories = ['3D海报', 'KV海报']
const inspirationItems = [
  { id: 'travel', title: '旅行指南', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/vacation-guide.webp', prompt: '生成一张明亮活泼的3D旅行主题海报，使用柔和奶油色背景、彩色充气感地标与人物，主体居中，信息层级清晰，商业海报质感。' },
  { id: 'city', title: '城市游牧计划', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/urban-nomad-project.webp', prompt: '生成一张未来都市游牧主题3D海报，霓虹城市地标、潮流人物与高饱和软塑材质，构图具有空间纵深和品牌活动感。' },
  { id: 'team', title: '团队招新', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/join-us-recruitment.webp', prompt: '生成一张年轻团队招新3D海报，紫黄撞色、夸张立体字形、潮玩角色和招聘卡片元素，画面轻松有活力。' },
  { id: 'play', title: '放肆去玩', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/play-wild-dopamine.webp', prompt: '生成一张夏日玩乐主题3D海报，紫色立体标题、黄色潮流人物、弹簧与星形装饰，白色背景，强烈动势与年轻感。' },
  { id: 'skateboard', title: '滑板派对', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/play-wild-skateboard.webp', prompt: '生成一张滑板派对主题3D海报，动感人物、潮流滑板与高饱和色块，使用夸张透视和软塑材质，呈现年轻活力。' },
  { id: 'mountain', title: '山野露营', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/may-day-mountain-tent.webp', prompt: '生成一张山野露营主题3D海报，帐篷、山峰与轻盈云朵组成空间层次，色彩清新，具有节日出游活动感。' },
  { id: 'camping', title: '假日露营', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/may-day-girl-camping.webp', prompt: '生成一张假日露营主题3D海报，年轻人物、帐篷与户外装备，柔和明亮的色彩和细腻材质，画面轻松治愈。' },
  { id: 'island', title: '海岛假日', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/may-day-island-tent.webp', prompt: '生成一张海岛假日主题3D海报，沙滩、帐篷与海浪元素构成微缩景观，留出标题空间，商业活动视觉质感。' },
  { id: 'carnival', title: '青春市集', tab: '运营', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/youth-shop-carnival.webp', prompt: '生成一张青春市集主题3D海报，潮流摊位、年轻人物与缤纷装饰，构图热闹有序，具有品牌嘉年华氛围。' },
  { id: 'launch', title: '新品发布', tab: '海报', category: 'KV海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/urban-nomad-project.webp', prompt: '生成一张科技新品发布KV，深色空间背景、产品悬浮居中、青蓝轮廓光和细腻雾气，留出标题区域，电影级商业质感。' },
  { id: 'app', title: '效率应用', tab: 'APP', category: 'KV海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/vacation-guide.webp', prompt: '生成一张效率工具APP宣传图，手机界面与功能卡片悬浮，蓝绿色渐变光晕，布局简洁、可信且具有高端SaaS产品感。' },
  { id: 'illustration', title: '夏日插画', tab: '插画', category: 'KV海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/may-day-girl-camping.webp', prompt: '生成一张夏日城市生活插画，扁平与轻3D结合，暖阳、树影、人物和咖啡店，色彩明快，细节丰富但留白舒适。' },
  { id: 'ip', title: '潮玩角色', tab: 'IP', category: '3D海报', image: 'https://reaicc.com/image-hub/assets/ops-c4d/play-wild-skateboard.webp', prompt: '生成一个可延展的潮玩IP角色，圆润几何外形、鲜明配色、友好表情，纯色背景，正面全身，适合品牌周边与表情延展。' },
]
const filteredInspirationItems = computed(() => {
  const keyword = inspirationSearch.value.trim().toLowerCase()
  const preferred = inspirationItems.filter(item => item.tab === inspirationTab.value && item.category === inspirationCategory.value)
  const pool = preferred.length ? preferred : inspirationItems.filter(item => item.tab === inspirationTab.value)
  return pool.filter(item => !keyword || `${item.title} ${item.prompt}`.toLowerCase().includes(keyword))
})
const selectedInspiration = computed(() => inspirationItems.find(item => item.id === selectedInspirationId.value))

const togglePanel = (panel: Exclude<OpenPanel, null>) => {
  openPanel.value = openPanel.value === panel ? null : panel
  if (panel === 'model') modelSearch.value = ''
}

const closePanels = () => {
  openPanel.value = null
}

const selectMode = (mode: WorkflowPromptGenerationMode) => {
  emit('update:generationMode', mode)
  closePanels()
  nextTick(updateScrollState)
}

const selectModel = (model: WorkflowPromptModelOption) => {
  emit('update:modelKey', model.key)
  const nextMaxCount = Number.isFinite(Number(model.maxCount)) && Number(model.maxCount) >= 1
    ? Math.floor(Number(model.maxCount))
    : 1
  if (props.count > nextMaxCount) emit('count-change', nextMaxCount)
  closePanels()
}

const handleAddFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  const availableSlots = getWorkflowPromptAvailableReferenceSlots(mergedSendReferences.value.length)
  if (files.length > availableSlots) ElMessage.info(`最多支持 ${WORKFLOW_PROMPT_REFERENCE_LIMIT} 张参考图`)
  if (availableSlots > 0 && files.length) emit('add-files', files.slice(0, availableSlots))
  input.value = ''
}

const selectReference = (reference: WorkflowPromptReference) => {
  const alreadyMerged = mergedSendReferences.value.some(item => item.id === reference.id)
  if (!alreadyMerged && mergedSendReferences.value.length >= WORKFLOW_PROMPT_REFERENCE_LIMIT) {
    ElMessage.info(`最多支持 ${WORKFLOW_PROMPT_REFERENCE_LIMIT} 张参考图`)
    return
  }
  if (!selectedMentionIds.value.includes(reference.id)) {
    selectedMentionIds.value = [...selectedMentionIds.value, reference.id]
  }
  const trigger = mentionTriggerRange.value
  if (trigger) {
    const nextText = `${localText.value.slice(0, trigger.start)}${localText.value.slice(trigger.end)}`
    localText.value = nextText
    mentionTriggerRange.value = null
    mentionQuery.value = ''
    nextTick(() => {
      const textarea = textareaRef.value
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(trigger.start, trigger.start)
    })
  }
  closePanels()
  nextTick(() => textareaRef.value?.focus())
}

const isReferenceUnavailable = (reference: WorkflowPromptReference) => selectedMentionIds.value.includes(reference.id)
  || (mergedSendReferences.value.length >= WORKFLOW_PROMPT_REFERENCE_LIMIT
    && !mergedSendReferences.value.some(item => item.id === reference.id))

const removeMention = (id: string) => {
  selectedMentionIds.value = selectedMentionIds.value.filter(item => item !== id)
}

const requestCreateSubject = () => emit('create-subject')

const handleSend = () => {
  if (isSendDisabled.value) return
  emit('send', localText.value.trim(), {
    mode: props.generationMode,
    modelKey: props.modelKey,
    ratio: props.generationMode === 'image' ? imageRatio.value : videoRatio.value,
    resolution: props.generationMode === 'image' ? imageResolution.value : videoResolution.value,
    count: Math.min(currentMaxCount.value, Math.max(1, props.count)),
    feature: props.generationMode === 'video' ? videoFeature.value : undefined,
    duration: props.generationMode === 'video' ? videoDuration.value : undefined,
    references: mergedSendReferences.value,
  })
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && mentionTriggerRange.value) {
    mentionTriggerRange.value = null
    mentionQuery.value = ''
    closePanels()
    return
  }

  if (event.key === 'Enter' && openPanel.value === 'reference' && mentionTriggerRange.value) {
    const reference = filteredAvailableReferences.value.find(item => !isReferenceUnavailable(item))
    if (reference) {
      event.preventDefault()
      selectReference(reference)
      return
    }
  }

  if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
  event.preventDefault()
  handleSend()
}

const updateMentionTrigger = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const value = textarea.value
  const cursor = textarea.selectionStart ?? value.length
  const beforeCursor = value.slice(0, cursor)
  const match = /@([^\s@]*)$/u.exec(beforeCursor)

  if (!match) {
    if (mentionTriggerRange.value) {
      mentionTriggerRange.value = null
      mentionQuery.value = ''
      if (openPanel.value === 'reference') closePanels()
    }
    return
  }

  mentionTriggerRange.value = {
    start: cursor - match[0].length,
    end: cursor,
  }
  mentionQuery.value = match[1] || ''
  openPanel.value = 'reference'
}

const updateMentionIndent = () => {
  mentionIndent.value = selectedMentionReferences.value.length
    ? Math.min((mentionsRef.value?.offsetWidth || 0) + 8, 420)
    : 0
}

const useSelectedInspiration = () => {
  if (!selectedInspiration.value) return
  localText.value = selectedInspiration.value.prompt
  isInspirationOpen.value = false
  selectedInspirationId.value = ''
  nextTick(() => textareaRef.value?.focus())
}

const updateScrollState = () => {
  const track = settingsTrackRef.value
  if (!track) return
  canScrollLeft.value = track.scrollLeft > 2
  canScrollRight.value = track.scrollLeft + track.clientWidth < track.scrollWidth - 2
}

const scrollSettings = (direction: -1 | 1) => {
  settingsTrackRef.value?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  window.setTimeout(updateScrollState, 240)
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target
  const root = rootRef.value
  if (!root || !(target instanceof Node)) {
    closePanels()
    return
  }

  // 仅点击当前弹层内容或任一弹层触发按钮时保持状态；点击输入区空白、
  // 其他普通控件或画布都应关闭。Vue Flow 会阻止事件冒泡，因此监听使用捕获阶段。
  if (root.contains(target) && target instanceof Element) {
    const keepsPanelOpen = target.closest('.workflow-prompt-popover')
      || target.closest('[data-workflow-prompt-panel-trigger]')
    if (keepsPanelOpen) return
  }

  closePanels()
}

const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closePanels()
    isInspirationOpen.value = false
  }
}

watch(() => props.availableReferences.map(reference => reference.id), (ids) => {
  selectedMentionIds.value = selectedMentionIds.value.filter(id => ids.includes(id))
}, { deep: true })

watch(() => props.references.map(reference => reference.id), () => {
  const baseIds = new Set(props.references.map(reference => reference.id))
  const mentionSlots = getWorkflowPromptAvailableReferenceSlots(baseIds.size)
  const validMentionIds = selectedMentionIds.value
    .filter(id => props.availableReferences.some(reference => reference.id === id))
  selectedMentionIds.value = [
    ...validMentionIds.filter(id => baseIds.has(id)),
    ...validMentionIds.filter(id => !baseIds.has(id)).slice(0, mentionSlots),
  ]
}, { deep: true })

watch(() => props.generationMode, () => {
  closePanels()
  nextTick(updateScrollState)
})

watch(selectedMentionReferences, () => {
  nextTick(updateMentionIndent)
}, { deep: true })

watch(currentMaxCount, maxCount => {
  if (props.count > maxCount) emit('count-change', maxCount)
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', updateScrollState)
  window.addEventListener('resize', updateMentionIndent)
  nextTick(() => {
    updateScrollState()
    updateMentionIndent()
  })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', updateScrollState)
  window.removeEventListener('resize', updateMentionIndent)
})
</script>

<template>
  <div ref="rootRef" class="canvas-prompt-input canvas-prompt-input--workflow" @click.stop>
    <input
      ref="fileInputRef"
      class="canvas-prompt-input__file"
      type="file"
      :accept="WORKFLOW_PROMPT_REFERENCE_ACCEPT"
      multiple
      @change="handleAddFiles"
    >

    <div class="canvas-prompt-input__content">
      <div class="canvas-prompt-input__top">
        <div
          v-for="(reference, index) in references.slice(0, 4)"
          :key="reference.id"
          class="canvas-prompt-input__ref"
          :style="{ transform: `rotate(${index === 0 ? -8 : index * 5 - 8}deg) translate(${index * 3}px, ${index}px)`, zIndex: index + 1 }"
          :title="reference.label"
        >
          <img v-if="reference.url" :src="reference.url" alt="参考图" class="canvas-prompt-input__ref-img">
          <span v-else class="canvas-prompt-input__ref-fallback">{{ reference.label.slice(0, 2) }}</span>
          <button type="button" class="canvas-prompt-input__ref-remove" aria-label="移除参考图" @click.stop="emit('remove-reference', reference.id)"><el-icon><Close /></el-icon></button>
        </div>
        <button type="button" class="canvas-prompt-input__add" aria-label="添加参考图" title="添加参考图" :disabled="mergedSendReferences.length >= WORKFLOW_PROMPT_REFERENCE_LIMIT" @click="fileInputRef?.click()"><el-icon><Plus /></el-icon></button>
      </div>

      <div class="canvas-prompt-input__body">
        <div ref="mentionsRef" v-if="selectedMentionReferences.length" class="canvas-prompt-input__mentions">
          <span v-for="reference in selectedMentionReferences" :key="reference.id" class="canvas-prompt-input__mention">
            <img v-if="reference.url" :src="reference.url" alt="">
            <span v-else class="canvas-prompt-input__mention-fallback">@</span>
            <span>{{ reference.label }}</span>
            <button type="button" aria-label="移除引用" @click="removeMention(reference.id)">×</button>
          </span>
        </div>
        <textarea
          ref="textareaRef"
          v-model="localText"
          class="canvas-prompt-input__textarea"
          :style="{ '--workflow-mention-indent': `${mentionIndent}px` }"
          :placeholder="selectedMentionIds.length ? '' : placeholder"
          rows="2"
          @input="updateMentionTrigger"
          @keydown="handleKeydown"
        />
      </div>
    </div>

    <div class="canvas-prompt-input__footer" :class="`is-${generationMode}`">
      <div class="canvas-prompt-input__settings">
        <button type="button" class="canvas-prompt-input__scroll-btn" aria-label="向左滑动工具" :disabled="!canScrollLeft" @click="scrollSettings(-1)">‹</button>
        <div ref="settingsTrackRef" class="canvas-prompt-input__settings-track" @scroll="updateScrollState">
          <button v-if="!hideTypeSelector" type="button" class="canvas-prompt-input__pill canvas-prompt-input__type-pill" data-workflow-prompt-panel-trigger :aria-expanded="openPanel === 'type'" @click="togglePanel('type')">
            <span class="canvas-prompt-input__type-icon" aria-hidden="true">{{ generationMode === 'image' ? '▧' : '◴' }}</span>
            <span>{{ generationMode === 'image' ? '图片生成' : '视频生成' }}</span>
            <el-icon class="canvas-prompt-input__pill-caret"><ArrowDown /></el-icon>
          </button>

          <button type="button" class="canvas-prompt-input__pill canvas-prompt-input__model-pill" data-workflow-prompt-panel-trigger :aria-expanded="openPanel === 'model'" @click="togglePanel('model')">
            <span class="canvas-prompt-input__pill-icon" aria-hidden="true">{{ generationMode === 'image' ? '◎' : '◇' }}</span>
            <span class="canvas-prompt-input__model-label">{{ currentModelLabel }}</span>
            <span v-if="generationMode === 'image' && currentModelPrice" class="canvas-prompt-input__model-price">{{ currentModelPrice }}</span>
            <el-icon class="canvas-prompt-input__pill-caret"><ArrowDown /></el-icon>
          </button>

          <template v-if="generationMode === 'image'">
            <button type="button" class="canvas-prompt-input__pill canvas-prompt-input__size-pill" data-workflow-prompt-panel-trigger @click="togglePanel('image-size')"><span>{{ imageSizeLabel }}</span></button>
            <div class="canvas-prompt-input__count-stepper" aria-label="生成数量">
              <button type="button" aria-label="减少生成数量" :disabled="count <= 1" @click="emit('count-change', Math.max(1, count - 1))">−</button>
              <span>{{ count }}</span>
              <button type="button" aria-label="增加生成数量" :disabled="count >= currentMaxCount" @click="emit('count-change', Math.min(currentMaxCount, count + 1))">＋</button>
            </div>
          </template>

          <template v-else>
            <button type="button" class="canvas-prompt-input__pill canvas-prompt-input__feature-pill" data-workflow-prompt-panel-trigger @click="togglePanel('video-feature')"><span>◫</span><span>{{ videoFeatureLabel }}</span><el-icon class="canvas-prompt-input__pill-caret"><ArrowDown /></el-icon></button>
            <button type="button" class="canvas-prompt-input__pill canvas-prompt-input__video-size-pill" data-workflow-prompt-panel-trigger @click="togglePanel('video-size')"><span>{{ videoSizeLabel }}</span></button>
            <button type="button" class="canvas-prompt-input__pill canvas-prompt-input__duration-pill" data-workflow-prompt-panel-trigger @click="togglePanel('duration')"><span>◷</span><span>{{ videoDuration }}s</span><el-icon class="canvas-prompt-input__pill-caret"><ArrowDown /></el-icon></button>
          </template>
        </div>
        <button type="button" class="canvas-prompt-input__scroll-btn" aria-label="向右滑动工具" :disabled="!canScrollRight" @click="scrollSettings(1)">›</button>
      </div>

      <button v-if="generationMode === 'image'" type="button" class="canvas-prompt-input__footer-action" aria-label="提示词灵感" @click="isInspirationOpen = true"><span aria-hidden="true">☼</span><span>灵感</span></button>
      <button type="button" class="canvas-prompt-input__footer-action" data-workflow-prompt-panel-trigger aria-label="引用主体或素材" :aria-expanded="openPanel === 'reference'" @click="togglePanel('reference')"><span aria-hidden="true">@</span><span>引用</span></button>
      <span v-if="generationMode === 'image' && price" class="canvas-prompt-input__price"><span aria-hidden="true">✦</span>{{ price }}</span>
      <span v-else-if="generationMode === 'video'" class="canvas-prompt-input__video-spark" aria-hidden="true">✦</span>
      <button type="button" class="canvas-prompt-input__send" :disabled="isSendDisabled" aria-label="发送" :title="isSendDisabled ? '请输入内容或引用素材' : '发送 (Enter)'" @click="handleSend"><el-icon><Top /></el-icon></button>
    </div>

    <Transition name="workflow-prompt-popover">
      <div v-if="!hideTypeSelector && openPanel === 'type'" class="workflow-prompt-popover workflow-prompt-type-popover">
        <div class="workflow-prompt-popover__title">创作类型</div>
        <button type="button" :class="{ 'is-selected': generationMode === 'image' }" @click="selectMode('image')"><span>▧</span><span>图片生成</span><span v-if="generationMode === 'image'">✓</span></button>
        <button type="button" :class="{ 'is-selected': generationMode === 'video' }" @click="selectMode('video')"><span>◴</span><span>视频生成</span><span v-if="generationMode === 'video'">✓</span></button>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'model'" class="workflow-prompt-popover workflow-prompt-model-popover">
        <label class="workflow-prompt-search"><el-icon><Search /></el-icon><input v-model="modelSearch" placeholder="搜索模型…"></label>
        <div v-if="filteredModels.length" class="workflow-prompt-model-list">
          <button v-for="option in filteredModels" :key="option.key" type="button" :class="{ 'is-selected': option.key === modelKey }" @click="selectModel(option)">
            <span class="workflow-prompt-model-list__provider">{{ option.provider || (generationMode === 'image' ? 'OpenAI' : '视频模型') }}</span>
            <span class="workflow-prompt-model-list__name">{{ option.label }}</span>
            <span v-if="option.price" class="workflow-prompt-model-list__price">{{ option.price }}</span>
            <span v-if="option.key === modelKey" class="workflow-prompt-model-list__check">✓</span>
          </button>
        </div>
        <div v-else class="workflow-prompt-model-empty">暂无可用的模型</div>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'image-size'" class="workflow-prompt-popover workflow-prompt-size-popover workflow-prompt-size-popover--image">
        <div class="workflow-prompt-popover__title">选择比例</div>
        <div class="workflow-prompt-ratio-grid workflow-prompt-ratio-grid--image">
          <button v-for="option in imageRatioOptions" :key="option.value" type="button" :class="{ 'is-selected': option.value === imageRatio }" @click="imageRatio = option.value"><span :class="['workflow-prompt-ratio-shape', `is-${option.shape}`]" /><span>{{ option.label }}</span></button>
        </div>
        <div class="workflow-prompt-popover__title">选择分辨率</div>
        <div class="workflow-prompt-segmented"><button type="button" :class="{ 'is-selected': imageResolution === '2k' }" @click="imageResolution = '2k'">高清 2K</button><button type="button" :class="{ 'is-selected': imageResolution === '4k' }" @click="imageResolution = '4k'">超清 4K ✦</button></div>
        <div class="workflow-prompt-popover__title">尺寸</div>
        <div class="workflow-prompt-dimensions"><span>W</span><strong>{{ currentImageDimensions[0] }}</strong><span class="workflow-prompt-dimensions__link">↔</span><span>H</span><strong>{{ currentImageDimensions[1] }}</strong><span>PX</span></div>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'video-feature'" class="workflow-prompt-popover workflow-prompt-feature-popover">
        <div class="workflow-prompt-popover__title">功能</div>
        <button type="button" :class="{ 'is-selected': videoFeature === 'all-reference' }" @click="videoFeature = 'all-reference'; closePanels()"><span>⌘</span><span>全能参考</span><small>New</small><span v-if="videoFeature === 'all-reference'">✓</span></button>
        <button type="button" :class="{ 'is-selected': videoFeature === 'first-last-frame' }" @click="videoFeature = 'first-last-frame'; closePanels()"><span>◫</span><span>首尾帧</span><span v-if="videoFeature === 'first-last-frame'">✓</span></button>
        <button type="button" :class="{ 'is-selected': videoFeature === 'smart-multi-frame' }" @click="videoFeature = 'smart-multi-frame'; closePanels()"><span>◧</span><span>智能多帧</span><span v-if="videoFeature === 'smart-multi-frame'">✓</span></button>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'video-size'" class="workflow-prompt-popover workflow-prompt-size-popover workflow-prompt-size-popover--video">
        <div class="workflow-prompt-popover__title">选择比例</div>
        <div class="workflow-prompt-ratio-grid workflow-prompt-ratio-grid--video"><button v-for="option in videoRatioOptions" :key="option.value" type="button" :class="{ 'is-selected': option.value === videoRatio }" @click="videoRatio = option.value"><span :class="['workflow-prompt-ratio-shape', `is-${option.shape}`]" /><span>{{ option.label }}</span></button></div>
        <div class="workflow-prompt-popover__title">选择分辨率</div>
        <div class="workflow-prompt-segmented"><button type="button" :class="{ 'is-selected': videoResolution === '720p' }" @click="videoResolution = '720p'">720P ✦</button><button type="button" :class="{ 'is-selected': videoResolution === '480p' }" @click="videoResolution = '480p'">480P ✦</button></div>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'duration'" class="workflow-prompt-popover workflow-prompt-duration-popover">
        <div class="workflow-prompt-popover__title">选择视频生成时长</div>
        <div class="workflow-prompt-duration-row"><input v-model.number="videoDuration" type="range" min="4" max="15" step="1"><label><input v-model.number="videoDuration" type="number" min="4" max="15"><span>s</span></label></div>
        <div class="workflow-prompt-duration-ticks"><span>4</span><span>5</span><span>10</span><span>15</span></div>
      </div>
    </Transition>

    <Transition name="workflow-prompt-popover">
      <div v-if="openPanel === 'reference'" class="workflow-prompt-popover workflow-prompt-reference-popover">
        <div class="workflow-prompt-popover__title">可能 <span>@</span> 的内容</div>
        <button type="button" class="workflow-prompt-reference-create" @click="requestCreateSubject"><span>＋</span><span>{{ createSubjectLabel }}</span></button>
        <div class="workflow-prompt-reference-list">
          <button v-for="reference in filteredAvailableReferences" :key="reference.id" type="button" :disabled="isReferenceUnavailable(reference)" @click="selectReference(reference)"><img v-if="reference.url" :src="reference.url" alt=""><span v-else>{{ reference.label.slice(0, 2) }}</span><strong>{{ reference.label }}</strong><em v-if="reference.isSubject">主体</em><small v-if="selectedMentionIds.includes(reference.id)">已引用</small><small v-else-if="isReferenceUnavailable(reference)">已达上限</small></button>
          <div v-if="filteredAvailableReferences.length === 0" class="workflow-prompt-reference-empty">{{ mentionQuery ? '没有匹配的可引用素材' : '画布中暂无可引用素材' }}</div>
        </div>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="workflow-inspiration-modal">
        <div v-if="isInspirationOpen" class="workflow-inspiration-backdrop" @mousedown.self="isInspirationOpen = false">
          <section class="workflow-inspiration-modal" role="dialog" aria-label="提示词灵感库">
            <header>
              <nav aria-label="素材库视图"><button v-for="tab in inspirationTabs" :key="tab" type="button" :class="{ 'is-selected': inspirationTab === tab }" @click="inspirationTab = tab; selectedInspirationId = ''">{{ tab }}</button></nav>
              <label><input v-model="inspirationSearch" placeholder="搜索提示词或分类"><el-icon><Search /></el-icon></label>
              <button type="button" aria-label="关闭" @click="isInspirationOpen = false"><el-icon><Close /></el-icon></button>
            </header>
            <div class="workflow-inspiration-subnav"><button v-for="category in inspirationCategories" :key="category" type="button" :class="{ 'is-selected': inspirationCategory === category }" @click="inspirationCategory = category; selectedInspirationId = ''">{{ category }}</button><span>全部⌄</span></div>
            <div class="workflow-inspiration-grid">
              <button v-for="item in filteredInspirationItems" :key="item.id" type="button" :class="{ 'is-selected': selectedInspirationId === item.id }" @click="selectedInspirationId = item.id"><img :src="item.image" :alt="item.title"><span>{{ item.title }}</span><small v-if="selectedInspirationId === item.id">✓</small></button>
              <div v-if="filteredInspirationItems.length === 0" class="workflow-inspiration-empty">没有匹配的灵感模板</div>
            </div>
            <footer><button type="button" @click="isInspirationOpen = false">取消</button><button type="button" :disabled="!selectedInspiration" @click="useSelectedInspiration">使用提示词</button></footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.canvas-prompt-input { position: relative; box-sizing: border-box; display: flex; flex-direction: column; color: #0f1419; }
.canvas-prompt-input--workflow { width: 760px; max-width: 760px; height: 178px; min-height: 178px; padding: 14px 16px 16px; gap: 12px; border: 1px solid rgba(0,0,0,.03); border-radius: 24px; background: #fefeff; box-shadow: none; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; }
.canvas-prompt-input__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.canvas-prompt-input__content { display: flex; flex: 0 0 98px; height: 98px; min-height: 0; gap: 16px; }
.canvas-prompt-input__top { position: relative; flex: 0 0 60px; width: 60px; height: 98px; }
.canvas-prompt-input__ref { position: absolute; top: 12px; left: 10px; width: 44px; height: 61px; overflow: visible; border: 1px solid rgba(0,0,0,.06); border-radius: 5px; background: #eef0f2; }
.canvas-prompt-input__ref-img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.canvas-prompt-input__ref-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #536471; font-size: 12px; }
.canvas-prompt-input__ref-remove { position: absolute; top: -7px; right: -7px; display: none; align-items: center; justify-content: center; width: 17px; height: 17px; padding: 0; border: 0; border-radius: 50%; background: rgba(15,20,25,.86); color: #fff; cursor: pointer; }
.canvas-prompt-input__ref:hover .canvas-prompt-input__ref-remove { display: inline-flex; }
.canvas-prompt-input__ref-remove .el-icon { font-size: 10px; }
.canvas-prompt-input__add { position: absolute; top: 51.5px; left: 34.5px; z-index: 8; display: inline-flex; align-items: center; justify-content: center; width: 29px; height: 29px; padding: 0; border: 0; border-radius: 50%; background: #f1f2f3; color: #0f1419; box-shadow: 0 2px 6px rgba(15,20,25,.12); cursor: pointer; }
.canvas-prompt-input__add .el-icon { font-size: 14px; }
.canvas-prompt-input__add:disabled { color: rgba(15,20,25,.32); cursor: default; box-shadow: 0 2px 6px rgba(15,20,25,.06); }
.canvas-prompt-input__body { position: relative; display: block; flex: 1 1 auto; min-width: 0; height: 96px; min-height: 96px; padding-top: 2px; overflow-y: auto; }
.canvas-prompt-input__mentions { position: absolute; z-index: 1; top: 2px; left: 0; display: inline-flex; flex-wrap: wrap; gap: 4px; max-width: min(420px, calc(100% - 24px)); pointer-events: auto; }
.canvas-prompt-input__mention { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 1px 6px 1px 2px; border-radius: 6px; background: rgba(61,176,196,.1); color: #0f1419; font-size: 13px; }
.canvas-prompt-input__mention img, .canvas-prompt-input__mention-fallback { width: 20px; height: 20px; border-radius: 4px; object-fit: cover; }
.canvas-prompt-input__mention-fallback { display: inline-flex; align-items: center; justify-content: center; background: #dff5f8; color: #3db0c4; font-weight: 700; }
.canvas-prompt-input__mention button { width: 14px; height: 14px; padding: 0; border: 0; background: transparent; color: #8899a6; cursor: pointer; line-height: 1; }
.canvas-prompt-input__textarea { display: block; box-sizing: border-box; width: 100%; min-width: 0; height: 92px; min-height: 92px; padding: 0; resize: none; border: 0; outline: 0; background: transparent; color: #0f1419; font: 400 14px/24px inherit; text-indent: var(--workflow-mention-indent, 0px); }
.canvas-prompt-input__textarea::placeholder { color: rgba(83,100,113,.64); }
.canvas-prompt-input__footer { display: flex; align-items: center; flex: 0 0 36px; height: 36px; min-height: 36px; gap: 4px; white-space: nowrap; }
.canvas-prompt-input__settings { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; max-width: 455px; padding-left: 4px; overflow: hidden; }
.canvas-prompt-input__footer.is-video .canvas-prompt-input__settings { max-width: 588px; }
.canvas-prompt-input__settings-track { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; gap: 4px; margin-left: 10px; overflow-x: auto; scrollbar-width: none; scroll-behavior: smooth; }
.canvas-prompt-input__settings-track::-webkit-scrollbar { display: none; }
.canvas-prompt-input__scroll-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 26px; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: #fff; color: #0f1419; font-size: 24px; cursor: pointer; }
.canvas-prompt-input__scroll-btn:disabled { color: rgba(83,100,113,.25); cursor: default; }
.canvas-prompt-input__pill { display: inline-flex; align-items: center; flex: 0 0 auto; gap: 6px; height: 36px; min-height: 36px; padding: 0 12px; border: 1px solid rgba(0,0,0,.05); border-radius: 10px; background: transparent; color: #0f1419; font-size: 12px; font-weight: 450; cursor: pointer; }
.canvas-prompt-input__pill:hover, .canvas-prompt-input__pill[aria-expanded="true"] { background: rgba(15,20,25,.035); }
.canvas-prompt-input__type-pill { width: 110px; color: #55b8cc; }
.canvas-prompt-input__type-icon { font-size: 14px; }
.canvas-prompt-input__model-pill { width: 213px; }
.canvas-prompt-input__footer.is-video .canvas-prompt-input__model-pill { width: 126px; }
.canvas-prompt-input__pill-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 20px; width: 20px; height: 20px; border-radius: 50%; background: #17191c; color: #fff; font-size: 12px; }
.canvas-prompt-input__model-label { overflow: hidden; text-overflow: ellipsis; }
.canvas-prompt-input__model-price { margin-left: auto; padding: 2px 6px; border-radius: 999px; background: #f1f2f3; color: #0f1419; font-size: 11px; }
.canvas-prompt-input__pill-caret { margin-left: auto; color: #536471; font-size: 11px; }
.canvas-prompt-input__size-pill { min-width: 128px; color: #55b8cc; }
.canvas-prompt-input__feature-pill { min-width: 108px; }
.canvas-prompt-input__video-size-pill { min-width: 112px; color: #55b8cc; }
.canvas-prompt-input__duration-pill { min-width: 72px; }
.canvas-prompt-input__count-stepper { display: inline-flex; align-items: center; flex: 0 0 78px; min-width: 78px; height: 28px; }
.canvas-prompt-input__count-stepper button { width: 22px; height: 28px; padding: 0; border: 0; background: transparent; color: #536471; font-size: 16px; cursor: pointer; }
.canvas-prompt-input__count-stepper button:disabled { opacity: .35; cursor: default; }
.canvas-prompt-input__count-stepper span { flex: 1; text-align: center; font-size: 12px; font-weight: 500; }
.canvas-prompt-input__footer-action { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; height: 32px; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: #0f1419; font-size: 14px; font-weight: 500; cursor: pointer; }
.canvas-prompt-input__footer-action:hover, .canvas-prompt-input__footer-action[aria-expanded="true"] { background: rgba(15,20,25,.045); }
.canvas-prompt-input__price { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; padding: 0 4px; color: #536471; font-size: 12px; font-weight: 500; }
.canvas-prompt-input__price span, .canvas-prompt-input__video-spark { font-size: 8px; }
.canvas-prompt-input__send { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 34px; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: #0f1419; color: #fff; cursor: pointer; }
.canvas-prompt-input__send:disabled { background: rgba(15,20,25,.28); color: rgba(255,255,255,.72); cursor: default; }
.canvas-prompt-input__send .el-icon { font-size: 16px; }

.workflow-prompt-popover { position: absolute; z-index: 90; padding: 10px; border: 1px solid rgba(0,0,0,.04); border-radius: 16px; background: #fff; box-shadow: 0 12px 28px rgba(15,20,25,.14); color: #0f1419; }
.workflow-prompt-popover__title { margin: 0 0 8px; color: #536471; font-size: 12px; }
.workflow-prompt-type-popover { left: 22px; bottom: 56px; width: 176px; }
.workflow-prompt-type-popover button, .workflow-prompt-feature-popover button { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; width: 100%; height: 40px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: #0f1419; text-align: left; cursor: pointer; }
.workflow-prompt-type-popover button.is-selected, .workflow-prompt-feature-popover button.is-selected { background: #f1f2f3; }
.workflow-prompt-type-popover button span:last-child, .workflow-prompt-feature-popover button span:last-child { color: #55b8cc; }
.workflow-prompt-model-popover { left: 40px; bottom: 56px; width: 395px; min-height: 178px; }
.workflow-prompt-search { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid rgba(61,176,196,.5); border-radius: 8px; }
.workflow-prompt-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #0f1419; font-size: 13px; }
.workflow-prompt-model-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 230px; overflow-y: auto; }
.workflow-prompt-model-list button { display: grid; grid-template-columns: 80px minmax(0,1fr) auto 18px; align-items: center; min-height: 48px; padding: 7px 10px; border: 0; border-radius: 8px; background: transparent; color: #0f1419; text-align: left; cursor: pointer; }
.workflow-prompt-model-list button:hover, .workflow-prompt-model-list button.is-selected { background: #f5f6f7; }
.workflow-prompt-model-list__provider { color: #536471; font-size: 11px; }
.workflow-prompt-model-list__name { overflow: hidden; font-size: 14px; text-overflow: ellipsis; }
.workflow-prompt-model-list__price { color: #8899a6; font-size: 12px; }
.workflow-prompt-model-list__check { color: #55b8cc; }
.workflow-prompt-model-empty { display: flex; align-items: center; justify-content: center; height: 130px; color: #8899a6; font-size: 13px; }
.workflow-prompt-size-popover--image { left: 172px; bottom: 56px; width: 480px; }
.workflow-prompt-size-popover--video { left: 275px; bottom: 56px; width: 296px; }
.workflow-prompt-ratio-grid { display: grid; gap: 6px; margin-bottom: 14px; padding: 8px; border-radius: 12px; background: #f7f8f8; }
.workflow-prompt-ratio-grid--image { grid-template-columns: repeat(9, 1fr); }
.workflow-prompt-ratio-grid--video { grid-template-columns: repeat(5, 1fr); }
.workflow-prompt-ratio-grid button { display: flex; align-items: center; flex-direction: column; justify-content: center; gap: 5px; height: 48px; padding: 4px; border: 0; border-radius: 9px; background: transparent; color: #536471; font-size: 11px; cursor: pointer; }
.workflow-prompt-ratio-grid button.is-selected { background: #e9ebec; color: #0f1419; }
.workflow-prompt-ratio-shape { display: block; width: 22px; height: 14px; border: 1.6px solid currentColor; border-radius: 2px; }
.workflow-prompt-ratio-shape.is-smart { width: 14px; height: 14px; border-style: dashed; }
.workflow-prompt-ratio-shape.is-wide { width: 24px; height: 12px; }
.workflow-prompt-ratio-shape.is-square { width: 15px; height: 15px; }
.workflow-prompt-ratio-shape.is-portrait { width: 12px; height: 18px; }
.workflow-prompt-ratio-shape.is-tall { width: 10px; height: 20px; }
.workflow-prompt-segmented { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 14px; padding: 4px; border-radius: 12px; background: #f7f8f8; }
.workflow-prompt-segmented button { height: 38px; border: 0; border-radius: 9px; background: transparent; color: #536471; cursor: pointer; }
.workflow-prompt-segmented button.is-selected { background: #eceeef; color: #0f1419; font-weight: 600; }
.workflow-prompt-dimensions { display: grid; grid-template-columns: 22px 1fr 24px 22px 1fr 26px; align-items: center; height: 44px; padding: 0 10px; border-radius: 10px; background: #f7f8f8; color: #8899a6; font-size: 12px; }
.workflow-prompt-dimensions strong { color: #0f1419; text-align: right; }
.workflow-prompt-dimensions__link { color: #55b8cc; text-align: center; }
.workflow-prompt-feature-popover { left: 234px; bottom: 56px; width: 178px; }
.workflow-prompt-feature-popover button small { padding: 2px 5px; border-radius: 4px; background: #55b8cc; color: #fff; font-size: 9px; }
.workflow-prompt-duration-popover { left: 336px; bottom: 56px; width: 405px; }
.workflow-prompt-duration-row { display: grid; grid-template-columns: 1fr 90px; align-items: center; gap: 24px; }
.workflow-prompt-duration-row > input { width: 100%; accent-color: #0f1419; }
.workflow-prompt-duration-row label { display: flex; align-items: center; height: 40px; padding: 0 10px; border-radius: 9px; background: #f1f2f3; }
.workflow-prompt-duration-row label input { width: 52px; border: 0; outline: 0; background: transparent; font-size: 14px; }
.workflow-prompt-duration-row label span { color: #8899a6; }
.workflow-prompt-duration-ticks { display: flex; justify-content: space-between; width: calc(100% - 114px); color: #8899a6; font-size: 10px; }
.workflow-prompt-reference-popover { top: 47px; left: 92px; width: 320px; max-height: 300px; }
.workflow-prompt-reference-popover .workflow-prompt-popover__title span { color: #55b8cc; }
.workflow-prompt-reference-create { display: flex; align-items: center; gap: 12px; width: 100%; height: 48px; padding: 0 14px; border: 0; border-radius: 10px; background: #f1f2f3; color: #0f1419; cursor: pointer; }
.workflow-prompt-reference-create:disabled { opacity: .45; cursor: default; }
.workflow-prompt-reference-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 190px; overflow-y: auto; }
.workflow-prompt-reference-list button { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-height: 48px; padding: 4px 10px; border: 0; border-radius: 9px; background: transparent; color: #0f1419; text-align: left; cursor: pointer; }
.workflow-prompt-reference-list button:hover { background: #f7f8f8; }
.workflow-prompt-reference-list button:disabled { opacity: .55; cursor: default; }
.workflow-prompt-reference-list img, .workflow-prompt-reference-list button > span:first-child { width: 36px; height: 36px; border-radius: 5px; object-fit: cover; }
.workflow-prompt-reference-list button > span:first-child { display: flex; align-items: center; justify-content: center; background: #eef0f2; color: #536471; font-size: 11px; }
.workflow-prompt-reference-list strong { font-size: 13px; font-weight: 500; }
.workflow-prompt-reference-list em { padding: 2px 6px; border-radius: 999px; background: #e8fff8; color: #008d69; font-size: 10px; font-style: normal; }
.workflow-prompt-reference-list small { color: #8899a6; font-size: 11px; }
.workflow-prompt-reference-empty { padding: 26px 0; color: #8899a6; font-size: 12px; text-align: center; }
.workflow-prompt-popover-enter-active, .workflow-prompt-popover-leave-active { transition: opacity .12s, transform .12s; }
.workflow-prompt-popover-enter-from, .workflow-prompt-popover-leave-to { opacity: 0; transform: translateY(4px); }

.workflow-inspiration-backdrop { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(15,20,25,.72); }
.workflow-inspiration-modal { display: flex; flex-direction: column; width: min(992px, calc(100vw - 80px)); height: min(532px, calc(100vh - 80px)); overflow: hidden; border-radius: 14px; background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.28); color: #0f1419; font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif; }
.workflow-inspiration-modal header { display: grid; grid-template-columns: 320px 340px 1fr; align-items: center; gap: 18px; height: 64px; padding: 0 16px; border-bottom: 1px solid #eef0f2; }
.workflow-inspiration-modal header nav { display: flex; padding: 4px; border-radius: 12px; background: #f1f2f3; }
.workflow-inspiration-modal header nav button, .workflow-inspiration-subnav button { height: 32px; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: #536471; cursor: pointer; }
.workflow-inspiration-modal header nav button.is-selected, .workflow-inspiration-subnav button.is-selected { background: #fff; color: #0f1419; box-shadow: 0 1px 4px rgba(15,20,25,.06); }
.workflow-inspiration-modal header label { display: flex; align-items: center; height: 36px; padding: 0 12px; border-radius: 9px; background: #f5f6f7; }
.workflow-inspiration-modal header label input { flex: 1; border: 0; outline: 0; background: transparent; }
.workflow-inspiration-modal header > button { justify-self: end; width: 36px; height: 36px; border: 0; border-radius: 50%; background: transparent; cursor: pointer; }
.workflow-inspiration-subnav { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 16px; }
.workflow-inspiration-subnav button.is-selected { background: #f1f2f3; box-shadow: none; }
.workflow-inspiration-subnav span { margin-left: auto; padding: 7px 12px; border-radius: 9px; background: #f7f8f8; color: #536471; font-size: 12px; }
.workflow-inspiration-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; flex: 1; min-height: 0; padding: 0 16px 14px; overflow-y: auto; }
.workflow-inspiration-grid button { position: relative; display: flex; flex-direction: column; min-height: 238px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 10px; background: #f1f2f3; cursor: pointer; }
.workflow-inspiration-grid button.is-selected { border-color: #55b8cc; }
.workflow-inspiration-grid button img { width: 100%; height: 205px; object-fit: cover; }
.workflow-inspiration-grid button > span { padding: 8px 10px; color: #0f1419; font-size: 12px; text-align: left; }
.workflow-inspiration-grid button > small { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #55b8cc; color: #fff; }
.workflow-inspiration-empty { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: #8899a6; }
.workflow-inspiration-modal footer { display: flex; justify-content: flex-end; gap: 10px; height: 64px; padding: 12px 20px; border-top: 1px solid #eef0f2; }
.workflow-inspiration-modal footer button { min-width: 88px; height: 40px; padding: 0 18px; border: 0; border-radius: 999px; background: #f1f2f3; color: #0f1419; cursor: pointer; }
.workflow-inspiration-modal footer button:last-child { background: #55b8cc; color: #fff; }
.workflow-inspiration-modal footer button:disabled { background: #d8eef2; color: rgba(255,255,255,.8); cursor: default; }
.workflow-inspiration-modal-enter-active, .workflow-inspiration-modal-leave-active { transition: opacity .18s; }
.workflow-inspiration-modal-enter-from, .workflow-inspiration-modal-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .canvas-prompt-input--workflow { width: calc(100vw - 24px); max-width: calc(100vw - 24px); height: auto; min-height: 170px; }
  .canvas-prompt-input__footer { overflow-x: auto; }
  .workflow-prompt-popover { left: 8px !important; right: 8px; width: auto !important; max-width: none; }
  .workflow-inspiration-modal { width: calc(100vw - 24px); height: calc(100vh - 32px); }
  .workflow-inspiration-modal header { grid-template-columns: 1fr 40px; height: auto; padding: 10px; }
  .workflow-inspiration-modal header nav { grid-column: 1 / -1; overflow-x: auto; }
  .workflow-inspiration-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
