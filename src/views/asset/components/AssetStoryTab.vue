<template>
  <div class="content-1rx" :class="{ 'hidden-w3p': !active }">
    <div class="tab-entry-mxq">
      <div class="storyEntryContainer-9vj">
        <div class="header-2ov">
          <div class="container-c5d">
            <div class="header-2wr">
              <div class="filter-wxj">
                <div
                  v-for="option in storyFilterOptions"
                  :key="option.value"
                  class="filter-qxo"
                  :class="{ [option.activeClass]: storyFilter === option.value }"
                  @click="emit('set-story-filter', option.value)"
                >
                  {{ option.label }}
                </div>
              </div>
              <div class="select-ald">
                <div class="operateArea-aqq">
                  <div class="search-7ey">
                    <div class="container-cpr mini-bsk search-krp">
                      <div class="container-dbs">
                        <div class="btn-v6i">
                          <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="back-icon">
                            <g>
                              <path data-follow-fill="currentColor" d="M4.533 12.844a1.2 1.2 0 0 1 0-1.687l7.655-7.747a1.2 1.2 0 0 1 1.708 1.687l-6.822 6.904 6.822 6.903a1.2 1.2 0 1 1-1.708 1.686l-7.655-7.746Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                            </g>
                          </svg>
                        </div>
                      </div>
                      <div class="container-7bd">
                        <div class="wrapper-kw3 search-fzo button-kin input-gji disabled-bod mini-irl col-zom">
                          <span class="input-ffs">
                            <span class="wrapper-8e3 wrapper-vc5 wrapper-9ij">
                              <span class="input-idr">
                                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                  <g>
                                    <path data-follow-fill="currentColor" d="M4.563 10.75a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Zm6.5-8.5a8.5 8.5 0 1 0 5.261 15.176l3.406 3.406a1 1 0 0 0 1.415-1.414l-3.407-3.406A8.5 8.5 0 0 0 11.062 2.25Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                                  </g>
                                </svg>
                              </span>
                              <input placeholder="搜索" class="input-z1m" value>
                            </span>
                            <span class="input-xd8">
                              <button class="btn-4ac btn-primary-exr btn-j99 btn-a2l loading-9av search-wvd" type="button">
                                <div class="container-29w disabled-mib">
                                  <span class="search-as4">搜索</span>
                                </div>
                              </button>
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="divider-hb7"></div>
                  <div class="btn-g4h" @click="emit('enter-batch-mode')">批量操作</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="storyWrapper-shp">
          <div class="container-c5d style-phEgc" id="style-phEgc">
            <div class="empty-page-ij3">
              <img src="https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/lvweb/dreamina_cn/static/image/empty-image-dark.6e788cae.png" class="image-eyv">
              <div class="description-96w">暂无相关资产</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterOption, StoryFilterType } from '@/views/asset/types'

defineProps<{
  active: boolean
  storyFilterOptions: FilterOption<StoryFilterType>[]
  storyFilter: StoryFilterType
}>()

const emit = defineEmits<{
  'set-story-filter': [filter: StoryFilterType]
  'enter-batch-mode': []
}>()
</script>
