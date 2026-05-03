<template>
  <div class="type-home-select">
    <div class="resize-transition-container" style="width:137.859px">
      <div class="home-type-select-option active-uXUmo8">
        <div class="type-home-select-current-option-label" style="--index:0">{{ currentLabel }}</div>
        <div class="type-home-select-arrow-icon">
          <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z" fill="currentColor"></path>
            </g>
          </svg>
        </div>
      </div>
      <div class="resize-transition-placeholder">
        <div class="home-type-select-option active-uXUmo8">
          <div class="type-home-select-current-option-label" style="--index:0">{{ currentLabel }}</div>
          <div class="type-home-select-arrow-icon">
            <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
              <g>
                <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z" fill="currentColor"></path>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
    <div class="type-home-select-dropdown">
      <div class="type-home-select-dropdown-background"></div>
      <div class="type-home-select-options">
        <div
          v-for="(item, index) in normalizedOptions"
          :key="`${item}-${index}`"
          class="home-type-select-option"
          :class="{ 'active-uXUmo8': item === currentLabel }"
        >
          <div
            class="type-home-select-option-label"
            :class="{ 'active-BOslsm': item === currentLabel }"
            :style="{ '--index': index }"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  currentLabel?: string
  options?: string[]
}>(), {
  currentLabel: 'Agent 模式',
  options: () => ['Agent 模式', '图片生成', '视频生成', '数字人', '动作模仿'],
})

const normalizedOptions = computed(() => {
  const labels = props.options
    .map(item => String(item || '').trim())
    .filter(Boolean)
  return labels.length ? labels : ['Agent 模式']
})

const currentLabel = computed(() => {
  return String(props.currentLabel || '').trim() || normalizedOptions.value[0] || 'Agent 模式'
})
</script>
