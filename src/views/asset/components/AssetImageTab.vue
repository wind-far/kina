<template>
  <div class="content-1rx">
    <div class="tab-entry-mxq">
      <div class="image-yhz">
        <div class="history-vxc">
          <div class="header-2ov">
            <div class="container-c5d">
              <div class="operatePanel-rz9">
                <div class="categoryContainer-g3l">
                  <span
                    v-for="option in imageFilterOptions"
                    :key="option.value"
                    :class="{ [option.activeClass]: imageFilter === option.value }"
                    @click="emit('set-image-filter', option.value)"
                  >
                    {{ option.label }}
                  </span>
                </div>
                <div v-if="isBatchMode" class="operationWrap-oqo">
                  <div class="select-zkx text-5vo">已选择 {{ selectedCount }} 项内容</div>
                  <div class="style-ctWQJ"></div>
                  <button class="btn-7n1 btn-secondary-y4e btn-rec btn-3qb" type="button" :disabled="selectedCount === 0" @click="emit('batch-delete')">
                    <div class="button-flt">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="actionIcon">
                        <g>
                          <path data-follow-fill="currentColor" d="M10.5 2.277a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM3.572 5.27a1 1 0 1 0 0 2H4.86v10a4 4 0 0 0 4 4h6.336a4 4 0 0 0 4-4v-10h1.231a1 1 0 1 0 0-2H3.571Zm3.289 12v-10h10.336v10a2 2 0 0 1-2 2H8.86a2 2 0 0 1-2-2Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                        </g>
                      </svg>
                      <span class="text-5vo">删除</span>
                    </div>
                  </button>
                  <button class="btn-7n1 btn-secondary-y4e btn-rec btn-3qb" type="button" :disabled="selectedCount === 0" @click="emit('batch-download')">
                    <div class="button-flt">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="actionIcon">
                        <g>
                          <path data-follow-fill="currentColor" d="M12 2a1 1 0 0 1 1 1v10.312l4.023-4.021a1 1 0 0 1 1.414 1.414l-5.73 5.728a1 1 0 0 1-1.414 0l-5.73-5.728A1 1 0 1 1 6.977 9.29L11 13.312V3a1 1 0 0 1 1-1ZM3 20.002a1 1 0 0 1 1-1L20 19a1 1 0 0 1 0 2l-16 .002a1 1 0 0 1-1-1Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                        </g>
                      </svg>
                      <span class="text-5vo">下载</span>
                    </div>
                  </button>
                  <button class="btn-7n1 btn-secondary-y4e btn-rec btn-3qb" type="button" :disabled="selectedCount === 0" @click="emit('batch-publish')">
                    <div class="button-flt">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="actionIcon">
                        <g>
                          <path data-follow-fill="currentColor" d="M17.523 8.332a1 1 0 0 1-1.415 0L13 5.223v9.357a1 1 0 1 1-2 0V5.223L7.892 8.332a1 1 0 1 1-1.415-1.415l4.816-4.815a1 1 0 0 1 1.414 0l4.816 4.816a1 1 0 0 1 0 1.414ZM4.439 14.58a1 1 0 1 0-2 0v2.35a4 4 0 0 0 4 4h11.122a4 4 0 0 0 4-4v-2.35a1 1 0 0 0-2 0v2.35a2 2 0 0 1-2 2H6.439a2 2 0 0 1-2-2v-2.35Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                        </g>
                      </svg>
                      <span class="text-5vo">发布</span>
                    </div>
                  </button>
                  <button class="btn-7n1 btn-secondary-y4e btn-rec btn-3qb" type="button" :disabled="selectedCount === 0" @click="emit('batch-favorite')">
                    <div class="button-flt">
                      <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="actionIcon">
                        <g>
                          <path data-follow-fill="currentColor" d="M9.893 7.177 12 3.787l2.107 3.39a3 3 0 0 0 1.829 1.329l3.874.956-2.572 3.052a3 3 0 0 0-.698 2.15l.287 3.98-3.697-1.503a3 3 0 0 0-2.26 0l-3.697 1.503.287-3.98a3 3 0 0 0-.698-2.15L4.19 9.462l3.874-.956a3 3 0 0 0 1.829-1.329Zm1.258-5.811a1 1 0 0 1 1.698 0l2.957 4.755a1 1 0 0 0 .61.443l5.435 1.342a1 1 0 0 1 .525 1.616l-3.609 4.28a1 1 0 0 0-.232.717l.403 5.585a1 1 0 0 1-1.374.998l-5.187-2.109a1 1 0 0 0-.754 0l-5.187 2.11a1 1 0 0 1-1.374-.999l.404-5.585a1 1 0 0 0-.233-.716l-3.61-4.281a1 1 0 0 1 .526-1.616l5.436-1.342a1 1 0 0 0 .61-.443l2.956-4.755Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                        </g>
                      </svg>
                      <span class="text-5vo">收藏</span>
                    </div>
                  </button>
                  <button class="btn-7n1 btn-secondary-y4e btn-rec btn-3qb" type="button" :disabled="selectedCount === 0" @click="emit('edit-in-capcut')">
                    <div class="btn-bm4">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="capcut-icon">
                        <g>
                          <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22.002 7.646V4.61l-3.749 1.917v-.115c0-1.21-.892-1.94-2.181-1.94H4.183c-1.36 0-2.181.73-2.181 1.94v3.066l5.252 2.642-5.252 2.67v3.059c0 1.186.825 1.917 2.181 1.917H16.07c1.29 0 2.182-.73 2.182-1.917v-.16L22 19.63v-3.081l-8.72-4.429 8.722-4.474Zm-11.747 5.98 6.448 3.287H3.784l6.47-3.286Zm6.4-6.3-6.4 3.265-6.47-3.265h12.87Z" fill="currentColor" />
                        </g>
                      </svg>去剪映编辑
                    </div>
                  </button>
                  <div class="divider-4o4"></div>
                  <div class="select-rfs" @click="emit('exit-batch-mode')">
                    <svg width="14" height="14" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path data-follow-fill="currentColor" d="M19.579 6.119a1.2 1.2 0 0 0-1.697-1.698L12 10.303 6.12 4.422a1.2 1.2 0 1 0-1.697 1.697L10.303 12l-5.881 5.882a1.2 1.2 0 0 0 1.697 1.697L12 13.698l5.882 5.882a1.2 1.2 0 1 0 1.697-1.697L13.697 12l5.882-5.882Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                      </g>
                    </svg>取消选择
                  </div>
                </div>
                <div v-else class="operationWrap-431">
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
                    <div class="divider-hb7"></div>
                    <div class="edit-in-capcut-54s">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="capcut-icon">
                        <g>
                          <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M22.002 7.646V4.61l-3.749 1.917v-.115c0-1.21-.892-1.94-2.181-1.94H4.183c-1.36 0-2.181.73-2.181 1.94v3.066l5.252 2.642-5.252 2.67v3.059c0 1.186.825 1.917 2.181 1.917H16.07c1.29 0 2.182-.73 2.182-1.917v-.16L22 19.63v-3.081l-8.72-4.429 8.722-4.474Zm-11.747 5.98 6.448 3.287H3.784l6.47-3.286Zm6.4-6.3-6.4 3.265-6.47-3.265h12.87Z" fill="currentColor" />
                        </g>
                      </svg>去剪映编辑
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="imageGroups.length" class="image-s9z">
            <div class="vList-q9n style-FG29L" id="style-FG29L">
              <div id="style-MK2n3" class="style-MK2n3">
                <div id="style-TK4rG" class="style-TK4rG">
                  <template v-for="group in imageGroups" :key="group.date">
                    <div>
                      <div class="container-c5d">
                        <div class="time-gcp" :class="{ 'first-fo4': group.isFirst }">{{ group.date }}</div>
                      </div>
                    </div>
                    <div class="row-zep">
                      <div class="container-c5d">
                        <div class="image-qvw">
                          <div
                            v-for="image in group.images"
                            :key="image.id"
                            class="image-bqm"
                            :class="{ 'select-1kz': isBatchMode && isSelected(image.id) }"
                            @click="emit('asset-click', image.id)"
                          >
                            <div>
                              <div class="container-pm3">
                                <img class="image-w9g" :src="image.src" :alt="image.id">
                              </div>
                            </div>
                            <div v-if="isBatchMode" class="select-av5">
                              <svg v-if="isSelected(image.id)" width="12" height="12" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                  <path data-follow-fill="currentColor" d="M18.28 7.502a1.25 1.25 0 0 1 0 1.768l-7.2 7.2a1.25 1.25 0 0 1-1.767 0l-3.6-3.6a1.25 1.25 0 1 1 1.767-1.768l2.716 2.717 6.317-6.317a1.25 1.25 0 0 1 1.767 0Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                                </g>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <div class="load-more-detector-c4r"></div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="video-cv8">
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
import type { FilterOption, ImageFilterType, ImageGroup } from '@/views/asset/types'

defineProps<{
  imageFilterOptions: FilterOption<ImageFilterType>[]
  imageFilter: ImageFilterType
  isBatchMode: boolean
  selectedCount: number
  imageGroups: ImageGroup[]
  isSelected: (itemId: string) => boolean
}>()

const emit = defineEmits<{
  'set-image-filter': [filter: ImageFilterType]
  'batch-delete': []
  'batch-download': []
  'batch-publish': []
  'batch-favorite': []
  'edit-in-capcut': []
  'enter-batch-mode': []
  'exit-batch-mode': []
  'asset-click': [itemId: string]
}>()
</script>
