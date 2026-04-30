import { computed } from 'vue'

type FilterObject = object

interface UseAdminListFiltersOptions<TFilters extends FilterObject> {
  filters: TFilters
  defaults: TFilters
  isEmptyValue?: (key: keyof TFilters, value: TFilters[keyof TFilters], defaultValue: TFilters[keyof TFilters]) => boolean
}

const defaultIsEmptyValue = <TFilters extends FilterObject>(
  _key: keyof TFilters,
  value: TFilters[keyof TFilters],
  defaultValue: TFilters[keyof TFilters],
) => {
  if (value === defaultValue) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim() === ''
  }

  return value === null || value === undefined
}

export const useAdminListFilters = <TFilters extends FilterObject>({
  filters,
  defaults,
  isEmptyValue = defaultIsEmptyValue,
}: UseAdminListFiltersOptions<TFilters>) => {
  const entries = computed(() => {
    return Object.keys(defaults).map((key) => {
      const typedKey = key as keyof TFilters
      return {
        key: typedKey,
        value: filters[typedKey],
        defaultValue: defaults[typedKey],
      }
    })
  })

  const activeFilterCount = computed(() => {
    return entries.value.reduce((count, entry) => {
      return isEmptyValue(entry.key, entry.value, entry.defaultValue) ? count : count + 1
    }, 0)
  })

  const hasFilters = computed(() => activeFilterCount.value > 0)

  // 统一重置逻辑，避免每个页面都手写一份字段回填。
  const resetFilters = (keys?: Array<keyof TFilters>) => {
    const targetKeys = keys?.length ? keys : (Object.keys(defaults) as Array<keyof TFilters>)
    targetKeys.forEach((key) => {
      filters[key] = defaults[key]
    })
  }

  return {
    activeFilterCount,
    hasFilters,
    resetFilters,
  }
}

export const matchesAdminKeyword = (keyword: string, values: Array<string | number | null | undefined>) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return true
  }

  return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword))
}
