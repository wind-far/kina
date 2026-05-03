<template>
  <section class="admin-page">
    <div class="admin-page__container">
      <div v-if="!hideIntro" class="admin-page__intro">
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
withDefaults(defineProps<{
  title?: string
  description?: string
  hideIntro?: boolean
}>(), {
  title: '',
  description: '',
  hideIntro: false,
})
</script>
