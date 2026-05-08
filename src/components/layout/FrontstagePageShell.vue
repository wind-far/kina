<template>
  <div class="frontstage-page-shell">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer">
            <div class="container-moSF_y" :style="sideMenuStyleVars">
              <SideMenu />
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
import SideMenu from '@/components/home/components/SideMenu.vue'
import { useHomeSideMenuConfig } from '@/composables/useHomeSideMenuConfig'

defineProps<{
  layout?: 'standard' | 'raw'
  mainContainerId?: string
}>()

const { sideMenuStyleVars } = useHomeSideMenuConfig()
</script>
