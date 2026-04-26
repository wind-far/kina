<template>
  <Teleport to="body">
    <Transition name="publish-artwork-modal" :duration="{ enter: 320, leave: 220 }">
      <div
        v-if="visible && image"
        class="publish-artwork-modal-host lv-modal-wrapper lv-modal-wrapper-align-center publish-modal-wrapper-V8zaHc"
        style="display: block"
      >
        <div class="publish-artwork-backdrop" aria-hidden="true" @click="close"></div>

        <div
          role="dialog"
          aria-modal="true"
          aria-label="发布作品"
          class="lv-modal lv-modal-simple lv-modal-closable"
          @click.stop
        >
          <div data-focus-lock-disabled="false" tabindex="-1">
            <div class="lv-modal-header sf-hidden"></div>
            <div class="lv-modal-content">
              <div class="modal-container-BvlOIz">
                <div class="publish-header-uieubt">
                  <div class="header-title-QCjfhu">
                    <span>发布作品</span>
                  </div>

                  <button class="close-button-djEnsl" type="button" aria-label="关闭" @click="close">
                    <svg width="20" height="20" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                      <g>
                        <path
                          data-follow-fill="currentColor"
                          d="M19.579 6.119a1.2 1.2 0 0 0-1.697-1.698L12 10.303 6.12 4.422a1.2 1.2 0 1 0-1.697 1.697L10.303 12l-5.881 5.882a1.2 1.2 0 0 0 1.697 1.697L12 13.698l5.882 5.882a1.2 1.2 0 1 0 1.697-1.697L13.697 12l5.882-5.882Z"
                          clip-rule="evenodd"
                          fill-rule="evenodd"
                          fill="currentColor"
                        />
                      </g>
                    </svg>
                  </button>
                </div>

                <div class="content-container-sNJbeH">
                  <div class="content-wrapper-pbEuKY">
                    <div class="preview-wrapper-_wIcb1">
                      <div class="preview-title-elzXh0">预览</div>
                      <div class="preview-image-wrapper-DQLP4U">
                        <div class="preview-image-content-ONDKjp">
                          <img class="publish-preview-image" :src="image.src" :alt="image.id">
                        </div>
                      </div>
                    </div>

                    <div class="publish-form-container-Oeqqeo">
                      <div class="form-container-wHKVU9">
                        <div class="label-container-tfpB4z">
                          <span>标题</span>
                          <span class="required-icon-l_HVKQ">*</span>
                        </div>

                        <div class="input-wrapper-n7y99H form-title-input-pp1JpZ">
                          <div class="lv-textarea-wrapper">
                            <textarea
                              v-model="title"
                              maxlength="20"
                              class="lv-textarea lv-textarea-wording-padding input-area-ATwyR6"
                              placeholder="给作品起个标题吧"
                            ></textarea>
                            <span class="lv-textarea-word-limit">{{ title.length }}/20</span>
                          </div>

                          <div class="bottom-left-module-hPNpLm">
                            <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square activity-button-mRxIHv" type="button">
                              <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                  <path
                                    data-follow-fill="currentColor"
                                    fill-rule="evenodd"
                                    clip-rule="evenodd"
                                    d="M4.837 6.043a3.352 3.352 0 0 1 3.352-3.352h7.622c1.851 0 3.352 1.5 3.352 3.352v4.588a7.164 7.164 0 0 1-6.136 7.09v1.784h4.136a1 1 0 0 1 1 1v.054a1 1 0 0 1-1 1H6.837a1 1 0 0 1-1-1v-.054a1 1 0 0 1 1-1h4.136V17.72a7.164 7.164 0 0 1-6.136-7.09V6.044ZM8.19 4.69c-.746 0-1.352.605-1.352 1.352v4.588a5.163 5.163 0 1 0 10.326 0V6.043c0-.747-.606-1.352-1.352-1.352H8.189Zm12.72 1.835h1.032c.465 0 .842.378.842.843v2.005c0 1.094-.802 2.23-2.407 3.406a.21.21 0 0 1-.327-.226c.293-1.075.439-1.928.439-2.558V6.947a.422.422 0 0 1 .421-.422Zm-17.82 0a.422.422 0 0 1 .421.422v3.048c0 .63.146 1.483.44 2.559a.21.21 0 0 1-.328.225c-1.605-1.177-2.408-2.312-2.408-3.407V7.367c0-.465.378-.842.843-.842H3.09Z"
                                    fill="currentColor"
                                  />
                                </g>
                              </svg>
                              <span>添加挑战</span>
                            </button>
                          </div>

                          <div class="error-message-n1wdyc">{{ titleError }}</div>
                        </div>
                      </div>

                      <div class="form-container-wHKVU9">
                        <div class="label-container-tfpB4z">
                          <span>作品描述</span>
                        </div>

                        <div class="input-wrapper-n7y99H form-desc-input-n73OIj">
                          <div class="lv-textarea-wrapper">
                            <textarea
                              v-model="description"
                              maxlength="500"
                              class="lv-textarea lv-textarea-wording-padding input-area-ATwyR6"
                              placeholder="聊聊你的作品灵感吧"
                            ></textarea>
                            <span class="lv-textarea-word-limit">{{ description.length }}/500</span>
                          </div>

                          <div class="bottom-left-module-hPNpLm"></div>
                          <div class="error-message-n1wdyc"></div>
                        </div>
                      </div>

                      <div>
                        <div class="prompt-header-VMrv9a">
                          <span class="prompt-title-nxAMai">图片提示词</span>
                        </div>

                        <div class="prompt-box-YN9Dvs">
                          <div class="prompt-content-c091Rk">
                            <span class="prompt-value-container-lIP4pF">
                              <span>{{ image.promptText || '暂无提示词' }}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="publish-button-container-RMNKzT">
                  <button
                    class="lv-btn lv-btn-primary lv-btn-size-default lv-btn-shape-square publish-button-_eqdhG"
                    :class="{
                      'disabled-SdPN7b': submitDisabled || submitting,
                      'lv-btn-disabled': submitDisabled || submitting,
                    }"
                    :disabled="submitDisabled || submitting"
                    type="button"
                    @click="handleSubmit"
                  >
                    <span>{{ submitting ? '发布中' : '发布' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch, ref } from 'vue'

interface PublishArtworkImage {
  id: string
  src: string
  promptText?: string
}

const props = defineProps<{
  visible: boolean
  image: PublishArtworkImage | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  submit: [payload: { image: PublishArtworkImage; title: string; description: string }]
}>()

const BODY_SCROLL_LOCK = 'publish-artwork-modal-scroll-lock'

const title = ref('')
const description = ref('')
const titleError = ref('')

const submitDisabled = computed(() => title.value.trim().length === 0)

const resetForm = () => {
  title.value = ''
  description.value = ''
  titleError.value = ''
}

const close = () => {
  emit('update:visible', false)
}

const syncBodyScrollLock = (visible: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(BODY_SCROLL_LOCK, visible)
  document.body.classList.toggle(BODY_SCROLL_LOCK, visible)
}

const handleSubmit = () => {
  const currentImage = props.image
  const nextTitle = title.value.trim()

  if (!currentImage) return

  if (!nextTitle) {
    titleError.value = '请输入标题'
    return
  }

  titleError.value = ''
  emit('submit', {
    image: currentImage,
    title: nextTitle,
    description: description.value.trim(),
  })
}

watch(
  () => props.visible,
  (visible) => {
    syncBodyScrollLock(visible)
    if (visible) {
      resetForm()
    }
  },
  { immediate: true },
)

watch(title, (value) => {
  if (value.trim()) {
    titleError.value = ''
  }
})

onBeforeUnmount(() => {
  syncBodyScrollLock(false)
})
</script>

<style src="./PublishArtworkModal.css"></style>
