<script setup lang="ts">
/**
 * 全屏阻塞式 loading 遮罩
 *
 * 订阅 loadingStore.isLoading('blocking')：
 *   - 出现时阻断鼠标、键盘事件
 *   - 居中展示 spinner + 文案（文案来自 loadingStore.getText('blocking')）
 *   - 使用 Transition 淡入淡出
 *
 * 用法：在异步动作中传入 `globalKey: 'blocking'` + 可选 `globalText`：
 *   const { run } = useAsyncAction(saveWorkflow, {
 *     globalKey: 'blocking',
 *     globalText: '正在保存…',
 *   })
 */
import { computed } from 'vue'
import { useLoadingStore } from '@/stores/loading'
import WfSpinner from './WfSpinner.vue'

const BLOCKING_KEY = 'blocking'

const { isLoading, getText } = useLoadingStore()

const visible = computed(() => isLoading(BLOCKING_KEY))
const text = computed(() => getText(BLOCKING_KEY))
</script>

<template>
  <Transition name="wf-overlay">
    <div
      v-if="visible"
      class="wf-global-loading-overlay"
      role="alert"
      aria-busy="true"
      aria-live="assertive"
      @click.stop
      @wheel.stop
      @touchmove.stop
      @keydown.stop
    >
      <div class="wf-global-loading-card">
        <WfSpinner :size="28" :stroke="2.4" />
        <span v-if="text" class="wf-global-loading-text">{{ text }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.wf-global-loading-overlay {
  position: fixed;
  inset: 0;
  /*
   * 必须 < ElConfigProvider 配置的 30000（element-plus 基线），
   * 否则 ElMessage / ElNotification 会被遮罩盖住、被 backdrop-filter 模糊。
   * 同时需要 > 项目内常规弹窗 z-index（LoginModal 等约 1000+），以便登录时盖住表单。
   */
  z-index: 29000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 15, 18, 0.5);
  backdrop-filter: blur(2px);
  pointer-events: all;
}

.wf-global-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 28px;
  border-radius: 12px;
  background: var(--canvas-float-block-default, rgba(32, 33, 39, 0.96));
  backdrop-filter: blur(20px);
  border: 0.5px solid var(--stroke-tertiary, rgba(255, 255, 255, 0.12));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  color: var(--text-primary, #e0f5ff);
  min-width: 140px;
}

.wf-global-loading-text {
  font-size: 13px;
  letter-spacing: 0.2px;
}

.wf-overlay-enter-active,
.wf-overlay-leave-active {
  transition: opacity 0.18s ease;
}

.wf-overlay-enter-from,
.wf-overlay-leave-to {
  opacity: 0;
}
</style>
