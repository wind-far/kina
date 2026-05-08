<template>
  <div class="content-1rx" :class="{ 'hidden-w3p': !active }">
    <div class="tab-entry-mxq">
      <div class="canvasEntryContainer-dp8">
        <div class="header-2ov">
          <div class="container-c5d">
            <div class="header-2wr">
              <div class="filter-wxj">
                <div
                  v-for="option in canvasFilterOptions"
                  :key="option.value"
                  class="filter-qxo"
                  :class="{ [option.activeClass]: canvasFilter === option.value }"
                  @click="emit('set-canvas-filter', option.value)"
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
        <div class="canvasWrapper-ysg">
          <div class="container-c5d">
            <div class="canvasList-oos">
              <div class="canvasCard-yoo">
                <div class="emptyItem-jk6">
                  <svg width="32" height="32" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                    <g>
                      <path data-follow-fill="currentColor" d="M10.8 20a1.2 1.2 0 0 0 2.4 0v-6.8H20a1.2 1.2 0 1 0 0-2.4h-6.8V4a1.2 1.2 0 0 0-2.4 0v6.8H4a1.2 1.2 0 0 0 0 2.4h6.8V20Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                    </g>
                  </svg>
                </div>
                <span class="canvasTitle-j2c style-Z9bSC" id="style-Z9bSC">新建项目</span>
                <div class="updateTime-dyo"></div>
              </div>
              <div class="canvasCard-yoo cavasNewCard-xsi">
                <div class="image-d9m">
                  <div class="image-grw"><img src="https://p3-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/42b6674b5ee448c7a0a0381f024d0886~tplv-tb4s082cfz-resize:360:360.webp?lk3s=ad9f132c&x-expires=1800684352&x-signature=hdKXYk6L1fBOeSNVVjzcwnCjGC4%3D"></div>
                  <div class="fa-9r8 hideFavorite-znw">
                    <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path data-follow-fill="currentColor" d="M9.893 7.177 12 3.787l2.107 3.39a3 3 0 0 0 1.829 1.329l3.874.956-2.572 3.052a3 3 0 0 0-.698 2.15l.287 3.98-3.697-1.503a3 3 0 0 0-2.26 0l-3.697 1.503.287-3.98a3 3 0 0 0-.698-2.15L4.19 9.462l3.874-.956a3 3 0 0 0 1.829-1.329Zm1.258-5.811a1 1 0 0 1 1.698 0l2.957 4.755a1 1 0 0 0 .61.443l5.435 1.342a1 1 0 0 1 .525 1.616l-3.609 4.28a1 1 0 0 0-.232.717l.403 5.585a1 1 0 0 1-1.374.998l-5.187-2.109a1 1 0 0 0-.754 0l-5.187 2.11a1 1 0 0 1-1.374-.999l.404-5.585a1 1 0 0 0-.233-.716l-3.61-4.281a1 1 0 0 1 .526-1.616l5.436-1.342a1 1 0 0 0 .61-.443l2.956-4.755Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                      </g>
                    </svg>
                  </div>
                  <div class="tooltip-3ot"></div>
                  <div class="canvasSize-zl2">
                    <span>1920</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12">
                      <g>
                        <path d="M9.24 9.823a.25.25 0 0 1-.353 0l-6.71-6.71a.25.25 0 0 1 0-.353l.583-.583a.25.25 0 0 1 .353 0l6.71 6.71a.25.25 0 0 1 0 .353z" />
                        <path d="M2.76 9.823a.25.25 0 0 0 .353 0l6.71-6.71a.25.25 0 0 0 0-.353l-.583-.583a.25.25 0 0 0-.353 0l-6.71 6.71a.25.25 0 0 0 0 .353z" />
                      </g>
                      <defs>
                        <clipPath>
                          <path fill="#fff" d="M0 0h12v12H0z" />
                        </clipPath>
                        <filter width="11.793" height="11.793">
                          <feFlood />
                          <feColorMatrix />
                          <feOffset />
                          <feGaussianBlur />
                          <feComposite />
                          <feColorMatrix />
                          <feBlend />
                          <feBlend />
                        </filter>
                      </defs>
                    </svg>
                    <span>1080</span>
                    <span id="style-QFwdW" class="style-QFwdW">px</span>
                  </div>
                  <div class="canvasShadow-akt"></div>
                </div>
                <span class="canvasTitle-j2c style-ZwMOO" id="style-ZwMOO">未命名</span>
                <div class="updateTime-dyo">21小时前修改</div>
                <div class="canvasControls-rkg style-7gdA4" id="style-7gdA4">
                  <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="iconMore-cHtSH7" style="color: var(--text-secondary);">
                    <g>
                      <path data-follow-fill="currentColor" d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                    </g>
                  </svg>
                </div>
              </div>
              <div class="canvasCard-yoo cavasNewCard-xsi">
                <div class="image-d9m">
                  <div class="loading-rw9 style-n77HF" id="style-n77HF"></div>
                </div>
                <span class="canvasTitle-j2c style-bxOi2" id="style-bxOi2">未命名项目</span>
                <div class="updateTime-dyo">21小时前修改</div>
                <div class="canvasControls-rkg style-S5EMJ" id="style-S5EMJ">
                  <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="iconMore-cHtSH7" style="color: var(--text-secondary);">
                    <g>
                      <path data-follow-fill="currentColor" d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="load-more-detector-c4r"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CanvasFilterType, FilterOption } from '@/views/asset/types'

defineProps<{
  active: boolean
  canvasFilterOptions: FilterOption<CanvasFilterType>[]
  canvasFilter: CanvasFilterType
}>()

const emit = defineEmits<{
  'set-canvas-filter': [filter: CanvasFilterType]
  'enter-batch-mode': []
}>()
</script>
