export interface PaginationQuery {
  page: number
  pageSize: number
}

export interface PaginationSummary extends PaginationQuery {
  totalCount: number
  totalPages: number
}

export interface ResolvedPagination extends PaginationSummary {
  skip: number
}

export interface PageResult<TItem> {
  items: TItem[]
  summary: PaginationSummary
}

interface PaginationOptions {
  defaultPage?: number
  defaultPageSize?: number
  maxPageSize?: number
}

// 将任意输入值转为正整数，避免各后台接口重复写 Number / Math.floor 防御逻辑。
const toPositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

// 读取 URL 中的通用分页参数，适用于后台 GET 列表接口。
export const readPaginationQuery = (
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): PaginationQuery => {
  const defaultPage = toPositiveInteger(options.defaultPage, 1)
  const defaultPageSize = toPositiveInteger(options.defaultPageSize, 20)
  const maxPageSize = toPositiveInteger(options.maxPageSize, 100)
  const page = toPositiveInteger(searchParams.get('page'), defaultPage)
  const requestedPageSize = toPositiveInteger(searchParams.get('pageSize'), defaultPageSize)

  return {
    page,
    pageSize: Math.min(requestedPageSize, maxPageSize),
  }
}

// 根据总数修正页码并计算 skip，确保空结果也保留第一页结构。
export const resolvePagination = (
  query: PaginationQuery,
  totalCount: number,
  options: PaginationOptions = {},
): ResolvedPagination => {
  const defaultPageSize = toPositiveInteger(options.defaultPageSize, 20)
  const maxPageSize = toPositiveInteger(options.maxPageSize, 100)
  const pageSize = Math.min(toPositiveInteger(query.pageSize, defaultPageSize), maxPageSize)
  const safeTotalCount = Math.max(0, Math.floor(Number(totalCount) || 0))
  const totalPages = Math.max(1, Math.ceil(safeTotalCount / pageSize))
  const page = Math.min(Math.max(1, toPositiveInteger(query.page, 1)), totalPages)

  return {
    totalCount: safeTotalCount,
    totalPages,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  }
}

// 生成统一分页摘要，供列表接口组装 PageResult。
export const buildPageSummary = (pagination: ResolvedPagination): PaginationSummary => ({
  totalCount: pagination.totalCount,
  totalPages: pagination.totalPages,
  page: pagination.page,
  pageSize: pagination.pageSize,
})

// 统一组装分页返回值，保持后台列表接口协议一致。
export const buildPageResult = <TItem>(
  items: TItem[],
  pagination: ResolvedPagination,
): PageResult<TItem> => ({
  items,
  summary: buildPageSummary(pagination),
})
