<template>
  <div class="responsive-container-tUSXzO">
    <div class="content-wBQJ0B ai-generated-record-content-of3rLk">
      <div class="agentic-record-uRPmpt">
        <div class="agentic-record-content-Bgk_hF completed-WGVjke">
          <div class="user-message-AAqI02">
            <div class="bubble">
              <div class="context-menu-trigger-ZXpguB">
                <div class="prompt-value-container-lIP4pF">
                  <span class="prompt-value-container-KCtKOf">
                    <span>{{ run.query }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="process-group completed-Mr7mg1" :class="{ 'expanded-bG3kBU': isProcessGroupExpanded }">
            <div class="header-fE7Yzl" @click="toggleProcessGroup">
              <div class="header-left-OUNZfc">
                <div class="chevron-wrapper" :class="{ 'collapsed-yhY7l2': !isProcessGroupExpanded }">
                  <svg width="14" height="14" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="chevron-icon-OYUM9U">
                    <g>
                      <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z" fill="currentColor"></path>
                    </g>
                  </svg>
                </div>
                <div class="title-lQ3lE5">{{ groupTitle }}</div>
              </div>
            </div>
            <div class="content-wrapper-WwWXWE" :class="{ 'collapsed-yhY7l2': !isProcessGroupExpanded }">
              <div class="content-e0iN2u">
                <div class="visible-messages-wrapper">
                  <div
                    v-for="section in contentSections"
                    :key="section.key"
                    class="message-item"
                  >
                    <div
                      class="connector"
                      :class="{ 'sf-hidden': section.kind === 'skill' }"
                    ></div>
                    <div class="message-collapse-wrapper-zmpysd">
                      <div class="node-viewport-KqQuYn">
                        <div
                          :class="section.kind === 'skill'
                            ? 'activate-skill-message'
                            : ['reasoning-message', 'reasoning-message-expanded', `reasoning-tone-${section.tone || 'default'}`]"
                          class="node-enter-g30LTv"
                        >
                          <template v-if="section.kind === 'skill'">
                            <div class="icon-LYdgSF">
                              <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                  <path data-follow-fill="currentColor" d="m20.498 8.652-.09.091a3.377 3.377 0 0 1-4.754 0 3.336 3.336 0 0 1 0-4.74l.435-.432a5.367 5.367 0 0 0-.868-.071c-2.923 0-5.28 2.35-5.28 5.234 0 .754.161 1.469.449 2.114a1 1 0 0 1-.21 1.117l-6.284 6.238a1.335 1.335 0 0 0 0 1.9c.534.529 1.4.529 1.934 0l6.34-6.294.112-.096a1 1 0 0 1 .964-.123 5.302 5.302 0 0 0 1.975.379c2.922 0 5.279-2.35 5.279-5.235l-.002-.082Zm2.002.082c0 4.002-3.266 7.235-7.28 7.235a7.323 7.323 0 0 1-2.083-.302l-5.898 5.856a3.376 3.376 0 0 1-4.752 0 3.336 3.336 0 0 1 0-4.739l5.82-5.78a7.187 7.187 0 0 1-.366-2.27c0-4.002 3.266-7.234 7.28-7.234 1.135 0 2.213.26 3.174.723a1 1 0 0 1 .27 1.61l-1.601 1.59a1.335 1.335 0 0 0 0 1.9c.533.53 1.4.53 1.934 0l1.426-1.416.096-.084a1 1 0 0 1 1.548.452c.28.77.432 1.598.432 2.46Z" fill="currentColor"></path>
                                </g>
                              </svg>
                            </div>
                            <span class="text-ZkLTVV">{{ section.label }}</span>
                          </template>
                          <template v-else>
                            <div class="header-k72pQ0 clickable-DpW_Qi" :class="`header-tone-${section.tone || 'default'}`" @click="toggleSection(section.key)">
                              <div class="header-main">
                                <span class="status-icon">
                                  <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                    <g>
                                      <path data-follow-fill="currentColor" d="M14.012 20a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2h4ZM12 1.451a8 8 0 0 1 8 8 7.99 7.99 0 0 1-3.76 6.781 2.999 2.999 0 0 1-2.99 2.769h-2.5a3 3 0 0 1-2.99-2.769A7.99 7.99 0 0 1 4 9.452a8 8 0 0 1 8-8Zm0 2a6 6 0 0 0-2.785 11.314 1 1 0 0 1 .535.885v.351a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-.35a1 1 0 0 1 .535-.886A6 6 0 0 0 12 3.452Z" fill="currentColor"></path>
                                    </g>
                                  </svg>
                                </span>
                                <span class="title-zHQmQJ">{{ section.label }}</span>
                                <span
                                  v-if="section.tone && section.tone !== 'default'"
                                  class="section-tone-badge"
                                  :class="`section-tone-badge-${section.tone}`"
                                >
                                  {{ sectionToneText(section.tone) }}
                                </span>
                              </div>
                              <button type="button" class="header-toggle" :aria-expanded="isSectionExpanded(section.key)">
                                <svg width="14" height="14" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="toggle-icon">
                                  <g>
                                    <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z" fill="currentColor"></path>
                                  </g>
                                </svg>
                              </button>
                            </div>
                            <div
                              class="body-wrapper"
                              :class="{ 'collapsed-yhY7l2': !isSectionExpanded(section.key) }"
                              :style="{ maxHeight: isSectionExpanded(section.key) ? getSectionBodyHeight(section.key) : '0px' }"
                            >
                              <div class="body-KixLFC" :ref="(el) => setSectionBodyRef(section.key, el)">
                                <div class="content-dherTv">
                                  <div v-if="section.taskPlanItems?.length" class="task-plan-grid">
                                    <div
                                      v-for="item in section.taskPlanItems"
                                      :key="item.key"
                                      class="task-plan-card"
                                      :class="`task-plan-status-${item.status}`"
                                    >
                                      <div class="task-plan-card-header">
                                        <div class="task-plan-index">{{ item.index }}</div>
                                        <div class="task-plan-badge" :class="`task-plan-badge-${item.status}`">
                                          {{ taskPlanStatusText(item.status) }}
                                        </div>
                                      </div>
                                      <div class="task-plan-text">{{ item.text }}</div>
                                    </div>
                                  </div>
                                  <div v-for="paragraph in section.paragraphs" :key="paragraph.key">
                                    {{ paragraph.text }}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="showOutputSection" class="media-output-section">
            <div v-if="resultTitle" class="last-assistant-output">
              <div class="node-viewport-YXsYbA">
                <div class="node-enter-ww1GBC">
                  <div class="assistant-message-text-XR8fHP">
                    <div class="markdown-render-e1saKl markdown-render-NMg4vx">
                      <p>{{ resultTitle }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="summaryParagraphs.length" class="last-assistant-output">
              <div class="node-viewport-YXsYbA">
                <div class="node-enter-ww1GBC">
                  <div class="assistant-message-text-XR8fHP">
                    <div class="markdown-render-e1saKl markdown-render-NMg4vx">
                      <p v-for="paragraph in summaryParagraphs" :key="paragraph.key">
                        {{ paragraph.text }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="mediaStatusText" class="media-group-placeholder">
              <span class="icon-wrap-QQV86C">
                <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M16.326 4.72H7.674A2.954 2.954 0 0 0 4.72 7.674v8.652c0 .054.001.108.004.162l3.509-3.508a2.954 2.954 0 0 1 4.03-.138l6.262 5.457c.47-.523.755-1.215.755-1.973V7.674a2.954 2.954 0 0 0-2.954-2.954Zm2.798 15.658a4.919 4.919 0 0 0 2.126-4.052V7.674a4.924 4.924 0 0 0-4.924-4.924H7.674A4.924 4.924 0 0 0 2.75 7.674v8.652a4.924 4.924 0 0 0 4.924 4.924h8.652a4.901 4.901 0 0 0 2.798-.872Zm-2.489-1.114-5.666-4.937a.985.985 0 0 0-1.344.046l-4.041 4.04a2.945 2.945 0 0 0 2.09.867h8.652c.104 0 .208-.005.31-.016ZM14.078 8.401a1.532 1.532 0 1 1 3.064 0 1.532 1.532 0 0 1-3.064 0Z" fill="currentColor"></path>
                  </g>
                </svg>
              </span>
              <span class="status-text">{{ mediaStatusText }}</span>
            </div>
            <div v-if="showImageRecordSection" class="image-record">
              <div class="record-header">
                <div class="record-header-content">
                  <div class="prompt-suffix-labels-wrapper" style="--line-height:24px;--padding-top:4px">
                    <div class="prompt-suffix-labels" style="--line-height:24px;--padding-top:4px">
                      <div class="prompt-suffix-labels-content">
                        <span class="prompt-P_8aF8">
                          <span class="prompt-value-container-KCtKOf">
                            <span>{{ resultHeaderText }}</span>
                          </span>
                        </span>
                        <span class="labels" style="visibility:visible">
                          <span class="label-lhnDlt">{{ skillLabel }}</span>
                          <span class="label-lhnDlt">{{ workflowLabel }}</span>
                          <span class="label-lhnDlt">{{ imageCountLabel }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="record-box-wrapper">
                <div class="image-record-content">
                  <div class="responsive-image-grid">
                    <div
                      v-for="slot in imageDisplaySlots"
                      :key="slot.key"
                      class="image-card-wrapper landscape"
                      style="--aspect-ratio:1"
                    >
                      <div class="image-record-item">
                        <div class="context-menu-trigger-WJ6VDZ">
                          <div class="slot-card-container-gulhrr image-card-container-dFemyw">
                            <div class="content-container-z0JOWv">
                              <div
                                class="image-card-container-qy7ui4"
                                :class="{ 'placeholder-card': slot.kind === 'placeholder' }"
                                role="button"
                                tabindex="0"
                                aria-disabled="false"
                                aria-roledescription="draggable"
                              >
                                <div
                                  v-if="slot.kind === 'image'"
                                  class="container-bG3PQ9 image-GnB1sY"
                                >
                                  <div style="transition:opacity 300ms;opacity:1">
                                    <img
                                      class="image-TLmgkP"
                                      :src="slot.image!.imageSrc"
                                      :alt="slot.image!.promptText || slot.image!.id"
                                      data-apm-action="ai-generated-image-record-card"
                                      draggable="false"
                                      fetchpriority="high"
                                      loading="lazy"
                                    >
                                  </div>
                                </div>
                                <div v-else class="placeholder-card-inner">
                                  <div class="placeholder-shimmer"></div>
                                  <div class="placeholder-caption">结果生成中</div>
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
            </div>
          </div>

          <div v-if="showNotice" class="ai-generated-notice-PjZsIx">
            以上内容由 AI 生成
            <div class="divider-mrF2Mr"></div>
            <div v-if="costText" class="costed-credit">{{ costText }}</div>
          </div>
          <div v-if="showActions" class="record-bottom-slots-wtfgFX">
            <div>
              <button
                type="button"
                class="card-bottom-button-view-hp7ig5"
                :class="{ 'disabled-udOpi6': !isRunning }"
                style="--right-padding:14px"
                @click="handlePrimaryAction"
              >
                <div class="icon-csSFJU">
                  <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                    <g>
                      <path
                        v-if="isRunning"
                        data-follow-fill="currentColor"
                        d="M8 7.5A1.5 1.5 0 0 1 9.5 6h5A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 16.5v-9Z"
                        fill="currentColor"
                      ></path>
                      <path
                        v-else
                        data-follow-fill="currentColor"
                        d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                        clip-rule="evenodd"
                        fill-rule="evenodd"
                        fill="currentColor"
                      ></path>
                    </g>
                  </svg>
                </div>
                <div>{{ primaryActionText }}</div>
              </button>
            </div>
            <div v-if="!isRunning">
              <div class="card-icon-button-oLA7f1">
                <div class="icon-csSFJU">
                  <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                    <g>
                      <path data-follow-fill="currentColor" d="M7.06 10.154c-.2 0-.392.03-.583.059.062-.209.126-.42.228-.61.102-.277.262-.517.42-.758.134-.261.368-.438.54-.661.18-.217.426-.362.621-.542.191-.189.442-.283.64-.416.209-.12.39-.251.584-.314l.484-.199a.535.535 0 0 0 .313-.624l-.19-.757a.556.556 0 0 0-.669-.406l-.618.154c-.243.045-.503.168-.792.28-.285.127-.615.213-.922.418-.309.196-.665.359-.979.62-.304.271-.671.505-.942.849-.296.321-.589.659-.816 1.043-.263.366-.441.768-.63 1.165-.17.398-.308.804-.42 1.199a10.833 10.833 0 0 0-.344 2.187c-.03.644-.013 1.18.025 1.568.013.182.038.36.056.483l.023.15.023-.005a4.038 4.038 0 1 0 3.948-4.883Zm9.871 0c-.2 0-.392.03-.583.059.062-.209.125-.42.228-.61.102-.277.262-.517.42-.758.133-.261.367-.438.54-.661.18-.217.426-.362.62-.542.192-.189.442-.283.641-.416.209-.12.39-.251.584-.314l.483-.199a.535.535 0 0 0 .314-.624l-.19-.757a.556.556 0 0 0-.67-.406l-.617.154c-.244.045-.503.168-.792.28-.284.128-.615.213-.922.419-.31.195-.665.359-.98.62-.304.27-.67.505-.942.848-.296.321-.588.659-.815 1.043-.263.366-.442.768-.63 1.165-.17.398-.308.804-.42 1.199a10.832 10.832 0 0 0-.345 2.187c-.03.644-.012 1.18.025 1.568.014.182.039.36.057.483l.022.15.024-.005a4.038 4.038 0 1 0 3.948-4.883Z" fill="currentColor"></path>
                    </g>
                  </svg>
                </div>
              </div>
              <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
            </div>
            <div class="operation-button-JXPApH normal-button-MlbO4E">
              <span class="icon-B0sOj2">
                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path data-follow-fill="currentColor" d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
                  </g>
                </svg>
              </span>
            </div>
            <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AgentImageResult, AgentRunState, AgentProcessSection, AgentProcessTaskItem } from '@/types/agent'
import { getAgentSkillConfig } from '@/config/agentSkills'
import './generate-agent-record.css'

const props = defineProps<{
  run: AgentRunState
  errorText?: string
}>()

const emit = defineEmits<{
  stop: []
}>()

interface ContentSection {
  key: string
  kind: 'skill' | 'reasoning'
  label: string
  tone?: 'default' | 'warning' | 'running' | 'success'
  taskPlanItems?: Array<{
    key: string
    index: string
    text: string
    status: AgentProcessTaskItem['status']
  }>
  paragraphs: Array<{
    key: string
    text: string
  }>
}

interface SummaryParagraph {
  key: string
  text: string
}

interface ImageDisplaySlot {
  key: string
  kind: 'image' | 'placeholder'
  image?: AgentImageResult
}

const isProcessGroupExpanded = ref(true)
const collapsedSectionKeys = ref<Set<string>>(new Set())
const sectionBodyRefs = ref<Record<string, HTMLElement | null>>({})

const getSectionTone = (section: AgentProcessSection): ContentSection['tone'] => {
  if (section.key === 'parameter-adjustment') return 'warning'
  if (section.key === 'submission-log-attempt-2') return 'running'
  if (section.key === 'submission-log-attempt-1' && section.paragraphs?.some(text => text.includes('不支持 4K') || text.includes('首轮提交失败'))) {
    return 'warning'
  }
  if (section.key === 'completion-log') return 'success'
  return 'default'
}

// 新版参考页使用“技能激活消息 + reasoning 分组”结构，这里按该层级映射数据。
const contentSections = computed<ContentSection[]>(() => {
  if (props.run.processSections?.length) {
    const visibleSections = props.run.processSections
      .filter((section) => {
        if (section.kind === 'skill') return Boolean(section.label)
        return Boolean(section.label && section.paragraphs?.some(text => text.trim()))
      })

    return visibleSections.map((section: AgentProcessSection) => ({
      key: section.key,
      kind: section.kind,
      label: section.label,
      tone: getSectionTone(section),
      taskPlanItems: section.label.startsWith('任务计划')
        ? (section.taskItems?.length
            ? section.taskItems.map((item, index) => ({
                key: `${section.key}-task-${item.id}`,
                index: String(index + 1),
                text: item.title,
                status: item.status,
              }))
            : (section.paragraphs || [])
                .map((text, index) => {
                  const matched = text.match(/^(\d+)\.\s*(.+)$/)
                  if (!matched) return null
                  return {
                    key: `${section.key}-task-${index}`,
                    index: matched[1],
                    text: matched[2],
                    status: 'pending' as const,
                  }
                })
                .filter(Boolean) as Array<{ key: string, index: string, text: string, status: AgentProcessTaskItem['status'] }>)
        : [],
      paragraphs: (section.paragraphs || [])
        .filter(text => !(section.label.startsWith('任务计划') && /^\d+\.\s*/.test(text)))
        .map((text, index) => ({
          key: `${section.key}-${index}`,
          text,
        })),
    }))
  }

  const thinkingSteps = props.run.steps.filter(step => step.id !== 'step-finish')
  const sections: ContentSection[] = []
  const completedSteps = thinkingSteps.filter(step => step.status === 'completed')
  const activeSteps = thinkingSteps.filter(step => step.status === 'running' || step.status === 'pending')

  sections.push({
    key: 'skill-activated',
    kind: 'skill',
    label: `使用技能：${skillLabel.value}`,
    paragraphs: [],
  })

  completedSteps.forEach((step) => {
    sections.push({
      key: `${step.id}-completed`,
      kind: 'reasoning',
      label: step.title,
      paragraphs: step.description
        ? [{ key: `${step.id}-completed-description`, text: step.description }]
        : [],
    })
  })

  if (activeSteps.length && !props.errorText) {
    activeSteps.forEach((step) => {
      sections.push({
        key: `${step.id}-active`,
        kind: 'reasoning',
        label: step.title,
        paragraphs: [
          ...(step.description
            ? [{ key: `${step.id}-active-description`, text: step.description }]
            : []),
        ],
      })
    })
  }

  if (props.errorText) {
    sections.push({
      key: 'task-error',
      kind: 'reasoning',
      label: '执行失败',
      paragraphs: [
        {
          key: 'task-error-text',
          text: props.errorText,
        },
      ],
    })
  }

  return sections
})

const images = computed<AgentImageResult[]>(() => props.run.result?.images || [])
const expectedImageCount = computed(() => props.run.result?.expectedImageCount || images.value.length)
const placeholderCount = computed(() => {
  if (!isRunning.value) return 0
  return Math.max(expectedImageCount.value - images.value.length, 0)
})
const imageDisplaySlots = computed<ImageDisplaySlot[]>(() => {
  const imageSlots = images.value.map((image) => ({
    key: image.id,
    kind: 'image' as const,
    image,
  }))
  const placeholderSlots = Array.from({ length: placeholderCount.value }, (_, index) => ({
    key: `placeholder-${index + 1}`,
    kind: 'placeholder' as const,
  }))
  return [...imageSlots, ...placeholderSlots]
})
const summaryParagraphs = computed<SummaryParagraph[]>(() => {
  const summary = props.run.result?.summary?.trim()
  if (!summary) return []

  return summary
    .split(/\n{2,}/)
    .map(text => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      key: `summary-${index}`,
      text,
    }))
})
const resultTitle = computed(() => props.run.result?.title?.trim() || '')
const resultHeaderText = computed(() => resultTitle.value || props.run.query)
const skillLabel = computed(() => getAgentSkillConfig(props.run.skill).label)
const workflowLabel = computed(() => {
  if (props.run.skill === 'story-short') return '剧情分镜'
  if (props.run.skill === 'marketing-video') return '图生视频'
  if (props.run.skill === 'ecommerce-pack') return '单图生成'
  if (props.run.skill === 'poster-design') return '单图生成'
  if (props.run.skill === 'brand-design') return '品牌视觉'
  return 'Agent 结果'
})
const imageCountLabel = computed(() => `${expectedImageCount.value || images.value.length} 张`)
const groupTitle = computed(() => `${skillLabel.value} 执行过程`)
// 这里只展示后端或任务结果明确返回的真实积分，避免继续展示前端写死的假消耗。
const costText = computed(() => {
  const pointCost = Math.max(0, Number(props.run.result?.pointCost || 0))
  if (pointCost <= 0) return ''
  return `本次消耗 ${pointCost} 积分`
})
const mediaStatusText = computed(() => {
  if (!expectedImageCount.value) return ''

  if (props.run.status === 'stopped') {
    return `(${images.value.length}/${expectedImageCount.value}) 已停止生成`
  }

  if (images.value.length >= expectedImageCount.value) {
    return `(${expectedImageCount.value}/${expectedImageCount.value}) 图片生成完成`
  }

  if ((props.run.status === 'thinking' || props.run.status === 'running') && images.value.length > 0) {
    return `(${images.value.length}/${expectedImageCount.value}) 图片生成中`
  }

  if ((props.run.status === 'thinking' || props.run.status === 'running') && images.value.length === 0) {
    return `(0/${expectedImageCount.value}) 图片生成中`
  }

  if (props.run.status === 'completed') {
    return `(${images.value.length}/${expectedImageCount.value}) 图片生成完成`
  }

  if (props.run.status === 'error') {
    return '图片生成失败'
  }

  return ''
})

const isRunning = computed(() => props.run.status === 'thinking' || props.run.status === 'running')
const primaryActionText = computed(() => (isRunning.value ? '停止生成' : '重新生成'))

const showNotice = computed(() => props.run.status === 'completed' || props.run.status === 'error' || props.run.status === 'stopped')
const showOutputSection = computed(() => {
  const outputVisible = props.run.result?.outputVisible
  if (!outputVisible) return false
  return summaryParagraphs.value.length > 0 || images.value.length > 0 || expectedImageCount.value > 0
})
const showImageRecordSection = computed(() => imageDisplaySlots.value.length > 0)

const showActions = computed(() => isRunning.value || props.run.status === 'completed' || props.run.status === 'stopped')

const handlePrimaryAction = () => {
  if (!isRunning.value) return
  emit('stop')
}

const taskPlanStatusText = (status: AgentProcessTaskItem['status']) => {
  if (status === 'running') return '执行中'
  if (status === 'generated') return '已生成'
  if (status === 'completed') return '已完成'
  if (status === 'error') return '需重试'
  return '待执行'
}

const sectionToneText = (tone: ContentSection['tone']) => {
  if (tone === 'warning') return '已修正'
  if (tone === 'running') return '第 2 轮'
  if (tone === 'success') return '已完成'
  return ''
}

const isSectionExpanded = (key: string) => !collapsedSectionKeys.value.has(key)

const toggleSection = (key: string) => {
  const next = new Set(collapsedSectionKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  collapsedSectionKeys.value = next
}

const toggleProcessGroup = () => {
  isProcessGroupExpanded.value = !isProcessGroupExpanded.value
}

const setSectionBodyRef = (key: string, el: any) => {
  sectionBodyRefs.value[key] = el as HTMLElement | null
}

const getSectionBodyHeight = (key: string) => {
  const el = sectionBodyRefs.value[key]
  return el ? `${el.scrollHeight}px` : '0px'
}
</script>
