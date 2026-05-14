<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lv-modal-wrapper lv-modal-wrapper-align-center research-source-modal-wrapper"
      @click.self="close"
    >
      <div class="lv-modal-mask" @click="close"></div>
      <div role="dialog" aria-modal="true" class="lv-modal lv-modal-simple research-source-modal">
        <div class="research-source-modal__header">
          <div class="research-source-modal__title">{{ titleText }}</div>
          <button class="research-source-modal__close" type="button" @click="close">
            <span class="research-source-modal__close-icon">×</span>
          </button>
        </div>

        <div class="research-source-modal__body">
          <div v-if="items.length" class="research-source-dialog__list">
            <article
              v-for="item in items"
              :key="item.id"
              class="research-source-dialog__item"
            >
              <div class="research-source-dialog__item-top">
                <span v-if="item.referenceLabel" class="research-source-dialog__badge">{{ item.referenceLabel }}</span>
                <span v-if="item.metaLabel" class="research-source-dialog__meta">{{ item.metaLabel }}</span>
              </div>
              <a
                v-if="item.url"
                class="research-source-dialog__title is-link"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ item.title }}
              </a>
              <div v-else class="research-source-dialog__title">
                {{ item.title }}
              </div>
              <div v-if="item.siteName || item.domain" class="research-source-dialog__site">
                {{ item.siteName || item.domain }}
              </div>
              <p v-if="item.snippet" class="research-source-dialog__snippet">{{ item.snippet }}</p>
            </article>
          </div>
          <div v-else class="research-source-dialog__empty">{{ emptyText }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ResearchSourceDialogItem } from './research-report-record.types'

const props = defineProps<{
  visible: boolean
  items: ResearchSourceDialogItem[]
  title?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
}>()

const titleText = computed(() => String(props.title || '查看信源').trim() || '查看信源')
const emptyText = computed(() => String(props.emptyText || '当前还没有可展示的信源').trim() || '当前还没有可展示的信源')

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.research-source-modal-wrapper {
  align-items: center;
  display: flex !important;
  justify-content: center;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 16px;
  position: fixed;
  top: 0;
  z-index: 1003;
}

.research-source-modal-wrapper .lv-modal-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.56);
  z-index: 1001;
}

.research-source-modal {
  position: relative;
  z-index: 1002;
  width: min(760px, calc(100vw - 32px));
  max-height: min(78vh, 860px);
  overflow: hidden;
  border-radius: 16px;
  background: var(--bg-float, var(--bg-surface, #1b1d22));
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28), 0 8px 24px rgba(0, 0, 0, 0.18);
}

.research-source-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--stroke-secondary, rgba(255, 255, 255, 0.08));
}

.research-source-modal__title {
  color: var(--text-primary, #f5fbff);
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
}

.research-source-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--text-secondary, rgba(224, 245, 255, 0.56));
  background: transparent;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.research-source-modal__close:hover {
  color: var(--text-primary, #f5fbff);
  background: var(--bg-block-secondary-default, rgba(255, 255, 255, 0.06));
}

.research-source-modal__close-icon {
  font-size: 18px;
  line-height: 1;
}

.research-source-modal__body {
  max-height: calc(min(78vh, 860px) - 75px);
  overflow-y: auto;
  padding: 16px 24px 24px;
}

.research-source-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.research-source-dialog__item {
  padding: 12px;
  border: 1px solid var(--stroke-secondary, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.02));
}

.research-source-dialog__item-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.research-source-dialog__badge,
.research-source-dialog__meta {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
}

.research-source-dialog__badge {
  color: var(--brand-main-default, #00cae0);
  background: color-mix(in srgb, var(--brand-main-default, #00cae0) 14%, transparent);
}

.research-source-dialog__meta {
  color: var(--text-secondary, rgba(224, 245, 255, 0.56));
  background: var(--bg-block-secondary-default, rgba(255, 255, 255, 0.06));
}

.research-source-dialog__title {
  color: var(--text-primary, #f5fbff);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.research-source-dialog__title.is-link {
  text-decoration: none;
}

.research-source-dialog__title.is-link:hover {
  color: var(--brand-main-default, #00cae0);
  text-decoration: underline;
}

.research-source-dialog__site {
  margin-top: 4px;
  color: var(--text-tertiary, rgba(224, 245, 255, 0.34));
  font-size: 12px;
  line-height: 18px;
}

.research-source-dialog__snippet {
  margin: 8px 0 0;
  color: var(--text-secondary, rgba(224, 245, 255, 0.56));
  font-size: 12px;
  line-height: 19px;
  white-space: pre-wrap;
}

.research-source-dialog__empty {
  color: var(--text-tertiary, rgba(224, 245, 255, 0.34));
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 760px) {
  .research-source-modal-wrapper {
    align-items: flex-end;
    padding: 12px;
  }

  .research-source-modal {
    width: min(760px, calc(100vw - 24px));
    max-height: min(82vh, 860px);
    border-radius: 18px 18px 14px 14px;
  }

  .research-source-modal__header {
    padding: 18px 18px 14px;
  }

  .research-source-modal__body {
    max-height: calc(min(82vh, 860px) - 68px);
    padding: 14px 18px 18px;
  }
}
</style>
