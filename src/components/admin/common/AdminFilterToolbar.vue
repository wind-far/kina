<template>
  <form class="admin-filter-toolbar" :class="{ 'is-collapsed': isBodyCollapsed }" @submit.prevent="emit('apply')" @reset.prevent="emit('reset')">
    <div v-if="hasHeader" class="admin-filter-toolbar__header">
      <div class="admin-filter-toolbar__heading">
        <div v-if="title" class="admin-filter-toolbar__title">{{ title }}</div>
        <div v-if="description" class="admin-filter-toolbar__desc">{{ description }}</div>
      </div>
      <div class="admin-filter-toolbar__header-actions">
        <span v-if="activeCount > 0" class="admin-filter-toolbar__count">已启用 {{ activeCount }} 项</span>
        <button
          v-if="collapsible"
          class="admin-inline-button"
          type="button"
          :disabled="disabled"
          @click="toggleCollapsed"
        >
          {{ isBodyCollapsed ? '展开筛选' : '收起筛选' }}
        </button>
      </div>
    </div>

    <div v-show="!isBodyCollapsed" class="admin-filter-toolbar__body">
      <div v-if="$slots.search || hasActions" class="admin-filter-toolbar__top">
        <div v-if="$slots.search" class="admin-filter-toolbar__search">
          <slot name="search" />
        </div>
        <div v-if="hasActions" class="admin-filter-toolbar__actions">
          <slot name="actions">
            <button v-if="showReset" class="admin-button admin-button--secondary" type="reset" :disabled="disabled">{{ resetLabel }}</button>
            <button v-if="showApply" class="admin-button admin-button--primary" type="submit" :disabled="disabled">{{ applyLabel }}</button>
          </slot>
        </div>
      </div>

      <div v-if="$slots.filters || $slots.meta" class="admin-filter-toolbar__bottom">
        <div v-if="$slots.filters" class="admin-filter-toolbar__filters">
          <slot name="filters" />
        </div>
        <div v-if="$slots.meta" class="admin-filter-toolbar__meta">
          <slot name="meta" />
        </div>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  activeCount?: number
  collapsible?: boolean
  defaultCollapsed?: boolean
  disabled?: boolean
  showReset?: boolean
  showApply?: boolean
  resetLabel?: string
  applyLabel?: string
}>(), {
  title: '',
  description: '',
  activeCount: 0,
  collapsible: false,
  defaultCollapsed: false,
  disabled: false,
  showReset: false,
  showApply: false,
  resetLabel: '重置',
  applyLabel: '应用筛选',
})

const emit = defineEmits<{
  apply: []
  reset: []
  'collapse-change': [collapsed: boolean]
}>()

const slots = useSlots()
const collapsed = ref(props.defaultCollapsed)
const hasHeader = computed(() => Boolean(props.title || props.description || props.activeCount > 0 || props.collapsible))
const hasActions = computed(() => Boolean(slots.actions || props.showReset || props.showApply))
const isBodyCollapsed = computed(() => props.collapsible && collapsed.value)

const toggleCollapsed = () => {
  if (props.disabled) {
    return
  }
  collapsed.value = !collapsed.value
}

watch(collapsed, (nextCollapsed) => {
  emit('collapse-change', nextCollapsed)
})
</script>

<style scoped>
.admin-filter-toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-surface) 82%, var(--bg-block-secondary-default));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--bg-surface) 70%, transparent);
}

.admin-filter-toolbar__header,
.admin-filter-toolbar__top,
.admin-filter-toolbar__bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px 16px;
}

.admin-filter-toolbar__heading {
  min-width: 0;
}

.admin-filter-toolbar__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.admin-filter-toolbar__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary);
}

.admin-filter-toolbar__header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-filter-toolbar__count {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--brand-main-block-default);
  color: var(--brand-main-default);
  font-size: 12px;
  font-weight: 700;
}

.admin-filter-toolbar__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.admin-filter-toolbar__search,
.admin-filter-toolbar__filters {
  flex: 1;
  min-width: 0;
}

.admin-filter-toolbar__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.admin-filter-toolbar__filters :deep(.admin-input),
.admin-filter-toolbar__filters :deep(.admin-select) {
  width: auto;
  min-width: min(220px, 100%);
  flex: 1 1 220px;
}

.admin-filter-toolbar__filters :deep(.admin-filter-chips) {
  flex: 1 1 100%;
}

.admin-filter-toolbar__actions,
.admin-filter-toolbar__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .admin-filter-toolbar__header,
  .admin-filter-toolbar__top,
  .admin-filter-toolbar__bottom {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-filter-toolbar__header-actions,
  .admin-filter-toolbar__actions,
  .admin-filter-toolbar__meta {
    justify-content: flex-start;
  }

  .admin-filter-toolbar__filters :deep(.admin-input),
  .admin-filter-toolbar__filters :deep(.admin-select) {
    width: 100%;
    flex-basis: 100%;
  }
}
</style>
