<template>
  <div class="admin-pagination" :class="{ 'is-disabled': disabled }">
    <div class="admin-pagination__summary">
      <span class="admin-pagination__total">共 {{ total }} 条</span>
      <span v-if="total > 0" class="admin-pagination__range">
        当前显示 {{ startIndex }} - {{ endIndex }} 条
      </span>
    </div>

    <div class="admin-pagination__controls">
      <label v-if="resolvedPageSizeOptions.length > 0" class="admin-pagination__size">
        <span>每页</span>
        <select
          class="admin-pagination__select"
          :value="pageSize"
          :disabled="disabled"
          @change="handlePageSizeChange"
        >
          <option v-for="option in resolvedPageSizeOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
        <span>条</span>
      </label>

      <button
        class="admin-pagination__button"
        type="button"
        :disabled="disabled || currentPage <= 1"
        @click="updatePage(currentPage - 1)"
      >
        上一页
      </button>

      <button
        v-for="item in pageItems"
        :key="item.key"
        class="admin-pagination__button"
        :class="{ 'is-active': item.type === 'page' && item.value === currentPage, 'is-ellipsis': item.type === 'ellipsis' }"
        type="button"
        :disabled="disabled || item.type === 'ellipsis'"
        @click="item.type === 'page' && updatePage(item.value)"
      >
        {{ item.label }}
      </button>

      <button
        class="admin-pagination__button"
        type="button"
        :disabled="disabled || currentPage >= totalPages"
        @click="updatePage(currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PaginationItem {
  key: string
  label: string
  type: 'page' | 'ellipsis'
  value: number
}

const props = withDefaults(defineProps<{
  page: number
  pageSize: number
  total: number
  disabled?: boolean
  pageSizeOptions?: number[]
  maxVisiblePages?: number
}>(), {
  disabled: false,
  pageSizeOptions: () => [10, 20, 50, 100],
  maxVisiblePages: 7,
})

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'change': [payload: { page: number; pageSize: number }]
}>()

const resolvedPageSizeOptions = computed(() => {
  const options = Array.isArray(props.pageSizeOptions) ? props.pageSizeOptions : []
  return Array.from(new Set(
    options
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0),
  )).sort((first, second) => first - second)
})

const totalPages = computed(() => {
  const safePageSize = Math.max(1, Number(props.pageSize || 1))
  return Math.max(1, Math.ceil(Math.max(0, Number(props.total || 0)) / safePageSize))
})

const currentPage = computed(() => {
  const rawPage = Number(props.page || 1)
  return Math.min(Math.max(1, rawPage), totalPages.value)
})

const startIndex = computed(() => {
  if (props.total <= 0) {
    return 0
  }
  return (currentPage.value - 1) * props.pageSize + 1
})

const endIndex = computed(() => {
  if (props.total <= 0) {
    return 0
  }
  return Math.min(currentPage.value * props.pageSize, props.total)
})

// 统一产出页码按钮，超长时自动折叠成省略号，避免后台工具条过长。
const pageItems = computed<PaginationItem[]>(() => {
  const pages = totalPages.value
  const maxVisible = Math.max(5, Number(props.maxVisiblePages || 7))

  if (pages <= maxVisible) {
    return Array.from({ length: pages }, (_, index) => ({
      key: `page-${index + 1}`,
      label: String(index + 1),
      type: 'page',
      value: index + 1,
    }))
  }

  const items: PaginationItem[] = []
  const innerWindow = maxVisible - 2
  const halfWindow = Math.floor(innerWindow / 2)
  let start = Math.max(2, currentPage.value - halfWindow)
  let end = Math.min(pages - 1, start + innerWindow - 1)

  if (end >= pages - 1) {
    end = pages - 1
    start = Math.max(2, end - innerWindow + 1)
  }

  items.push({ key: 'page-1', label: '1', type: 'page', value: 1 })

  if (start > 2) {
    items.push({ key: 'ellipsis-left', label: '...', type: 'ellipsis', value: -1 })
  }

  for (let page = start; page <= end; page += 1) {
    items.push({ key: `page-${page}`, label: String(page), type: 'page', value: page })
  }

  if (end < pages - 1) {
    items.push({ key: 'ellipsis-right', label: '...', type: 'ellipsis', value: -1 })
  }

  items.push({ key: `page-${pages}`, label: String(pages), type: 'page', value: pages })
  return items
})

const emitChange = (page: number, pageSize: number) => {
  emit('change', { page, pageSize })
}

const updatePage = (page: number) => {
  const nextPage = Math.min(Math.max(1, page), totalPages.value)
  if (nextPage === currentPage.value) {
    return
  }
  emit('update:page', nextPage)
  emitChange(nextPage, props.pageSize)
}

const handlePageSizeChange = (event: Event) => {
  const nextPageSize = Math.max(1, Number((event.target as HTMLSelectElement).value || props.pageSize))
  if (nextPageSize === props.pageSize) {
    return
  }
  emit('update:pageSize', nextPageSize)
  emit('update:page', 1)
  emitChange(1, nextPageSize)
}
</script>

<style scoped>
.admin-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  padding-top: 16px;
  border-top: 1px solid var(--line-divider, #00000014);
}

.admin-pagination.is-disabled {
  opacity: 0.72;
}

.admin-pagination__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.admin-pagination__total {
  color: var(--text-secondary);
}

.admin-pagination__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.admin-pagination__size {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 4px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.admin-pagination__select {
  min-width: 74px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 10px;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
}

.admin-pagination__button {
  min-width: 34px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line-divider, #00000014);
  border-radius: 10px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color .2s ease, color .2s ease, border-color .2s ease, transform .2s ease;
}

.admin-pagination__button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--brand-main-default) 28%, var(--line-divider, #00000014));
  color: var(--text-primary);
}

.admin-pagination__button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.admin-pagination__button.is-active {
  background: var(--brand-main-default);
  border-color: var(--brand-main-default);
  color: #fff;
}

.admin-pagination__button.is-ellipsis {
  min-width: 34px;
  padding: 0 10px;
}
</style>
