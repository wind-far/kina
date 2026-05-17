import { computed, reactive, ref, type Ref } from 'vue'

interface AdminListSummary {
  totalCount?: number
  totalPages?: number
  page?: number
  pageSize?: number
}

interface AdminListResult<TItem> {
  items: TItem[]
  summary?: AdminListSummary
}

interface AdminListQuery {
  page: number
  pageSize: number
}

interface UseAdminListOptions<TItem extends { id: string }> {
  initialPage?: number
  initialPageSize?: number
  resetSelectionOnLoad?: boolean
  fetcher: (query: AdminListQuery) => Promise<AdminListResult<TItem>>
}

export const useAdminList = <TItem extends { id: string }>({
  initialPage = 1,
  initialPageSize = 10,
  resetSelectionOnLoad = true,
  fetcher,
}: UseAdminListOptions<TItem>) => {
  const loading = ref(false)
  const items = ref<TItem[]>([]) as Ref<TItem[]>
  const selectedMap = ref<Record<string, boolean>>({})
  const pagination = reactive({
    page: Math.max(1, Number(initialPage || 1)),
    pageSize: Math.max(1, Number(initialPageSize || 10)),
    total: 0,
    totalPages: 1,
  })

  const selectedIds = computed(() => Object.keys(selectedMap.value).filter((id) => selectedMap.value[id]))
  const currentPageIds = computed(() => items.value.map((item) => item.id))
  const selectedItems = computed(() => items.value.filter((item) => selectedMap.value[item.id]))
  const isAllSelected = computed(() => items.value.length > 0 && items.value.every((item) => selectedMap.value[item.id]))
  const isPartiallySelected = computed(() => !isAllSelected.value && items.value.some((item) => selectedMap.value[item.id]))

  const clearSelection = () => {
    selectedMap.value = {}
  }

  const syncPagination = (summary?: AdminListSummary) => {
    pagination.total = Number(summary?.totalCount || 0)
    pagination.totalPages = Number(summary?.totalPages || 1)
    pagination.page = Number(summary?.page || pagination.page)
    pagination.pageSize = Number(summary?.pageSize || pagination.pageSize)
  }

  const loadList = async () => {
    loading.value = true
    try {
      const result = await fetcher({
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      items.value = result.items
      syncPagination(result.summary)
      if (resetSelectionOnLoad) {
        clearSelection()
      }
    } finally {
      loading.value = false
    }
  }

  const resetAndLoad = async () => {
    pagination.page = 1
    await loadList()
  }

  const handlePaginationChange = async (payload: { page: number; pageSize: number }) => {
    pagination.page = payload.page
    pagination.pageSize = payload.pageSize
    await loadList()
  }

  const toggleSelect = (id: string, checked: boolean) => {
    selectedMap.value = {
      ...selectedMap.value,
      [id]: checked,
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      const nextSelectedMap = { ...selectedMap.value }
      currentPageIds.value.forEach((id) => {
        delete nextSelectedMap[id]
      })
      selectedMap.value = nextSelectedMap
      return
    }

    selectedMap.value = {
      ...selectedMap.value,
      ...Object.fromEntries(currentPageIds.value.map((id) => [id, true])),
    }
  }

  return {
    loading,
    items,
    pagination,
    selectedMap,
    selectedIds,
    selectedItems,
    isAllSelected,
    isPartiallySelected,
    clearSelection,
    loadList,
    resetAndLoad,
    handlePaginationChange,
    toggleSelect,
    toggleSelectAll,
  }
}
