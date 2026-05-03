import { reactive } from 'vue'

interface UseAdminPaginationOptions {
  initialPage?: number
  initialPageSize?: number
}

export const useAdminPagination = (options: UseAdminPaginationOptions = {}) => {
  const pagination = reactive({
    page: Math.max(1, Number(options.initialPage ?? 1)),
    pageSize: Math.max(1, Number(options.initialPageSize ?? 10)),
  })

  const resetPage = () => {
    pagination.page = 1
  }

  const getTotalPages = (total: number) => {
    return Math.max(1, Math.ceil(Math.max(0, total) / pagination.pageSize))
  }

  const ensureValidPage = (total: number) => {
    const totalPages = getTotalPages(total)
    if (pagination.page > totalPages) {
      pagination.page = totalPages
    }
  }

  const sliceItems = <TItem>(items: TItem[]) => {
    ensureValidPage(items.length)
    const start = (pagination.page - 1) * pagination.pageSize
    return items.slice(start, start + pagination.pageSize)
  }

  return {
    pagination,
    resetPage,
    getTotalPages,
    ensureValidPage,
    sliceItems,
  }
}
