<template>
  <section class="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
    <div class="install-success__icon">
      <span>✓</span>
    </div>
    <h1 class="mt-5 text-2xl font-semibold text-[var(--text-primary)]">系统初始化完成</h1>
    <p class="mt-3 text-base text-[var(--text-secondary)]">
      现在可以开始使用 {{ siteName }} 了。
    </p>

    <div class="mt-8 flex items-center justify-center gap-4 max-md:w-full max-md:flex-col max-md:items-stretch">
      <InstallActionButton variant="secondary" size="large" @click="$emit('home')">
        访问前台
      </InstallActionButton>
      <InstallActionButton variant="primary" size="large" @click="$emit('dashboard')">
        前往后台
      </InstallActionButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import InstallActionButton from './InstallActionButton.vue'

defineProps<{
  username: string
  name: string
  siteName: string
  siteDescription: string
}>()

defineEmits<{
  home: []
  dashboard: []
}>()
</script>

<style scoped>
.install-success__icon {
  display: flex;
  height: 88px;
  width: 88px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand-main-default) 18%, transparent);
  color: var(--brand-main-default);
}

.install-success__icon span {
  font-size: 48px;
  line-height: 1;
  transform: translateY(-2px);
}
</style>
