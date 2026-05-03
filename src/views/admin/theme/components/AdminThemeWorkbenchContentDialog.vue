<template>
  <div v-if="visible && draft" class="admin-dialog-mask" @click="emit('close')">
    <div class="admin-dialog admin-theme-workbench-content-dialog" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">编辑{{ draft.label }}</h3>
          <div class="admin-dialog__desc">直接维护前台首页右侧工作台的实时展示内容。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="emit('close')">×</button>
      </div>

      <div class="admin-form admin-dialog__body">
        <div class="admin-form__grid">
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-switch-row">
              <input v-model="draft.settings.enabled" type="checkbox">
              <span>{{ visibilityLabel }}</span>
            </label>
          </div>

          <template v-if="draft.blockKey === 'title'">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-switch-row">
                <input v-model="draft.settings.showSiteName" type="checkbox">
                <span>标题中显示站点名称</span>
              </label>
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">标题前半句</label>
              <input v-model.trim="draft.settings.prefixText" class="admin-input" type="text" placeholder="开启你的">
            </div>
            <div class="admin-form__field">
              <label class="admin-form__label">标题后半句</label>
              <input v-model.trim="draft.settings.suffixText" class="admin-input" type="text" placeholder="即刻造梦！">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-switch-row">
                <input v-model="draft.settings.showModeSelectorInTitle" type="checkbox">
                <span>标题中显示模式标签</span>
              </label>
            </div>
          </template>

          <template v-else-if="draft.blockKey === 'generator'">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-switch-row">
                <input v-model="draft.settings.showSiteDescription" type="checkbox">
                <span>显示输入区下方站点说明</span>
              </label>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-switch-row">
                <input v-model="draft.settings.showSubmitButton" type="checkbox">
                <span>显示提交按钮</span>
              </label>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">输入框占位文案</label>
              <input v-model.trim="draft.settings.placeholder" class="admin-input" type="text" placeholder="说说今天想做点什么">
            </div>
          </template>

          <template v-else-if="draft.blockKey === 'task-indicator'">
            <div class="admin-form__field admin-form__field--full">
              <div class="admin-theme-workbench-content-dialog__hint">
                控制首页右侧“任务状态”反馈条的显示，便于运营按阶段打开或关闭即时状态提示。
              </div>
            </div>
          </template>

          <template v-else-if="draft.blockKey === 'banner'">
            <div class="admin-form__field admin-form__field--full">
              <div class="admin-theme-workbench-content-dialog__hint">
                控制首页右侧 Banner 区域的整体显隐。Banner 图层内容仍沿用 Banner 编排数据。
              </div>
            </div>
          </template>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="emit('close')">取消</button>
          <button class="admin-button admin-button--primary" type="button" @click="emit('submit')">保存内容块</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkbenchContentBlockKey } from './AdminThemeFrontHomeHeaderPreview.vue'

export interface WorkbenchContentDialogDraft {
  blockKey: WorkbenchContentBlockKey
  label: string
  settings: {
    enabled: boolean
    showSiteName: boolean
    prefixText: string
    suffixText: string
    showModeSelectorInTitle: boolean
    showSubmitButton: boolean
    showSiteDescription: boolean
    placeholder: string
  }
}

const props = defineProps<{
  visible: boolean
  draft: WorkbenchContentDialogDraft | null
}>()

const emit = defineEmits<{
  close: []
  submit: []
}>()

const visibilityLabel = computed(() => {
  if (!props.draft) {
    return '显示内容块'
  }

  return `显示${props.draft.label}`
})
</script>

<style scoped>
.admin-theme-workbench-content-dialog__hint {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-secondary, #64748b);
  font-size: 13px;
  line-height: 1.7;
}
</style>
