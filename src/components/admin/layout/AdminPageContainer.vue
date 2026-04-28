<template>
  <section class="admin-page">
    <div class="admin-page__container">
      <div class="admin-page__intro">
        <div>
          <h3 class="admin-page__intro-title">{{ title }}</h3>
          <div class="admin-page__intro-text">{{ description }}</div>
        </div>
        <div v-if="$slots.actions" class="admin-page__actions">
          <slot name="actions" />
        </div>
      </div>

      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>
