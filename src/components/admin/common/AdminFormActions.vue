<template>
  <div class="admin-form__footer">
    <button class="admin-button admin-button--secondary" type="button" :disabled="disabled" @click="emit('cancel')">
      {{ cancelText }}
    </button>
    <button class="admin-button admin-button--primary" type="submit" :disabled="disabled || submitting">
      {{ submitting ? submittingText : submitText }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  submitText: string
  submittingText?: string
  cancelText?: string
  submitting?: boolean
  disabled?: boolean
}>(), {
  submittingText: '处理中...',
  cancelText: '取消',
  submitting: false,
  disabled: false,
})

const emit = defineEmits<{
  cancel: []
}>()
</script>
