<template>
  <div v-if="visible && draft" class="admin-dialog-mask" @click="emit('close')">
    <div class="admin-dialog admin-theme-banner-item-dialog" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">编辑 Banner 项</h3>
          <div class="admin-dialog__desc">维护当前 Banner 的描述文案、图片资源与展示状态。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="emit('close')">×</button>
      </div>

      <div class="admin-form admin-dialog__body">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">键名</label>
            <input v-model.trim="draft.key" class="admin-input" type="text" placeholder="例如：image">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">标题</label>
            <input v-model.trim="draft.title" class="admin-input" type="text" placeholder="Banner 标题">
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">描述文案</label>
            <input v-model.trim="draft.subtitle" class="admin-input" type="text" placeholder="补充当前 Banner 的描述">
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">图片来源</label>
            <select v-model="draft.imageSource" class="admin-input">
              <option value="default">系统默认图</option>
              <option value="custom">自定义图片</option>
            </select>
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">默认图预设</label>
            <select v-model="draft.presetKey" class="admin-input" :disabled="draft.imageSource !== 'default'">
              <option v-for="preset in presetOptions" :key="preset.value" :value="preset.value">
                {{ preset.label }}
              </option>
            </select>
          </div>

          <div class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">Banner 图片地址</label>
            <input
              v-model.trim="draft.imageUrl"
              class="admin-input"
              type="text"
              :disabled="draft.imageSource !== 'custom'"
              :placeholder="draft.imageSource === 'custom' ? '填写当前 Banner 的图片地址' : '当前使用系统默认图，无需填写地址'"
            >
          </div>

          <template v-if="isPrimaryBanner">
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">三层图配置说明</label>
              <div class="admin-form__hint">首个 Banner 保持前台三层图结构，可分别配置背景层、主图层和前景叠加图。</div>
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">背景层图片地址</label>
              <input v-model.trim="draft.backgroundImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的背景层图片地址">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">主图层图片地址</label>
              <input v-model.trim="draft.mainImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的主图层图片地址">
            </div>
            <div class="admin-form__field admin-form__field--full">
              <label class="admin-form__label">前景叠加图地址</label>
              <input v-model.trim="draft.overlayImageUrl" class="admin-input" type="text" placeholder="填写首个 Banner 的前景叠加图地址">
            </div>
          </template>

          <div class="admin-form__field">
            <label class="admin-form__label">发光色</label>
            <input v-model.trim="draft.glowColor" class="admin-input" type="text" placeholder="#2FE3FF">
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-switch-row">
              <input v-model="draft.visible" type="checkbox">
              <span>显示当前 Banner</span>
            </label>
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="emit('close')">取消</button>
          <button class="admin-button admin-button--primary" type="button" @click="emit('submit')">保存 Banner</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SystemHomeBannerItemConfig } from '@/api/system-config'

export interface ThemeBannerItemDialogDraft extends SystemHomeBannerItemConfig {
  index: number
}

const props = defineProps<{
  visible: boolean
  draft: ThemeBannerItemDialogDraft | null
  presetOptions: Array<{ value: SystemHomeBannerItemConfig['presetKey'], label: string }>
}>()

const emit = defineEmits<{
  close: []
  submit: []
}>()

const isPrimaryBanner = computed(() => props.draft?.index === 0)
</script>
