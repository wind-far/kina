import { computed, ref } from 'vue'

/**
 * 通用加载状态存储
 *
 * 采用引用计数（refcount）模型：同一个 key 可被多处并发 start，
 * 只有全部 stop 之后才会归零。避免并发请求互相覆盖 loading 状态。
 *
 * 典型 key：
 *   - 'route'    路由切换
 *   - 'blocking' 全屏阻塞遮罩
 *   - 自定义     某次保存、某个表单等
 */

// 模块级单例：所有 key 当前正在运行的并发数
const counts = ref<Record<string, number>>({})

// 单个 key 当前是否处于加载中
const isLoading = (key: string) => (counts.value[key] || 0) > 0

// 任意 key 处于加载中
const isAnyLoading = computed(() =>
  Object.values(counts.value).some(value => value > 0),
)

// 启动一次加载，引用计数 +1
const start = (key = 'default') => {
  const current = counts.value[key] || 0
  counts.value = { ...counts.value, [key]: current + 1 }
}

// 结束一次加载，引用计数 -1（不会小于 0）
const stop = (key = 'default') => {
  const current = counts.value[key] || 0
  const next = current - 1
  counts.value = { ...counts.value, [key]: next > 0 ? next : 0 }
}

// 强制重置某个 key（用于异常恢复，慎用）
const reset = (key: string) => {
  if (!(key in counts.value)) return
  const { [key]: _omit, ...rest } = counts.value
  counts.value = rest
}

export const useLoadingStore = () => ({
  isLoading,
  isAnyLoading,
  start,
  stop,
  reset,
})
