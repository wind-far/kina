<template>
  <div class="jimeng-home-container">
    <div id="csr-root">
      <div class="global-dreamina-container">
        <div id="dreamina" class="root_bf55f">
          <div class="top-down-layer">
            <div class="container-moSF_y" style="--side-menu-width:76px">
              <SideMenu />

              <div class="content-wrapper-OzVFU5">
                <div id="dreamina-ui-configuration-content-wrapper" class="main-container-TrGK7G">
                  <div class="content-V2NaRy">
                    <div class="container-xPaqsy">
                      <div class="container-VHHcGs">
                        <div class="back-button-Na1aul sf-hidden">
                          <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                            <g>
                              <path data-follow-fill="currentColor" d="M4.533 12.844a1.2 1.2 0 0 1 0-1.687l7.655-7.747a1.2 1.2 0 0 1 1.708 1.687l-6.822 6.904 6.822 6.903a1.2 1.2 0 1 1-1.708 1.686l-7.655-7.746Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
                            </g>
                          </svg>
                        </div>

                        <div class="profile-info">
                          <div class="avatar-wrapper">
                            <img
                              :src="resolvedProfileAvatar"
                              class="dreamina-component-avatar avatar-qnfikn account-profile-avatar"
                              :alt="displayUserName"
                            >
                          </div>

                          <div class="user-container">
                            <div class="user-name-ZcwgIM">{{ displayUserName }}</div>
                          </div>
                        </div>

                        <div class="statics">
                          <div class="line-x9qriG">
                            <div class="item-mNzHRl clickable-KAXO1W">
                              <span class="count-_olHcJ">{{ followerCount }}</span>
                              <span class="desc-j1T6yQ">粉丝</span>
                            </div>
                            <div class="item-mNzHRl clickable-KAXO1W">
                              <span class="count-_olHcJ">{{ followingCount }}</span>
                              <span class="desc-j1T6yQ">关注</span>
                            </div>
                          </div>
                        </div>

                        <div class="actions-vUPE88 is-myself">
                          <button class="share-btn" type="button" @click="handleShareProfile">
                            <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                              <g>
                                <path data-follow-fill="currentColor" d="M11.78 4.534a.942.942 0 0 1 1.572-.7l7.852 7.067a.895.895 0 0 1 0 1.33l-7.852 7.067a.942.942 0 0 1-1.572-.7v-3.173a9.328 9.328 0 0 0-7.384 3.115c-.519.581-1.555.27-1.562-.586v-.097c0-5.286 3.879-9.666 8.946-10.449V4.534Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
                              </g>
                            </svg>
                            <div class="share-btn-text">分享主页</div>
                          </button>

                          <button
                            class="share-btn account-logout-btn"
                            type="button"
                            :disabled="isLoggingOut"
                            @click="handleLogout"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                              <g>
                                <path data-follow-fill="currentColor" d="M10 4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-5a1 1 0 1 1 0-2h5a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-5a1 1 0 0 1-1-1Zm1.707 3.293a1 1 0 0 1 0 1.414L9.414 11H16a1 1 0 1 1 0 2H9.414l2.293 2.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                              </g>
                            </svg>
                            <div class="share-btn-text">{{ isLoggingOut ? '退出中...' : '退出登录' }}</div>
                          </button>
                        </div>

                        <div class="profile-description">
                          <div class="description-wrapper">
                            <span>{{ profileDescription }}</span>
                            <span style="margin-left:8px"></span>
                            <div class="edit-button hide-ODTLCX">
                              <svg width="14" height="14" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                  <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M9.024 20.055a1 1 0 0 0 .465-.263L19.906 9.375a3.735 3.735 0 1 0-5.282-5.281L4.207 14.51a1 1 0 0 0-.263.464l-1.289 5.157a1 1 0 0 0 1.213 1.212l5.156-1.289Zm7.014-14.547L5.818 15.73 5 19l3.27-.818 10.222-10.22a1.733 1.733 0 0 0-.563-2.83 1.735 1.735 0 0 0-1.89.376Zm3.878 15.242a1.083 1.083 0 0 0 0-2.167h-5.342a.17.17 0 0 0-.124.055l-1.623 1.758a.211.211 0 0 0 .155.354h6.934Z" fill="currentColor"></path>
                                </g>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="scroll-container-AhepyD">
                        <div>
                          <div class="right-container-VcENyg">
                            <div class="scroll-container-AhepyD scroll-container-B4jFKc">
                              <div>
                                <div class="scroll-content-Hn6N56">
                                  <div class="tab-group">
                                    <div class="left-tabs">
                                      <div class="tab-wrapper-aoGILw">
                                        <button
                                          class="item-vuuM4N"
                                          :class="{ 'active-n4SQx9': primaryTab === 'published' }"
                                          type="button"
                                          @click="primaryTab = 'published'"
                                        >
                                          <div>已发布</div>
                                        </button>
                                        <button
                                          class="item-vuuM4N account-tab-locked"
                                          type="button"
                                          @click="handleLockedTab"
                                        >
                                          <div>赞过</div>
                                          <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="icon-dNLP6Z">
                                            <g>
                                              <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 2a6 6 0 0 0-6 6v1.29A4.001 4.001 0 0 0 3.5 13v5a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-5A4.001 4.001 0 0 0 18 9.29V8a6 6 0 0 0-6-6Zm4 6v1H8V8a4 4 0 1 1 8 0Zm-8.5 3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-9Zm4.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" fill="currentColor"></path>
                                            </g>
                                          </svg>
                                        </button>
                                      </div>

                                      <div class="tab-divider"></div>

                                      <div class="tab-wrapper-eJkl7m">
                                        <button
                                          class="item-oLZMRc"
                                          :class="{ 'active-PqJ0p3': secondaryTab === 'inspiration' }"
                                          type="button"
                                          @click="secondaryTab = 'inspiration'"
                                        >
                                          <div>灵感</div>
                                        </button>
                                        <button
                                          class="item-oLZMRc"
                                          :class="{ 'active-PqJ0p3': secondaryTab === 'short-video' }"
                                          type="button"
                                          @click="secondaryTab = 'short-video'"
                                        >
                                          <div>AI短片</div>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div class="feed-list" style="display:block">
                                    <div
                                      v-if="visibleGalleryItems.length"
                                      ref="masonryContainerRef"
                                      class="masonry-layout-UFZlSA masonry-layout account-masonry-layout"
                                      :style="masonryViewportStyle"
                                    >
                                      <div
                                        class="masonry-layout-scroll-content-_Gm3oO account-masonry-grid"
                                        :style="masonryViewportStyle"
                                      >
                                        <div
                                          v-for="(item, index) in visibleGalleryItems"
                                          :key="item.id"
                                          class="masonry-layout-item-Uj6_im masonry-layout-item account-masonry-item"
                                          :style="getMasonryItemStyle(index)"
                                        >
                                          <div class="feed-item-WyLpPh feed-item-image-kx3bnF cover-container-d6w2vX" @click="openWorkDetail(item.id)">
                                            <div class="content-B9Vipz">
                                              <div class="container-bbbsvQ account-feed-card-shell">
                                                <img

                                                  loading="lazy"
                                                  class="cover-Qo4B2U"
                                                  :src="item.imageSrc"
                                                  :alt="item.id"
                                                  @load="onFeedImageLoad($event, index)"
                                                  @error="onFeedImageError(index)"
                                                >
                                              </div>

                                              <div class="top-overlay">
                                                <div>
                                                  <div v-if="item.badgeText" class="badge-inhDJv">{{ item.badgeText }}</div>
                                                </div>
                                              </div>

                                              <div class="overlay-WWIpyU">
                                                <div class="head-wYUoMC">
                                                  <div class="author-g6lhbl">
                                                    <div class="dreamina-component-avatar-container avatar-LRSR55">
                                                      <img :src="item.authorAvatarSrc" class="dreamina-component-avatar" :alt="item.authorName">
                                                    </div>
                                                    <span class="username">{{ item.authorName }}</span>
                                                  </div>
                                                </div>

                                                <div class="tail">
                                                  <div class="operation">
                                                    <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="icon-yH97ZW">
                                                      <g>
                                                        <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M4.92 3.537a4 4 0 0 0-2.83 4.899l2.585 9.645a4 4 0 0 0 4.899 2.829l2.737-.733a3.403 3.403 0 0 1-.874-1.837l-2.381.638a2 2 0 0 1-2.45-1.414L4.023 7.918a2 2 0 0 1 1.414-2.45l3.288-.88a2 2 0 0 1 2.45 1.414l2.318 8.654.553-.246a.683.683 0 0 0 .345-.368l.214-.516a3.56 3.56 0 0 1 .445-.784l-1.944-7.257a4 4 0 0 0-4.899-2.829l-3.287.881ZM21.6 9.766l-.885 3.303a3.332 3.332 0 0 0-1.687-1.433l.64-2.388a1.5 1.5 0 0 0-1.061-1.837l-2.437-.653a1.492 1.492 0 0 0-.659-.026l-.473-1.765c-.01-.039-.022-.077-.034-.115l-.016-.055a3.485 3.485 0 0 1 1.7.03l2.436.652A3.5 3.5 0 0 1 21.6 9.766Zm-3.433 11.127.208-.477a3.68 3.68 0 0 1 1.871-1.899l.64-.285a.447.447 0 0 0 0-.812l-.604-.269a3.682 3.682 0 0 1-1.898-1.961l-.214-.516a.427.427 0 0 0-.794 0l-.213.516a3.681 3.681 0 0 1-1.898 1.961l-.605.27a.447.447 0 0 0 0 .811l.64.285a3.68 3.68 0 0 1 1.872 1.899l.207.477a.427.427 0 0 0 .788 0Z" fill="currentColor"></path>
                                                      </g>
                                                    </svg>
                                                  </div>
                                                  <div class="operation">
                                                    <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="icon-yH97ZW">
                                                      <g>
                                                        <path data-follow-fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M16.326 4.72H7.674A2.954 2.954 0 0 0 4.72 7.674v8.652c0 .054.001.108.004.162l3.509-3.508a2.954 2.954 0 0 1 4.03-.138l6.262 5.457c.47-.523.755-1.215.755-1.973V7.674a2.954 2.954 0 0 0-2.954-2.954Zm2.798 15.658a4.919 4.919 0 0 0 2.126-4.052V7.674a4.924 4.924 0 0 0-4.924-4.924H7.674A4.924 4.924 0 0 0 2.75 7.674v8.652a4.924 4.924 0 0 0 4.924 4.924h8.652a4.901 4.901 0 0 0 2.798-.872Zm-2.489-1.114-5.666-4.937a.985.985 0 0 0-1.344.046l-4.041 4.04a2.945 2.945 0 0 0 2.09.867h8.652c.104 0 .208-.005.31-.016ZM14.078 8.401a1.532 1.532 0 1 1 3.064 0 1.532 1.532 0 0 1-3.064 0Z" fill="currentColor"></path>
                                                      </g>
                                                    </svg>
                                                  </div>
                                                  <div>
                                                    <div class="favorite-RlC8dW">
                                                      <div class="lottie-icon-container icon-QlNaEG">
                                                        <div class="lottie-icon-content">
                                                          <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="icon-QlNaEG">
                                                            <g>
                                                              <path data-follow-fill="currentColor" d="M8.538 3.513a6.077 6.077 0 0 0-6.085 6.07c0 2.819 1.639 5.278 3.37 7.025 1.75 1.764 3.914 3.13 5.588 3.685a1.87 1.87 0 0 0 1.174 0c1.675-.556 3.84-1.92 5.588-3.685 1.732-1.747 3.37-4.206 3.37-7.025a6.077 6.077 0 0 0-6.084-6.07c-1.381 0-2.572.717-3.46 1.432-.889-.715-2.08-1.432-3.461-1.432Zm0 2a4.077 4.077 0 0 0-4.085 4.07c0 2.05 1.215 4.028 2.79 5.617 1.557 1.57 3.436 2.73 4.755 3.18 1.32-.45 3.2-1.61 4.755-3.18 1.575-1.59 2.79-3.568 2.79-5.617 0-2.24-1.82-4.07-4.084-4.07-.929 0-1.877.652-2.78 1.49a1 1 0 0 1-1.36 0c-.904-.838-1.853-1.49-2.781-1.49Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
                                                            </g>
                                                          </svg>
                                                        </div>
                                                      </div>
                                                      <span class="account-feed-favorite-count">{{ item.favoriteCount }}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div v-else class="account-empty-state">
                                      <div class="account-empty-title">{{ emptyTitle }}</div>
                                      <div class="account-empty-description">{{ emptyDescription }}</div>
                                    </div>

                                    <div class="feed-list-no-more">没有更多了</div>
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
            </div>
          </div>
        </div>
      </div>
    </div>

    <HomeDetailModalFrom
      v-model="workDetailOpen"
      :image-src="workDetailImageSrc"
      :owner-id="currentWorkDetailItem?.ownerId || ''"
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
      @delete="handleWorkDetailDelete"
      @report="handleWorkDetailReport"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import SideMenu from '@/components/home/components/SideMenu.vue'
import HomeDetailModalFrom from '@/components/home/components/HomeDetailModalFrom.vue'
import { applyAssetAction, listAssetItems, type PersistedAssetItem } from '@/api/asset-items'
import { buildAssetUrl } from '@/api/http'
import {
  buildPlainMasonryLayoutsFromSizes,
  computePlainMasonryMetrics,
  plainMasonryScrollHeight,
  type MasonryRect,
} from '@/components/home/discoverMasonryLayout'
import { AUTH_LOGIN_SUCCESS_EVENT, useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

interface AccountFeedItem {
  id: string
  ownerId: string
  imageSrc: string
  promptText: string
  authorName: string
  authorAvatarSrc: string
  favoriteCount: number
  modelLabel: string
  aspectRatioLabel: string
  createDate: string
  aiGeneratedText: string
  promptTipLabel: string
  badgeText: string
  assetType: 'image' | 'video'
  publishStatus: string
  visibility: string
  reviewStatus: string
}

// 默认头像占位图，避免无头像用户在个人中心中显示为空白。
const EMPTY_AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' rx='100' fill='%23E5E7EB'/%3E%3Ccircle cx='100' cy='76' r='30' fill='%239CA3AF'/%3E%3Cpath d='M52 154c8-24 28-38 48-38s40 14 48 38' fill='%239CA3AF'/%3E%3C/svg%3E"

// 读取当前认证状态。
const authStore = useAuthStore()
const router = useRouter()

// 登录成功后的页面数据刷新监听器。
let authLoginSuccessListener: (() => void) | null = null

// 顶部一级标签。
const primaryTab = ref<'published' | 'liked'>('published')

// 顶部二级标签。
const secondaryTab = ref<'inspiration' | 'short-video'>('inspiration')

// 个人中心作品列表。
const accountFeedItems = ref<AccountFeedItem[]>([])

// 是否正在退出登录。
const isLoggingOut = ref(false)

// 详情弹层状态。
const workDetailOpen = ref(false)

// 当前详情画廊。
const workDetailGallery = ref<AccountFeedItem[]>([])

// 当前详情下标。
const workDetailGalleryIndex = ref(0)

// 作品区瀑布流根节点。
const masonryContainerRef = ref<HTMLElement | null>(null)

// 当前轨道宽度。
const masonryTrackWidth = ref(0)

// 图片自然尺寸列表，保证布局和 HTML 一样依赖运行时计算结果。
const feedNaturalSizes = ref<Array<{ w: number; h: number } | null>>([])

// 瀑布流监听器。
let masonryResizeObserver: ResizeObserver | null = null

// 头像优先使用真实登录用户头像。
const resolvedProfileAvatar = computed(() => {
  return authStore.currentUser.value?.avatarUrl || EMPTY_AVATAR_DATA_URI
})

// 展示昵称优先级：昵称、手机号、邮箱。
const displayUserName = computed(() => {
  const currentUser = authStore.currentUser.value
  return currentUser?.name || currentUser?.maskedPhone || currentUser?.maskedEmail || '登录用户'
})

// 个人简介先用登录标识兜底，避免空白。
const profileDescription = computed(() => {
  const currentUser = authStore.currentUser.value
  return currentUser?.email || currentUser?.phone || '添加个人简介'
})

// 当前项目还没有关系链，这里先保持参考页默认值。
const followerCount = computed(() => 0)

// 当前项目还没有关系链，这里先保持参考页默认值。
const followingCount = computed(() => 0)

// 当前列表根据二级标签过滤。
const visibleGalleryItems = computed(() => {
  if (primaryTab.value !== 'published') return []
  return accountFeedItems.value
})

// 图片列表变化时，重置自然尺寸缓存。
watch(
  () => visibleGalleryItems.value.map(item => item.imageSrc),
  (urls) => {
    feedNaturalSizes.value = urls.map(() => null)
  },
  { immediate: true },
)

// 作品区内容层行内样式，收敛到和参考页一致的绝对定位布局。
const masonryViewportStyle = computed(() => {
  return {
    height: `${masonryHeight.value}px`,
    maxHeight: `${masonryHeight.value}px`,
  }
})

// 空态标题文案。
const emptyTitle = computed(() => {
  return secondaryTab.value === 'short-video' ? '暂无 AI 短片' : '暂无已发布作品'
})

// 空态补充文案。
const emptyDescription = computed(() => {
  return secondaryTab.value === 'short-video'
    ? '完成视频生成后，会按参考页布局展示在这里。'
    : '完成图片生成并发布后，会按参考页布局展示在这里。'
})

// 当前详情项。
const currentWorkDetailItem = computed(() => {
  return workDetailGallery.value[workDetailGalleryIndex.value] || null
})

// 详情弹层主图。
const workDetailImageSrc = computed(() => currentWorkDetailItem.value?.imageSrc || '')

// 详情弹层提示词。
const workDetailPromptText = computed(() => currentWorkDetailItem.value?.promptText || '')

// 详情弹层作者名称。
const workDetailAuthorName = computed(() => currentWorkDetailItem.value?.authorName || '创作者')

// 详情弹层作者头像。
const workDetailAuthorAvatarSrc = computed(() => currentWorkDetailItem.value?.authorAvatarSrc || '')

// 详情弹层点赞数。
const workDetailLikeCount = computed(() => currentWorkDetailItem.value?.favoriteCount || 0)

// 详情弹层创建时间。
const workDetailCreateDate = computed(() => currentWorkDetailItem.value?.createDate || '2026-04-26')

// 详情弹层 AI 文案。
const workDetailAiGeneratedText = computed(() => currentWorkDetailItem.value?.aiGeneratedText || '内容由 AI 生成')

// 详情弹层提示标题。
const workDetailPromptTipLabel = computed(() => currentWorkDetailItem.value?.promptTipLabel || '图片提示词')

// 详情弹层模型文案。
const workDetailModelLabel = computed(() => currentWorkDetailItem.value?.modelLabel || '图片 4.1')

// 详情弹层比例文案。
const workDetailAspectRatioLabel = computed(() => currentWorkDetailItem.value?.aspectRatioLabel || '1:1')

// 统一格式化日期分组显示。
const formatDateLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '2026-04-26'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 把资源接口结果转换成个人中心卡片结构。
const mapAssetToFeedItem = (item: PersistedAssetItem): AccountFeedItem => {
  return {
    id: item.id,
    ownerId: item.owner?.id || '',
    imageSrc: buildAssetUrl(item.previewUrl || item.coverUrl || item.fileUrl),
    promptText: item.promptText || '',
    authorName: authStore.currentUser.value?.name || item.owner?.name || '创作者',
    authorAvatarSrc: buildAssetUrl(authStore.currentUser.value?.avatarUrl || item.owner?.avatarSrc || EMPTY_AVATAR_DATA_URI),
    favoriteCount: Number(item.favoriteCount || 0),
    modelLabel: item.modelLabel || '图片 4.1',
    aspectRatioLabel: item.aspectRatio || '1:1',
    createDate: formatDateLabel(item.createdAt),
    aiGeneratedText: '内容由 AI 生成',
    promptTipLabel: '图片提示词',
    badgeText: item.reviewStatus !== 'approved' ? '审核中' : '',
    assetType: item.assetType,
    publishStatus: item.publishStatus || 'draft',
    visibility: item.visibility || 'private',
    reviewStatus: item.reviewStatus || 'pending',
  }
}

// 记录图片真实尺寸，保持瀑布流高度和 HTML 一致由运行时驱动。
const onFeedImageLoad = (event: Event, index: number) => {
  const target = event.target as HTMLImageElement | null
  if (!target?.naturalWidth || !target?.naturalHeight) {
    return
  }

  const nextSizes = [...feedNaturalSizes.value]
  nextSizes[index] = {
    w: target.naturalWidth,
    h: target.naturalHeight,
  }
  feedNaturalSizes.value = nextSizes
}

// 图片加载失败时按方图占位，避免整个布局断掉。
const onFeedImageError = (index: number) => {
  if (feedNaturalSizes.value[index]) {
    return
  }

  const nextSizes = [...feedNaturalSizes.value]
  nextSizes[index] = { w: 1, h: 1 }
  feedNaturalSizes.value = nextSizes
}

// 加载个人中心资源列表。
const loadAccountFeedItems = async () => {
  try {
    const assets = await listAssetItems({
      scope: 'mine',
      assetType: secondaryTab.value === 'short-video' ? 'video' : 'image',
      take: 60,
      publishState: primaryTab.value === 'published' ? 'published' : 'all',
    })

    if (assets.length) {
      accountFeedItems.value = assets.map(mapAssetToFeedItem)
      return
    }

    accountFeedItems.value = []
  } catch (error) {
    console.warn('读取个人中心资源失败。', error)
    accountFeedItems.value = []
  }
}

// 点击锁定标签时给出轻提示，和参考页的禁用感一致。
const handleLockedTab = () => {
  ElMessage.info('赞过内容暂未开放')
}

// 分享主页先复制当前地址。
const handleShareProfile = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    ElMessage.success('主页链接已复制')
  } catch (error) {
    console.warn('复制主页链接失败', error)
    ElMessage.info('当前浏览器暂不支持自动复制')
  }
}

// 退出当前登录用户，并回到首页显示登录入口。
const handleLogout = async () => {
  if (isLoggingOut.value) {
    return
  }

  isLoggingOut.value = true

  try {
    await authStore.logout()
    ElMessage.success('已退出登录')
    await router.replace({
      path: '/',
      query: {
        login: '1',
      },
    })
  } catch (error) {
    console.warn('退出登录失败', error)
  } finally {
    isLoggingOut.value = false
  }
}

// 打开作品详情弹层。
const openWorkDetail = (id: string) => {
  const currentIndex = visibleGalleryItems.value.findIndex(item => item.id === id)
  if (currentIndex < 0) return

  workDetailGallery.value = visibleGalleryItems.value
  workDetailGalleryIndex.value = currentIndex
  workDetailOpen.value = true

  void applyAssetAction('view', [id]).catch((error) => {
    console.warn('记录个人中心作品浏览失败', error)
  })
}

// 详情弹层切换上一张下一张。
const handleGalleryNav = (delta: number) => {
  const total = workDetailGallery.value.length
  if (total <= 1) return

  workDetailGalleryIndex.value = (workDetailGalleryIndex.value + delta + total) % total
}

// 详情弹层点赞动作。
const handleWorkDetailFavorite = async () => {
  const currentItem = currentWorkDetailItem.value
  if (!currentItem) return

  currentItem.favoriteCount += 1

  try {
    await applyAssetAction('favorite', [currentItem.id])
  } catch (error) {
    currentItem.favoriteCount -= 1
    console.warn('个人中心点赞失败', error)
  }
}

const removeCurrentWorkDetailItem = () => {
  const currentItem = currentWorkDetailItem.value
  if (!currentItem) return ''

  accountFeedItems.value = accountFeedItems.value.filter(item => item.id !== currentItem.id)
  workDetailGallery.value = workDetailGallery.value.filter(item => item.id !== currentItem.id)

  if (!workDetailGallery.value.length) {
    workDetailOpen.value = false
    workDetailGalleryIndex.value = 0
  } else if (workDetailGalleryIndex.value >= workDetailGallery.value.length) {
    workDetailGalleryIndex.value = workDetailGallery.value.length - 1
  }

  return currentItem.id
}

const handleWorkDetailDelete = async () => {
  const currentItem = currentWorkDetailItem.value
  if (!currentItem) return

  try {
    await ElMessageBox.confirm('确定删除这条作品吗？删除后将无法恢复。', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  await applyAssetAction('delete', [currentItem.id])
  removeCurrentWorkDetailItem()
  ElMessage.success('作品已删除')
}

const handleWorkDetailReport = () => {
  ElMessage.success('举报已提交，我们会尽快处理')
}

// 按轨道宽度计算列数与列宽。
const masonryMetrics = computed(() => computePlainMasonryMetrics({
  trackWidth: masonryTrackWidth.value,
  minColumnWidth: 220,
  maxColumnWidth: 252,
  maxColumns: 7,
  columnGap: 16,
}))

// 生成与 HTML 一致的绝对定位瀑布流布局。
const masonryLayouts = computed<MasonryRect[]>(() => (
  buildPlainMasonryLayoutsFromSizes(feedNaturalSizes.value, masonryMetrics.value)
))

// 作品区滚动高度。
const masonryHeight = computed(() => plainMasonryScrollHeight(masonryLayouts.value))

// 读取单个卡片定位样式。
const getMasonryItemStyle = (index: number) => {
  const current = masonryLayouts.value[index]
  return {
    left: `${current?.left || 0}px`,
    top: `${current?.top || 0}px`,
    width: `${current?.width || 0}px`,
    height: `${current?.height || 0}px`,
  }
}

// 页面初始化时优先读取真实资源。
onMounted(async () => {
  masonryResizeObserver = new ResizeObserver(() => {
    const host = masonryContainerRef.value
    if (!host) {
      masonryTrackWidth.value = 0
      return
    }

    masonryTrackWidth.value = Math.floor(host.getBoundingClientRect().width)
  })

  await nextTick()
  if (masonryContainerRef.value) {
    masonryTrackWidth.value = Math.floor(masonryContainerRef.value.getBoundingClientRect().width)
    masonryResizeObserver.observe(masonryContainerRef.value)
  }

  await loadAccountFeedItems()

  authLoginSuccessListener = () => {
    void loadAccountFeedItems()
  }
  window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
})

// 只有在登录态初始化完成且确认未登录后，才回首页显示登录入口。
watch(
  [
    () => authStore.isLoggedIn.value,
    () => authStore.sessionInitialized.value,
    () => authStore.sessionLoading.value,
  ],
  ([isLoggedIn, sessionInitialized, sessionLoading]) => {
    if (isLoggedIn || !sessionInitialized || sessionLoading) {
      return
    }

    void router.replace({
      path: '/',
      query: {
        login: '1',
      },
    })
  },
)

// 切换到不同内容类型时，重新拉取对应资源。
watch(secondaryTab, async () => {
  await loadAccountFeedItems()
})

// 切换一级标签时，重新拉取对应发布态资源。
watch(primaryTab, async () => {
  await loadAccountFeedItems()
})

// 瀑布流根节点切换时，重新绑定尺寸监听。
watch(masonryContainerRef, async (element, previousElement) => {
  if (previousElement && masonryResizeObserver) {
    masonryResizeObserver.unobserve(previousElement)
  }

  await nextTick()

  if (element && masonryResizeObserver) {
    masonryTrackWidth.value = Math.floor(element.getBoundingClientRect().width)
    masonryResizeObserver.observe(element)
  }
})

// 组件卸载时释放观察器。
onBeforeUnmount(() => {
  masonryResizeObserver?.disconnect()
  masonryResizeObserver = null
  if (authLoginSuccessListener) {
    window.removeEventListener(AUTH_LOGIN_SUCCESS_EVENT, authLoginSuccessListener)
    authLoginSuccessListener = null
  }
})
</script>

<style src="./account-center.css"></style>
