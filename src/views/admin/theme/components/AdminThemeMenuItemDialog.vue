<template>
  <div v-if="visible && draft" class="admin-dialog-mask" @click="emit('close')">
    <div class="admin-dialog admin-layout-menu-dialog" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">编辑菜单项</h3>
          <div class="admin-dialog__desc">在当前主题工作台里直接维护菜单标题、图标、跳转和显示状态。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="emit('close')">×</button>
      </div>

      <div class="admin-form admin-dialog__body">
        <div class="admin-form__grid">
          <div class="admin-form__field">
            <label class="admin-form__label">标题</label>
            <input v-model.trim="draft.title" class="admin-input" type="text" placeholder="菜单标题">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">键名</label>
            <input v-model.trim="draft.key" class="admin-input" type="text" placeholder="例如：home">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">分区</label>
            <select v-model="draft.section" class="admin-input">
              <option value="top">顶部</option>
              <option value="center">中部</option>
              <option value="bottom">底部</option>
            </select>
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">排序值</label>
            <input v-model.number="draft.sortOrder" class="admin-input" type="number" min="0" max="9999" step="10">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">图标来源</label>
            <select v-model="draft.iconSource" class="admin-input">
              <option value="default">使用默认</option>
              <option value="custom">自行上传</option>
            </select>
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">默认图标键</label>
            <input
              v-model.trim="draft.icon"
              class="admin-input"
              type="text"
              placeholder="例如：home / generate / asset"
              :disabled="draft.iconSource === 'custom'"
            >
          </div>

          <div v-if="draft.iconSource === 'custom'" class="admin-form__field admin-form__field--full">
            <label class="admin-form__label">自定义双态图标</label>
            <div class="admin-system-menu-icon-grid">
              <div class="admin-system-menu-icon-card">
                <div class="admin-system-menu-icon-card__label">未激活图标</div>
                <div class="admin-system-menu-icon-card__preview">
                  <img v-if="draft.inactiveIconUrl" :src="draft.inactiveIconUrl" alt="">
                  <span v-else>未上传</span>
                </div>
                <input
                  v-model.trim="draft.inactiveIconUrl"
                  class="admin-input"
                  type="text"
                  placeholder="可直接填写图片地址或使用下方上传"
                >
                <input
                  id="theme-menu-item-dialog-icon-inactive"
                  type="file"
                  accept="image/svg+xml,image/png,image/webp,image/jpeg"
                  class="admin-system-file-input"
                  @change="emit('icon-file-change', $event, 'inactive')"
                >
                <div class="admin-list-item__actions">
                  <button class="admin-inline-button" type="button" @click="emit('trigger-icon-upload', 'inactive')">上传未激活图</button>
                  <button class="admin-inline-button" type="button" @click="emit('clear-icon', 'inactive')">清空</button>
                </div>
              </div>

              <div class="admin-system-menu-icon-card">
                <div class="admin-system-menu-icon-card__label">激活图标</div>
                <div class="admin-system-menu-icon-card__preview">
                  <img v-if="draft.activeIconUrl" :src="draft.activeIconUrl" alt="">
                  <span v-else>未上传</span>
                </div>
                <input
                  v-model.trim="draft.activeIconUrl"
                  class="admin-input"
                  type="text"
                  placeholder="留空时自动复用未激活图标"
                >
                <input
                  id="theme-menu-item-dialog-icon-active"
                  type="file"
                  accept="image/svg+xml,image/png,image/webp,image/jpeg"
                  class="admin-system-file-input"
                  @change="emit('icon-file-change', $event, 'active')"
                >
                <div class="admin-list-item__actions">
                  <button class="admin-inline-button" type="button" @click="emit('trigger-icon-upload', 'active')">上传激活图</button>
                  <button class="admin-inline-button" type="button" @click="emit('clear-icon', 'active')">清空</button>
                </div>
              </div>
            </div>
            <div class="admin-form__hint">支持上传 SVG / PNG / WebP / JPG，保存后才会写回工作台配置。</div>
          </div>

          <div class="admin-form__field">
            <label class="admin-form__label">跳转类型</label>
            <select v-model="draft.actionType" class="admin-input">
              <option value="route">路由</option>
              <option value="url">外链</option>
              <option value="dialog">弹窗</option>
              <option value="none">无动作</option>
            </select>
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">动作值</label>
            <input v-model.trim="draft.actionValue" class="admin-input" type="text" placeholder="/generate 或 https://...">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">徽标文案</label>
            <input v-model.trim="draft.badgeText" class="admin-input" type="text" placeholder="可选">
          </div>
          <div class="admin-form__field">
            <label class="admin-form__label">徽标语气</label>
            <select v-model="draft.badgeTone" class="admin-input">
              <option value="default">默认</option>
              <option value="primary">主色</option>
              <option value="success">成功</option>
              <option value="warning">提醒</option>
              <option value="danger">警示</option>
            </select>
          </div>
          <div class="admin-form__field admin-form__field--full">
            <label class="admin-switch-row">
              <input v-model="draft.visible" type="checkbox">
              <span>显示该菜单项</span>
            </label>
          </div>
        </div>

        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="emit('close')">取消</button>
          <button class="admin-button admin-button--primary" type="button" @click="emit('submit')">保存菜单项</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SystemHomeSideMenuItemConfig } from '@/api/system-config'

defineProps<{
  visible: boolean
  draft: SystemHomeSideMenuItemConfig | null
}>()

const emit = defineEmits<{
  close: []
  submit: []
  'trigger-icon-upload': [state: 'inactive' | 'active']
  'icon-file-change': [event: Event, state: 'inactive' | 'active']
  'clear-icon': [state: 'inactive' | 'active']
}>()
</script>
