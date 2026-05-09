<template>
  <div v-if="hasBannerItems" class="home-header-banner-layout banner" :style="bannerGridStyle">
    <button
      v-if="shouldRenderBannerSlot(0)"
      class="button-aJFqb0"
      :class="{ 'is-hidden-preview': !isBannerItemVisible(0) }"
      type="button"
      :style="getButtonStyle(0, '#2FE3FF')"
      @click="handleBannerClick(0)"
    >
      <div class="background-BaCcjk" :style="motionBackgroundStyle"></div>
      <div class="cover-ZvsynJ">
        <div class="lottie-wrapper loaded">
          <div class="lottie" style="width: 100%; height: 100%;">
            <svg xmlns="http://www.w3.org/2000/svg"
                 xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 324 204" width="324" height="204"
                 preserveAspectRatio="xMidYMid slice"
                 style="width: 100%; height: 100%; transform: translate3d(0px, 0px, 0px); content-visibility: visible;">
              <defs>
                <clipPath id="__lottie_element_2">
                  <rect width="324" height="204" x="0" y="0"></rect>
                </clipPath>
                <image
                    :xlink:href="motionMainImageUrl || '/banner/banner-1.png'">
                </image>
                <image
                    xlink:href="/banner/banner-2.jpg">
                </image>
                <image
                    xlink:href="/banner/banner-3.png">
                </image>
                <clipPath id="__lottie_element_4">
                  <path d="M0,0 L324,0 L324,204 L0,204z"></path>
                </clipPath>
                <clipPath id="__lottie_element_5">
                  <path fill="#ffffff" clip-rule="nonzero"
                        d=" M52.426998138427734,35.60100173950195 C52.426998138427734,35.60100173950195 8.789999961853027,35.60100173950195 8.789999961853027,35.60100173950195 C8.789999961853027,35.60100173950195 8.789999961853027,138 8.789999961853027,138 C8.789999961853027,138 52.426998138427734,138 52.426998138427734,138 C52.426998138427734,138 52.426998138427734,35.60100173950195 52.426998138427734,35.60100173950195"
                        fill-opacity="1"></path>
                  <path fill="#ffffff" clip-rule="nonzero"
                        d=" M227.0489959716797,36 C227.0489959716797,36 72.96199798583984,36 72.96199798583984,36 C52.55500030517578,36 36.01100158691406,52.45899963378906 36.01100158691406,72.76200103759766 C36.01100158691406,72.76200103759766 36.01100158691406,131.23800659179688 36.01100158691406,131.23800659179688 C36.01100158691406,151.54100036621094 52.55500030517578,168 72.96199798583984,168 C72.96199798583984,168 227.0489959716797,168 227.0489959716797,168 C247.45599365234375,168 264,151.54100036621094 264,131.23800659179688 C264,131.23800659179688 264,72.76200103759766 264,72.76200103759766 C264,52.45899963378906 247.45599365234375,36 227.0489959716797,36"
                        fill-opacity="1"></path>
                </clipPath>
                <clipPath id="__lottie_element_11">
                  <path d="M0,0 L324,0 L324,204 L0,204z"></path>
                </clipPath>
                <clipPath id="__lottie_element_12">
                  <path fill="#ffffff" clip-rule="nonzero"
                        d=" M227.0489959716797,36 C227.0489959716797,36 72.96199798583984,36 72.96199798583984,36 C52.55500030517578,36 36.01100158691406,52.45899963378906 36.01100158691406,72.76200103759766 C36.01100158691406,72.76200103759766 36.01100158691406,131.23800659179688 36.01100158691406,131.23800659179688 C36.01100158691406,151.54100036621094 52.55500030517578,168 72.96199798583984,168 C72.96199798583984,168 227.0489959716797,168 227.0489959716797,168 C247.45599365234375,168 264,151.54100036621094 264,131.23800659179688 C264,131.23800659179688 264,72.76200103759766 264,72.76200103759766 C264,52.45899963378906 247.45599365234375,36 227.0489959716797,36"
                        fill-opacity="1"></path>
                </clipPath>
              </defs>
              <g clip-path="url(#__lottie_element_2)">
                <g class="png" transform="matrix(1,0,0,1,0,0)" opacity="1" style="display: block;">
                  <image width="324px" height="204px" preserveAspectRatio="xMidYMid slice"
                         xlink:href="/banner/banner-3.png">
                  </image>
                </g>
                <g clip-path="url(#__lottie_element_11)" transform="matrix(1,0,0,1,0,0)" opacity="1"
                   style="display: block;">
                  <g clip-path="url(#__lottie_element_12)">
                    <g class="png"
                       transform="matrix(0.8800002932548523,0,0,0.8800002932548523,17.439956665039062,13.239967346191406)"
                       opacity="1" style="display: block;">
                      <image width="324px" height="204px" preserveAspectRatio="xMidYMid slice"
                             xlink:href="/banner/banner-2.jpg">
                      </image>
                    </g>
                  </g>
                </g>
                <g clip-path="url(#__lottie_element_4)" transform="matrix(1,0,0,1,0,0)" opacity="1"
                   style="display: block;">
                  <g clip-path="url(#__lottie_element_5)">
                    <g class="png third-image"
                       transform="matrix(0.910000205039978,0,0,0.910000205039978,1.5799713134765625,11.179969787597656)"
                       opacity="1" style="display: block;">
                      <image width="324px" height="204px" preserveAspectRatio="xMidYMid slice"
                             :xlink:href="motionOverlayImageUrl || '/banner/banner-1.png'">
                      </image>
                    </g>
                  </g>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div class="main-blLGGU">
        <h3 class="title-pvPZar">{{ getBannerItem(0, '无限画布', '灵感无界 · 自由创作').title }}
          <svg width="12" height="12" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet"
               fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="chevron-icon-BD3P6n">
            <g>
              <path data-follow-fill="currentColor"
                    d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                    fill="currentColor"></path>
            </g>
          </svg>
        </h3>
        <span class="subtitle-VFbX8q">{{ getBannerItem(0, '无限画布', '灵感无界 · 自由创作').subtitle }}</span>
      </div>
    </button>
    <button
      v-if="shouldRenderBannerSlot(1)"
      class="button-RNHVcx"
      :class="{ 'is-hidden-preview': !isBannerItemVisible(1) }"
      type="button"
      :style="getButtonStyle(1, '#00B1CC')"
      @click="handleBannerClick(1)"
    >
      <div class=background-tgcll7></div>
      <div class=image-Ea1x6H>
        <div class=image-wrapper>
          <img class=image-eNEQcl crossorigin=anonymous
               src="/banner/banner-4.png"
               draggable="false" alt="">
        </div>
      </div>
      <div class=main-container-T7VHK9>
        <div class=main-F8M12L>
          <div class=default-content>
            <h3 class=title-HdIqqm>{{ getBannerItem(1, '图片生成', '智能美学提升').title }}</h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(1, '图片生成', '智能美学提升').subtitle }}</span>
          </div>
          <div class=hover-content>
            <h3 class=title-HdIqqm>
              <span>{{ getBannerItem(1, '图片生成', '智能美学提升').title }}</span>
              <svg width=12 height=12 viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill=none
                   role=presentation xmlns=http://www.w3.org/2000/svg class=chevron-icon-AAHCkn>
                <g>
                  <path data-follow-fill=currentColor
                        d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                        fill=currentColor></path>
                </g>
              </svg>
            </h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(1, '图片生成', '智能美学提升').subtitle }}</span>
          </div>
        </div>
      </div>
    </button>
    <button
      v-if="shouldRenderBannerSlot(2)"
      class="button-RNHVcx"
      :class="{ 'is-hidden-preview': !isBannerItemVisible(2) }"
      type="button"
      :style="getButtonStyle(2, '#2197FF')"
      @click="handleBannerClick(2)"
    >
      <div class=background-tgcll7></div>
      <div class=image-Ea1x6H>
        <div class=image-wrapper>
          <img class=image-eNEQcl crossorigin=anonymous
               src=/banner/banner-5.png
               draggable="false" alt="">
        </div>
      </div>
      <div class=main-container-T7VHK9>
        <div class=main-F8M12L>
          <div class=default-content>
            <h3 class=title-HdIqqm>{{ getBannerItem(2, '视频生成', '支持音画同出').title }}</h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(2, '视频生成', '支持音画同出').subtitle }}</span>
          </div>
          <div class=hover-content>
            <h3 class=title-HdIqqm>
              <span>{{ getBannerItem(2, '视频生成', '支持音画同出').title }}</span>
              <svg width=12 height=12 viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill=none
                   role=presentation xmlns=http://www.w3.org/2000/svg class=chevron-icon-AAHCkn>
                <g>
                  <path data-follow-fill=currentColor
                        d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                        fill=currentColor></path>
                </g>
              </svg>
            </h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(2, '视频生成', '支持音画同出').subtitle }}</span>
          </div>
        </div>
      </div>
    </button>
    <button
      v-if="shouldRenderBannerSlot(3)"
      class="button-RNHVcx"
      :class="{ 'is-hidden-preview': !isBannerItemVisible(3) }"
      type="button"
      :style="getButtonStyle(3, '#FFD057')"
      @click="handleBannerClick(3)"
    >
      <div class=background-tgcll7></div>
      <div class=image-Ea1x6H>
        <div class=image-wrapper>
          <img class=image-eNEQcl crossorigin=anonymous
               src=/banner/banner-6.png
               draggable="false" alt="">
        </div>
      </div>
      <div class=main-container-T7VHK9>
        <div class=main-F8M12L>
          <div class=default-content>
            <h3 class=title-HdIqqm>{{ getBannerItem(3, '数字人', '大师模式').title }}</h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(3, '数字人', '大师模式').subtitle }}</span>
          </div>
          <div class=hover-content>
            <h3 class=title-HdIqqm>
              <span>{{ getBannerItem(3, '数字人', '大师模式').title }}</span>
              <svg width=12 height=12 viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill=none
                   role=presentation xmlns=http://www.w3.org/2000/svg class=chevron-icon-AAHCkn>
                <g>
                  <path data-follow-fill=currentColor
                        d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                        fill=currentColor></path>
                </g>
              </svg>
            </h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(3, '数字人', '大师模式').subtitle }}</span>
          </div>
        </div>
      </div>
    </button>
    <button
      v-if="shouldRenderBannerSlot(4)"
      class="button-RNHVcx"
      :class="{ 'is-hidden-preview': !isBannerItemVisible(4) }"
      type="button"
      :style="getButtonStyle(4, '#FF8B17')"
      @click="handleBannerClick(4)"
    >
      <div class=background-tgcll7></div>
      <div class=image-Ea1x6H>
        <div class=image-wrapper>
          <img class=image-eNEQcl crossorigin=anonymous
               src="/banner/banner-7.png"
               draggable="false" alt="">
        </div>
      </div>
      <div class=main-container-T7VHK9>
        <div class=main-F8M12L>
          <div class=default-content>
            <h3 class=title-HdIqqm>{{ getBannerItem(4, 'Agent 模式', '多步骤智能创作').title }}</h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(4, 'Agent 模式', '多步骤智能创作').subtitle }}</span>
          </div>
          <div class=hover-content>
            <h3 class=title-HdIqqm>
              <span>{{ getBannerItem(4, 'Agent 模式', '多步骤智能创作').title }}</span>
              <svg width=12 height=12 viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill=none
                   role=presentation xmlns=http://www.w3.org/2000/svg class=chevron-icon-AAHCkn>
                <g>
                  <path data-follow-fill=currentColor
                        d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                        fill=currentColor></path>
                </g>
              </svg>
            </h3>
            <span class=subtitle-wZBCn1>{{ getBannerItem(4, 'Agent 模式', '多步骤智能创作').subtitle }}</span>
          </div>
        </div>
      </div>
    </button>
  </div>

</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHomeLayoutConfig } from '@/composables/useHomeLayoutConfig'
import type { SystemHomeBannerItemConfig } from '@/api/system-config'

const props = withDefaults(defineProps<{
  bannerItemsOverride?: SystemHomeBannerItemConfig[]
  disableNavigation?: boolean
  previewShowHidden?: boolean
}>(), {
  bannerItemsOverride: () => [],
  disableNavigation: false,
  previewShowHidden: false,
})

// 首页横幅组件：第一步仅接入后台配置逻辑，保留旧版默认模板结构。
const router = useRouter()
const { bannerSettings } = useHomeLayoutConfig()

const bannerItems = computed(() => {
  if (props.bannerItemsOverride.length > 0) {
    return [...props.bannerItemsOverride]
      .sort((left, right) => left.sortOrder - right.sortOrder)
  }

  return [...(bannerSettings.value.items || [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
})

const bannerGridStyle = computed(() => {
  const primaryBannerVisible = bannerItems.value[0]?.visible !== false
  const secondaryBannerItems = bannerItems.value.slice(1)
  const visibleSecondaryCount = secondaryBannerItems.filter(item => item.visible !== false).length

  if (props.previewShowHidden) {
    const itemCount = bannerItems.value.length
    if (itemCount <= 1) {
      return {
        '--banner-grid': '1fr',
      }
    }

    return {
      '--banner-grid': `1.53fr repeat(${Math.max(0, itemCount - 1)}, 1fr)`,
    }
  }

  if (primaryBannerVisible) {
    if (visibleSecondaryCount === 0) {
      return {
        '--banner-grid': '1.53fr',
      }
    }

    return {
      '--banner-grid': `1.53fr repeat(${visibleSecondaryCount}, 1fr)`,
    }
  }

  const secondarySlotCount = Math.max(1, secondaryBannerItems.length)
  if (secondarySlotCount <= 1) {
    return {
      '--banner-grid': '1fr',
    }
  }

  return {
    '--banner-grid': `repeat(${secondarySlotCount}, 1fr)`,
  }
})

const hasBannerItems = computed(() => {
  return bannerItems.value.some((item, index) => shouldRenderBannerSlot(index) && !!item)
})

const primaryBannerItem = computed(() => {
  return bannerItems.value[0] || null
})

const motionBackgroundStyle = computed(() => {
  const backgroundImageUrl = primaryBannerItem.value?.backgroundImageUrl?.trim()

  if (!backgroundImageUrl) {
    return undefined
  }

  return {
    backgroundImage: `url(${backgroundImageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
})

const motionMainImageUrl = computed(() => {
  return primaryBannerItem.value?.mainImageUrl?.trim() || primaryBannerItem.value?.imageUrl?.trim() || ''
})

const motionOverlayImageUrl = computed(() => {
  return primaryBannerItem.value?.overlayImageUrl?.trim() || ''
})

const getBannerItem = (index: number, fallbackTitle: string, fallbackSubtitle: string) => {
  const currentItem = bannerItems.value[index]
  return {
    title: currentItem?.title || fallbackTitle,
    subtitle: currentItem?.subtitle || fallbackSubtitle,
    glowColor: currentItem?.glowColor || '',
    actionType: currentItem?.actionType || 'none',
    actionValue: currentItem?.actionValue || '',
  }
}

const isBannerItemVisible = (index: number) => {
  return bannerItems.value[index]?.visible !== false
}

const shouldRenderBannerSlot = (index: number) => {
  const currentItem = bannerItems.value[index]
  if (!currentItem) {
    return false
  }

  if (props.previewShowHidden) {
    return true
  }

  return currentItem.visible !== false
}

const getButtonStyle = (index: number, fallbackColor: string) => ({
  '--glow-color': getBannerItem(index, '', '').glowColor || fallbackColor,
})

const handleBannerClick = (index: number) => {
  if (props.disableNavigation) {
    return
  }

  const currentItem = getBannerItem(index, '', '')

  if (!currentItem.actionValue) {
    return
  }

  if (currentItem.actionType === 'route') {
    router.push(currentItem.actionValue)
    return
  }

  if (currentItem.actionType === 'url') {
    window.open(currentItem.actionValue, '_blank', 'noopener,noreferrer')
  }
}
</script>
<style>
.button-aJFqb0.is-hidden-preview,
.button-RNHVcx.is-hidden-preview {
  opacity: 0.45;
  filter: saturate(0.7);
}

.button-aJFqb0 .third-image {
  transition: transform 0.3s ease;
  transform-origin: top left;
}

.button-aJFqb0:hover .third-image {
  /* 在原有 scale 0.91 基础上放大到约 0.95 */
  transform: matrix(0.99,0,0,0.95,1.5799713134765625,11.179969787597656);
}
</style>
