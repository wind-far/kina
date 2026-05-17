<template>
  <span class="admin-status" :class="toneClass">{{ item.label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  resolveAdminDictionaryItem,
  type AdminDictionaryCategory,
} from '@/config/adminDictionaries'

const props = defineProps<{
  category: AdminDictionaryCategory
  value?: string | null
}>()

const item = computed(() => resolveAdminDictionaryItem(props.category, props.value))
const toneClass = computed(() => `admin-status--${item.value.tone}`)
</script>
