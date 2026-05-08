<template>
  <div class="content-1rx" :class="{ 'hidden-w3p': !active }">
    <div class="tab-entry-mxq">
      <div class="canvasEntryContainer-dp8">
        <div class="header-2ov">
          <div class="container-c5d">
            <div class="header-2wr">
              <div class="filter-wxj">
                <div
                  v-for="option in editorFilterOptions"
                  :key="option.value"
                  class="filter-qxo"
                  :class="{ [option.activeClass]: editorFilter === option.value }"
                  @click="emit('set-editor-filter', option.value)"
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
              <div class="canvasCard-yoo cavasNewCard-xsi">
                <div class="image-d9m">
                  <div class="canvasFail-zxx">
                    <svg width="24" height="24" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path data-follow-fill="currentColor" d="M16.947 3a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-1.51a1 1 0 0 0-.768.36l-1.133 1.359a2 2 0 0 1-3.072 0L9.03 20H7.053a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5h9.894ZM7.053 5a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3H9.03a2 2 0 0 1 1.537.72L12 20.438l1.132-1.359A3 3 0 0 1 15.437 18h1.51a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H7.053Zm5.029 9.14c.307 0 .563.106.77.318.207.213.31.476.311.79 0 .312-.101.574-.31.786-.208.213-.464.32-.771.32a1.02 1.02 0 0 1-.77-.319 1.09 1.09 0 0 1-.312-.788 1.092 1.092 0 0 1 .664-1.03c.133-.054.275-.08.418-.076Zm0-6.64c.306.001.562.108.77.32.208.212.311.474.311.787v3.32c0 .313-.101.576-.31.788a1.037 1.037 0 0 1-.771.318 1.025 1.025 0 0 1-.77-.317 1.072 1.072 0 0 1-.312-.79V8.608c0-.311.104-.574.312-.788.208-.213.464-.319.77-.319Z" fill="currentColor" />
                      </g>
                    </svg>无法预览画布内容
                  </div>
                </div>
                <span class="canvasTitle-j2c style-UeXf7" id="style-UeXf7">未命名项目</span>
                <div class="updateTime-dyo">2025年6月7日修改</div>
                <div class="canvasControls-rkg style-GbagA" id="style-GbagA">
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
import type { EditorFilterType, FilterOption } from '@/views/asset/types'

defineProps<{
  active: boolean
  editorFilterOptions: FilterOption<EditorFilterType>[]
  editorFilter: EditorFilterType
}>()

const emit = defineEmits<{
  'set-editor-filter': [filter: EditorFilterType]
  'enter-batch-mode': []
}>()
</script>
