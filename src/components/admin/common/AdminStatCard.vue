<template>
  <div class="admin-stat-card">
    <div class="admin-stat-card__label">{{ label }}</div>
    <div class="admin-stat-card__value">{{ value }}</div>
    <div class="admin-stat-card__hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint: string
}>()
</script>
