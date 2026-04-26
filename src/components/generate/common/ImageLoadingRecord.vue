<template>
  <div class="responsive-container-msS_cP responsive-container-NBoaUU">
    <div class="content-DPogfx ai-generated-record-content-hg5EL8">
      <div v-if="time" class="group-title-mhd8yy">{{ time }}</div>
      <div class="image-record-ytX6Dp">
        <!-- 头部：提示词和标签 -->
        <div class="record-header-E91Dfj">
          <div class="record-header-content-Lkk9CM">
            <div class="prompt-suffix-labels-wrapper-qthJZj"
                 style="--line-height:24px;--padding-top:4px">
              <div class="prompt-suffix-labels-NBprFc"
                   style="--line-height:24px;--padding-top:4px">
                <div class="prompt-suffix-labels-content-uFKTga">
                  <span class="prompt-P_8aF8">
                    <span class="prompt-value-container-KCtKOf">
                      <span>{{ prompt }}</span>
                    </span>
                  </span>
                  <span class="labels-mHLx1x" style="visibility:visible">
                    <span class="label-lhnDlt">{{ model }}</span>
                    <span v-if="feature" class="label-lhnDlt">{{ feature }}</span>
                    <span class="label-lhnDlt">{{ ratio }}</span>
                    <span class="label-lhnDlt">{{ resolution }}</span>
                    <span v-if="duration" class="label-lhnDlt">{{ duration }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="record-box-wrapper-MDgaBP">
          <!-- 错误状态 -->
          <div v-if="error" class="image-error-container">
            <div class="image-error-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>{{ error }}</span>
            </div>
          </div>
          <!-- 生成完成：显示图片 -->
          <div v-else-if="done && images.length" class="image-record-content-TuJi21">
            <div class="responsive-image-grid-WOh0lB">
              <div v-for="(url, i) in images" :key="i"
                   class="image-card-wrapper-WOgXrk landscape-Ven8Mz"
                   :style="`--aspect-ratio:${aspectRatio}`">
                <div class="image-record-item-W6Y7Df">
                  <div class="context-menu-trigger-WJ6VDZ">
                    <div class="slot-card-container-gulhrr image-card-container-dFemyw">
                      <div class="content-container-z0JOWv">
                        <div class="image-card-container-qy7ui4">
                          <div class="container-bG3PQ9 image-GnB1sY">
                            <div style="transition:opacity 300ms;opacity:1">
                              <img class="image-TLmgkP"
                                   crossorigin="anonymous"
                                   draggable="false"
                                   loading="lazy"
                                   :src="url" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- 加载中 -->
          <div v-else class="image-record-content-TuJi21">
            <div class="responsive-image-grid-WOh0lB">
              <div v-for="i in count" :key="i"
                   class="image-card-wrapper-WOgXrk landscape-Ven8Mz"
                   :style="`--aspect-ratio:${aspectRatio}`">
                <div class="image-record-item-W6Y7Df"></div>
              </div>
              <!-- 加载动画覆盖层 -->
              <div class="loading-container-VeCJoq">
                <div class="animation-wrapper-etExey">
                  <video class="loading-animation-x3v9Mu"
                         autoplay loop muted preload="auto"
                         :src="loadingVideoUrl"
                         crossorigin="anonymous" />
                </div>
              </div>
              <!-- 网格分割线 -->
              <div class="divider-container-PJpG3l vertical-divider-container-romu4d">
                <div v-for="i in (count - 1)" :key="i" class="vertical-divider"
                     :style="`left:${(i / count) * 100}%;transform:translateX(-50%)`"></div>
              </div>
            </div>
            <!-- 进度徽章 -->
            <div class="progress-badge-RuihdC progress-badge-RQDqWu">
              {{ currentProgress }}%造梦中
            </div>
          </div>
          <div v-if="done && !error" class="operations-NxPE1B">
            <div class="record-bottom-slots-AYv3JV">
              <div>
                <div class="card-bottom-button-view-xY_JqR"
                     style="--right-padding:14px"
                     @click="$emit('edit')">
                  <div class="icon-Eb0kRz">
                    <svg fill="none"
                         height="1em"
                         preserveAspectRatio="xMidYMid meet"
                         role="presentation"
                         viewBox="0 0 24 24"
                         width="1em"
                         xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path clip-rule="evenodd"
                              d="M3.764 8.02a2.5 2.5 0 0 1 2.5-2.5H17.03a2.5 2.5 0 0 1 2.5 2.5V9.8a3.25 3.25 0 0 1 2-.082V8.019a4.5 4.5 0 0 0-4.5-4.5H6.264a4.5 4.5 0 0 0-4.5 4.5v7.932a4.5 4.5 0 0 0 4.5 4.5h5.837a2.436 2.436 0 0 1-.05-.57v-1.43H6.263a2.5 2.5 0 0 1-2.5-2.5V8.019Zm17.67 3.964a1 1 0 0 0-1.41-.004l-5.773 5.707a.25.25 0 0 0-.074.178v2.366c0 .138.112.25.25.25h2.347a.25.25 0 0 0 .178-.075l5.71-5.791a1 1 0 0 0-.006-1.41l-1.221-1.22Z"
                              data-follow-fill="currentColor"
                              fill="currentColor"
                              fill-rule="evenodd"></path>
                      </g>
                    </svg>
                  </div>
                  <div>重新编辑</div>
                </div>
              </div>
              <div>
                <div class="card-bottom-button-view-xY_JqR"
                     style="--right-padding:14px"
                     @click="$emit('regenerate')">
                  <div class="icon-Eb0kRz">
                    <svg fill="none"
                         height="1em"
                         preserveAspectRatio="xMidYMid meet"
                         role="presentation"
                         viewBox="0 0 24 24"
                         width="1em"
                         xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path clip-rule="evenodd"
                              d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                              data-follow-fill="currentColor"
                              fill="currentColor"
                              fill-rule="evenodd"></path>
                      </g>
                    </svg>
                  </div>
                  <div>再次生成</div>
                </div>
              </div>
              <div class="operation-button-oVtvlN normal-button-mS74ha"
                   @click="$emit('more')">
                <span class="icon-oB5C0a">
                  <svg fill="none"
                       height="1em"
                       preserveAspectRatio="xMidYMid meet"
                       role="presentation"
                       viewBox="0 0 24 24"
                       width="1em"
                       xmlns="http://www.w3.org/2000/svg">
                    <g>
                      <path clip-rule="evenodd"
                            d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                            data-follow-fill="currentColor"
                            fill="currentColor"
                            fill-rule="evenodd"></path>
                    </g>
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import loadingVideoUrl from '@/assets/animations/record-loading-animation.mp4'

const props = defineProps({
  /** 分组时间 */
  time: { type: String, default: '' },
  /** 提示词 */
  prompt: { type: String, default: '' },
  /** 模型版本 */
  model: { type: String, default: '图片 5.0' },
  /** 宽高比标签 */
  ratio: { type: String, default: '1:1' },
  /** 分辨率标签 */
  resolution: { type: String, default: '2K' },
  /** 时长（视频模式） */
  duration: { type: String, default: '' },
  /** 功能（视频模式） */
  feature: { type: String, default: '' },
  /** 生成图片数量 */
  count: { type: Number, default: 4 },
  /** 图片宽高比数值 */
  aspectRatio: { type: Number, default: 1 },
  /** 初始进度百分比 */
  progress: { type: Number, default: 0 },
  /** 是否生成完成 */
  done: { type: Boolean, default: false },
  /** 生成的图片 URL 列表 */
  images: { type: Array, default: () => [] },
  /** 错误信息 */
  error: { type: String, default: '' }
})

defineEmits(['edit', 'regenerate', 'more'])

const currentProgress = ref(props.progress)
let timer = null

const startTimer = () => {
  timer = setInterval(() => {
    if (currentProgress.value < 99) {
      const remaining = 99 - currentProgress.value
      const step = Math.max(1, Math.floor(remaining * 0.08))
      currentProgress.value = Math.min(99, currentProgress.value + step)
    }
  }, 800)
}

const stopTimer = () => {
  if (timer) { clearInterval(timer); timer = null }
}

// 完成时停止进度条
watch(() => props.done, (val) => {
  if (val) stopTimer()
})

watch(() => props.error, (val) => {
  if (val) stopTimer()
})

onMounted(() => {
  if (!props.done && !props.error) startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
/* 修正长提示词头部被绝对定位撑出后覆盖图片区的问题 */
:deep(.record-header-E91Dfj .record-header-content-Lkk9CM) {
  align-items: flex-start;
}

:deep(.record-header-E91Dfj .prompt-suffix-labels-wrapper-qthJZj) {
  height: auto;
  max-height: none;
  min-height: calc(var(--line-height) * 2 + var(--padding-top) * 2);
}

:deep(.record-header-E91Dfj .prompt-suffix-labels-NBprFc) {
  max-height: none;
  overflow: visible;
  position: relative;
}

/* 加载动画覆盖层 */
.loading-container-VeCJoq {
  border-radius: 2px;
  height: 100%;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 100%;
}

.animation-wrapper-etExey {
  background-color: var(--bg-mask-60);
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
  overflow: hidden;
}

.loading-animation-x3v9Mu {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 网格分割线 */
.divider-container-PJpG3l {
  height: 100%;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  transform: translateZ(0);
  width: 100%;
  z-index: 5;
}

.vertical-divider {
  background-color: var(--bg-body);
  height: 100%;
  position: absolute;
  top: 0;
  width: 2px;
}

/* 进度徽章 */
.progress-badge-RuihdC {
  align-items: center;
  background: var(--bg-block-primary-default, rgba(204, 221, 255, .08));
  border-radius: 6px;
  color: var(--text-primary);
  display: flex;
  font-family: PingFang SC, sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  padding: 2px 7px 2px 8px;
}

.image-record-content-TuJi21 .progress-badge-RQDqWu {
  left: 8px;
  position: absolute;
  top: 8px;
}

/* 错误状态 */
.image-error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 24px;
}

.image-error-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--functional-danger, #f53f3f);
  font-size: 14px;
}
</style>
