<template>
	<div ref="mountRef" class="cutia-root cutia-fullscreen-mount"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import { createElement } from 'react'
import { useRoute } from 'vue-router'
import { VideoEditor } from '@cutia/VideoEditor'

const route = useRoute()
const mountRef = ref<HTMLElement>()
let root: Root | null = null

// POC：URL 上没传 projectId 时用一个固定的临时 id
const projectId = computed(
	() => (route.query.projectId as string | undefined) ?? 'poc-project',
)

onMounted(() => {
	if (!mountRef.value) return
	root = createRoot(mountRef.value)
	renderEditor()
})

watch(projectId, () => renderEditor())

function renderEditor() {
	root?.render(createElement(VideoEditor, { projectId: projectId.value }))
}

onBeforeUnmount(() => {
	root?.unmount()
	root = null
})
</script>

<style scoped>
.cutia-root {
	isolation: isolate;
}

/* 全屏覆盖 Vue 父容器高度限制：Vue 主入口 html/body/#app 高度均为 auto，
 * router-view 容器无显式高度，导致 React 子树即使用 h-screen 也被父级
 * overflow:hidden 截断（实测仅可见 ~200px）。POC 编辑器期望全屏，直接 fixed 脱流。
 */
.cutia-fullscreen-mount {
	position: fixed;
	inset: 0;
	z-index: 10;
}
</style>
