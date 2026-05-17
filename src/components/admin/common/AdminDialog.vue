<template>
  <div v-if="visible" class="admin-dialog-mask" @click="handleMaskClick">
    <div class="admin-dialog" :class="panelClass" @click.stop>
      <div class="admin-dialog__header">
        <div>
          <h3 class="admin-dialog__title">{{ title }}</h3>
          <div v-if="description" class="admin-dialog__desc">{{ description }}</div>
        </div>
        <button class="admin-dialog__close" type="button" :disabled="closeDisabled" @click="handleClose">×</button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  description?: string
  panelClass?: string | string[] | Record<string, boolean>
  closeOnMask?: boolean
  closeDisabled?: boolean
}>(), {
  description: '',
  panelClass: '',
  closeOnMask: true,
  closeDisabled: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  close: []
}>()

const handleClose = () => {
  if (props.closeDisabled) {
    return
  }
  emit('update:visible', false)
  emit('close')
}

const handleMaskClick = () => {
  if (!props.closeOnMask) {
    return
  }
  handleClose()
}
</script>
