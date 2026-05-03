<template>
  <div v-if="visible" class="admin-dialog-mask" @click="emit('close')">
    <div class="admin-dialog admin-theme-delete-dialog" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">删除菜单项</h3>
          <div class="admin-dialog__desc">删除后该菜单入口会从前台实时预览和配置数据中移除。</div>
        </div>
        <button class="admin-dialog__close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="admin-form admin-dialog__body">
        <div class="admin-theme-delete-dialog__content">
          确认删除菜单项「{{ label }}」吗？
        </div>
        <div class="admin-form__footer">
          <button class="admin-button admin-button--secondary" type="button" @click="emit('close')">取消</button>
          <button class="admin-button admin-button--danger" type="button" @click="emit('confirm')">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  label: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>
