<template>
  <section class="mx-auto flex w-full flex-1 max-w-6xl flex-col items-center justify-center gap-8 px-4 pb-6 text-center md:px-6 md:pb-10">
    <div class="flex w-fit flex-col items-center gap-3 lg:flex-row lg:items-end lg:gap-4">
      <InstallSplitText
        text="Hello,"
        tag="span"
        class-name="text-5xl font-bold leading-none text-[var(--text-primary)] md:text-7xl lg:text-[88px]"
        :stagger-ms="100"
        :start-delay-ms="0"
        :duration-ms="600"
        preset="power3"
        :on-complete="handleHelloComplete"
      />
      <InstallSplitText
        text="Welcome to"
        tag="span"
        class-name="text-5xl font-bold leading-none text-[var(--text-primary)] md:text-7xl lg:text-[88px]"
        :stagger-ms="100"
        :start-delay-ms="900"
        :duration-ms="600"
        preset="power3"
        :on-complete="handleWelcomeComplete"
      />
      <InstallSplitText
        :text="`${siteName}!`"
        tag="span"
        class-name="text-5xl font-bold leading-none text-[var(--brand-main-default)] md:text-7xl lg:text-[88px]"
        :stagger-ms="100"
        :start-delay-ms="2000"
        :duration-ms="600"
        preset="bounce"
        :on-complete="handleBrandComplete"
      />
    </div>

    <p
      :class="[
        'max-w-3xl px-4 text-center text-base leading-8 text-[var(--text-secondary)] transition-all duration-700 delay-150 ease-out',
        descriptionVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      ]"
    >
      强大的开源智能创作平台，点击下方开始安装，快速开始您的智能创作之旅
    </p>

    <div
      :class="[
        'flex items-center justify-center gap-4 transition-all duration-700 delay-300 ease-out max-md:w-full max-md:flex-col max-md:items-stretch',
        actionVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
      ]"
    >
      <InstallActionButton @click="$emit('home')">
        访问文档
        <template #icon>
          <el-icon><TopRight /></el-icon>
        </template>
      </InstallActionButton>
      <InstallActionButton variant="primary" @click="$emit('start')">
        开始安装
        <template #icon>
          <el-icon><Right /></el-icon>
        </template>
      </InstallActionButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Right, TopRight } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'
import InstallActionButton from './InstallActionButton.vue'
import InstallSplitText from './InstallSplitText.vue'

const props = defineProps<{
  siteName: string
}>()

defineEmits<{
  start: []
  home: []
}>()

const descriptionVisible = ref(false)
const actionVisible = ref(false)
const hasHelloCompleted = ref(false)
const hasWelcomeCompleted = ref(false)
const hasBrandCompleted = ref(false)

const revealDescriptionAndAction = () => {
  if (!hasBrandCompleted.value) {
    return
  }

  window.setTimeout(() => {
    descriptionVisible.value = true
  }, 120)

  window.setTimeout(() => {
    actionVisible.value = true
  }, 260)
}

const handleHelloComplete = () => {
  hasHelloCompleted.value = true
}

const handleWelcomeComplete = () => {
  hasWelcomeCompleted.value = true
}

const handleBrandComplete = () => {
  hasBrandCompleted.value = true
  revealDescriptionAndAction()
}

onMounted(() => {
  requestAnimationFrame(() => {
    descriptionVisible.value = false
    actionVisible.value = false
  })
})
</script>
