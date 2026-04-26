<template>
  <div class="jimeng-home-container">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer-ilr3Ve">
            <div class="container-moSF_y"
                 style="--side-menu-width:76px;--side-drawer-width:440px;--side-drawer-float-limit-width:1280px">
              <!-- 侧边菜单 -->
              <SideMenu/>

              <!-- 主内容区 -->
              <div class="content-wrapper-cF1zaN">
                <div id="dreamina-ui-configuration-content-wrapper" class="main-container-nXfW_A">
                  <div class="content-TZbgMr">
                    <div class="scroll-container-Jsws2j scroll-container-QnV2C9">
                      <div>
                        <div class="scroll-content-DaYLnh scroll-content">
                          <div class="section-generator-q8kS_W">
                            <!-- 首页头部 -->
                            <HomeHeader/>
                          </div>
                          
                          <!-- Tabs 区域 -->
                          <TabsSection
                            @tab-change="handleTabChange"
                            @search="handleSearch"
                            @open-work-detail="handleOpenWorkDetail"
                          />

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
    </div>

    <HomeDetailModalFrom
      v-model="workDetailOpen"
      :image-src="workDetailImageSrc"
      :prompt-text="workDetailPromptText"
      :author-name="workDetailAuthorName"
      :author-avatar-src="workDetailAuthorAvatarSrc"
      :like-count="workDetailLikeCount"
      :create-date="workDetailCreateDate"
      :ai-generated-text="workDetailAiGeneratedText"
      :prompt-tip-label="workDetailPromptTipLabel"
      :model-label="workDetailModelLabel"
      :aspect-ratio-label="workDetailAspectRatioLabel"
      :gallery-length="workDetailGallery.length"
      @gallery-nav="handleGalleryNav"
      @favorite="handleWorkDetailFavorite"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import SideMenu from '../../components/home/components/SideMenu.vue'
import HomeHeader from '../../components/home/components/HomeHeader.vue'
import TabsSection from '@components/home/components/TabsSection.vue'
import HomeDetailModalFrom from '@components/home/components/HomeDetailModalFrom.vue'
import { applyAssetAction } from '@/api/asset-items'

const handleTabChange = (index) => {
  console.log('Tab changed to:', index)
}

const handleSearch = (searchText) => {
  console.log('Search:', searchText)
}

const workDetailOpen = ref(false)
/** @type {import('vue').Ref<Array<{ id?: string, imageSrc: string, promptText?: string, user?: { name?: string, avatarSrc?: string }, favoriteCount?: number|string, detail?: { createDate?: string, aiGeneratedText?: string, promptTipLabel?: string, modelLabel?: string, aspectRatioLabel?: string } }>>} */
const workDetailGallery = ref([])
const workDetailGalleryIndex = ref(0)
const viewedAssetIds = new Set()

const workDetailImageSrc = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.imageSrc ?? ''
})

/** 空字符串视为未传，弹层用内置模拟提示词 */
const workDetailPromptText = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  const t = g[i]?.promptText
  if (t === undefined || t === '') return undefined
  return t
})

const workDetailAuthorName = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.user?.name || '创作者'
})

const workDetailAuthorAvatarSrc = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.user?.avatarSrc || ''
})

const workDetailLikeCount = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.favoriteCount ?? 999
})

const currentWorkDetailAssetId = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.id || ''
})

const workDetailCreateDate = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.detail?.createDate || '2026-04-16'
})

const workDetailAiGeneratedText = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.detail?.aiGeneratedText || '内容由 AI 生成'
})

const workDetailPromptTipLabel = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.detail?.promptTipLabel || '图片提示词'
})

const workDetailModelLabel = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.detail?.modelLabel || '图片 4.1'
})

const workDetailAspectRatioLabel = computed(() => {
  const g = workDetailGallery.value
  const i = workDetailGalleryIndex.value
  return g[i]?.detail?.aspectRatioLabel || '9:16'
})

/**
 * 发现页点击图片/轮播：可带整组画廊以便弹层内上下切换
 * @param {{
 *   gallery: Array<{ imageSrc: string, promptText?: string, user?: { name?: string, avatarSrc?: string }, favoriteCount?: number|string, detail?: { createDate?: string, aiGeneratedText?: string, promptTipLabel?: string, modelLabel?: string, aspectRatioLabel?: string } }>
 *   index: number
 * } | { imageSrc: string, promptText?: string, user?: { name?: string, avatarSrc?: string }, favoriteCount?: number|string, detail?: { createDate?: string, aiGeneratedText?: string, promptTipLabel?: string, modelLabel?: string, aspectRatioLabel?: string } }} payload
 */
function handleOpenWorkDetail(payload) {
  if ('gallery' in payload && Array.isArray(payload.gallery) && payload.gallery.length > 0) {
    workDetailGallery.value = payload.gallery
    const ix = payload.index ?? 0
    workDetailGalleryIndex.value = Math.min(Math.max(0, ix), payload.gallery.length - 1)
  } else {
    workDetailGallery.value = [{
      id: payload.id,
      imageSrc: payload.imageSrc,
      promptText: payload.promptText,
      user: payload.user,
      favoriteCount: payload.favoriteCount,
      detail: payload.detail,
    }]
    workDetailGalleryIndex.value = 0
  }
  viewedAssetIds.clear()
  workDetailOpen.value = true
}

/** @param {number} delta -1 上一张，1 下一张（循环） */
function handleGalleryNav(delta) {
  const n = workDetailGallery.value.length
  if (n <= 1) return
  workDetailGalleryIndex.value = (workDetailGalleryIndex.value + delta + n) % n
}

async function trackWorkDetailView() {
  const assetId = currentWorkDetailAssetId.value
  if (!assetId || viewedAssetIds.has(assetId)) return

  viewedAssetIds.add(assetId)

  try {
    await applyAssetAction('view', [assetId])
  } catch (error) {
    console.warn('记录作品浏览失败', error)
  }
}

async function handleWorkDetailFavorite() {
  const assetId = currentWorkDetailAssetId.value
  if (!assetId) return

  const index = workDetailGalleryIndex.value
  const current = workDetailGallery.value[index]
  const currentCount = Number(current?.favoriteCount || 0) || 0

  if (current) {
    workDetailGallery.value[index] = {
      ...current,
      favoriteCount: currentCount + 1,
    }
  }

  try {
    await applyAssetAction('favorite', [assetId])
  } catch (error) {
    if (current) {
      workDetailGallery.value[index] = {
        ...current,
        favoriteCount: currentCount,
      }
    }
    console.warn('收藏作品失败', error)
  }
}

watch(
  [workDetailOpen, currentWorkDetailAssetId],
  ([open]) => {
    if (!open) return
    void trackWorkDetailView()
  },
)
</script>

<style scoped>

</style>
