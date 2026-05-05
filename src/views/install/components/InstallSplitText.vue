<template>
  <component
    :is="tag"
    :class="wrapperClass"
    :style="{ textAlign }"
  >
    <span
      v-for="(char, index) in characters"
      :key="`${text}-${index}`"
      :ref="setCharacterRef"
      class="inline-block whitespace-pre opacity-0 will-change-transform"
      :style="initialCharacterStyle"
    >
      {{ char === ' ' ? '\u00A0' : char }}
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref } from 'vue'

type AnimationPreset = 'power3' | 'bounce'
type TagName = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'

const props = withDefaults(defineProps<{
  text: string
  className?: string
  staggerMs?: number
  startDelayMs?: number
  durationMs?: number
  preset?: AnimationPreset
  tag?: TagName
  textAlign?: 'left' | 'center' | 'right'
  onComplete?: () => void
}>(), {
  className: '',
  staggerMs: 100,
  startDelayMs: 0,
  durationMs: 600,
  preset: 'power3',
  tag: 'span',
  textAlign: 'center',
  onComplete: undefined,
})

const characterRefs = ref<HTMLElement[]>([])
const animations = ref<Animation[]>([])

const characters = computed(() => Array.from(props.text))
const wrapperClass = computed(() => `inline-block w-fit whitespace-nowrap align-bottom ${props.className}`.trim())
const initialCharacterStyle = computed(() => {
  return props.preset === 'bounce'
    ? 'transform: translateY(40px) scale(0.96);'
    : 'transform: translateY(40px);'
})

const setCharacterRef = (element: Element | import('vue').ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) {
    characterRefs.value.push(element)
  }
}

const clearAnimations = () => {
  animations.value.forEach(animation => animation.cancel())
  animations.value = []
}

const clearCharacterRefs = () => {
  characterRefs.value = []
}

const buildKeyframes = (preset: AnimationPreset): Keyframe[] => {
  if (preset === 'bounce') {
    return [
      { opacity: 0, transform: 'translateY(40px) scale(0.975)', offset: 0 },
      { opacity: 0.92, transform: 'translateY(-8px) scale(1.018)', offset: 0.62 },
      { opacity: 1, transform: 'translateY(3px) scale(0.997)', offset: 0.8 },
      { opacity: 1, transform: 'translateY(-1px) scale(1.003)', offset: 0.92 },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 },
    ]
  }

  return [
    { opacity: 0, transform: 'translateY(40px)', offset: 0 },
    { opacity: 1, transform: 'translateY(6px)', offset: 0.75 },
    { opacity: 1, transform: 'translateY(0)', offset: 1 },
  ]
}

const buildAnimationOptions = (index: number): KeyframeAnimationOptions => {
  return {
    duration: props.durationMs,
    delay: props.startDelayMs + index * props.staggerMs,
    easing: props.preset === 'bounce'
      ? 'cubic-bezier(0.22, 1, 0.36, 1)'
      : 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    fill: 'forwards',
  }
}

const playAnimation = async () => {
  if (!props.text) {
    return
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    await (document.fonts.ready.catch(() => null))
  }

  await nextTick()

  const keyframes = buildKeyframes(props.preset)
  const nextAnimations: Animation[] = []

  characterRefs.value.forEach((element, index) => {
    element.style.opacity = '0'
    element.style.transform = props.preset === 'bounce'
      ? 'translateY(40px) scale(0.975)'
      : 'translateY(40px)'

    const animation = element.animate(keyframes, buildAnimationOptions(index))
    nextAnimations.push(animation)
  })

  animations.value = nextAnimations

  const lastAnimation = nextAnimations[nextAnimations.length - 1]
  if (lastAnimation) {
    lastAnimation.onfinish = () => {
      props.onComplete?.()
    }
  }
}

onMounted(async () => {
  await nextTick()
  await playAnimation()
})

onBeforeUpdate(() => {
  clearCharacterRefs()
})

onBeforeUnmount(() => {
  clearAnimations()
  clearCharacterRefs()
})
</script>
