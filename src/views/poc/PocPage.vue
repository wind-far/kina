<template>
	<div ref="mountRef" class="cutia-root h-screen w-screen"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { useRouter } from 'vue-router'
import { HelloReact } from '@cutia/poc/HelloReact'

const router = useRouter()
const mountRef = ref<HTMLElement>()
let root: Root | null = null

onMounted(() => {
	if (!mountRef.value) return
	root = createRoot(mountRef.value)
	root.render(
		createElement(HelloReact, {
			from: 'Vue PocPage.vue',
			onExit: () => router.push('/'),
		}),
	)
})

onBeforeUnmount(() => {
	root?.unmount()
	root = null
})
</script>

<style scoped>
.cutia-root {
	isolation: isolate;
}
</style>
