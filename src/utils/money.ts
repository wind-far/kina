// 统一营销金额处理：接口层用字符串传递，展示和比较时再按需转换。
export const normalizeMoneyString = (value: unknown, fallback = '0') => {
  if (value === null || value === undefined) {
    return fallback
  }
  const normalized = String(value).trim()
  return normalized || fallback
}

// 统一转成 number，便于排序、比较和业务计算。
export const toMoneyNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(normalizeMoneyString(value, String(fallback)))
  return Number.isFinite(numeric) ? numeric : fallback
}

// 统一格式化为带货币符号的两位小数字符串。
export const formatMoney = (value: unknown, symbol = '¥') => {
  return `${symbol}${toMoneyNumber(value, 0).toFixed(2)}`
}

// 统一格式化价格主体，整数不带小数，便于营销大字价格展示。
export const formatMoneyDisplay = (value: unknown) => {
  const numeric = toMoneyNumber(value, 0)
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2)
}

// 统一判断原价是否高于售价，避免各处重复写 Number(...)。
export const isHigherOriginalPrice = (originalPrice: unknown, salesPrice: unknown) => {
  if (originalPrice === null || originalPrice === undefined || String(originalPrice).trim() === '') {
    return false
  }
  return toMoneyNumber(originalPrice, 0) > toMoneyNumber(salesPrice, 0)
}
