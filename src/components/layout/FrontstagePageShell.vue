<template>
  <div class="frontstage-page-shell" :class="{ 'frontstage-page-shell--top-menu': isTopMenuLayout }">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer">
            <div class="container-moSF_y" :style="sideMenuStyleVars">
              <TopMenuBar v-if="isTopMenuLayout" />
              <SideMenu v-else />
              <slot v-if="layout === 'raw'" />
              <div v-else class="content-wrapper-cF1zaN">
                <div :id="mainContainerId || undefined" class="main-container-nXfW_A">
                  <div class="content-TZbgMr">
                    <slot />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <slot name="after" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SideMenu from '@/components/home/components/SideMenu.vue'
import TopMenuBar from '@/components/home/components/TopMenuBar.vue'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'

defineProps<{
  layout?: 'standard' | 'raw'
  mainContainerId?: string
}>()

const { sideMenuStyleVars, layoutMode } = useHomeSideMenuConfig()
const isTopMenuLayout = computed(() => layoutMode.value === 'top')
</script>

<style scoped>
.frontstage-page-shell--top-menu :deep(.container-moSF_y) {
  display: block;
}

.frontstage-page-shell--top-menu :deep(.content-wrapper-cF1zaN),
.frontstage-page-shell--top-menu :deep(.main-container-nXfW_A),
.frontstage-page-shell--top-menu :deep(.content-TZbgMr) {
  min-width: 0;
}
</style>
