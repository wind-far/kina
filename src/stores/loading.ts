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
 *
 * 文案：start 可以携带文案，多次 start 后取最近一次非空文案；
 * stop 不影响文案，归零后会被清空。
 */

interface KeyState {
  count: number
  texts: string[]
}

const states = ref<Record<string, KeyState>>({})

const getState = (key: string): KeyState => states.value[key] || { count: 0, texts: [] }

// 单个 key 当前是否处于加载中
const isLoading = (key: string) => getState(key).count > 0

// 任意 key 处于加载中
const isAnyLoading = computed(() =>
  Object.values(states.value).some(state => state.count > 0),
)

// 读取某个 key 当前文案（取最新一条非空文案）
const getText = (key: string) => {
  const texts = getState(key).texts
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    if (texts[i]) return texts[i]
  }
  return ''
}

// 启动一次加载，引用计数 +1
const start = (key = 'default', text = '') => {
  const prev = getState(key)
  states.value = {
    ...states.value,
    [key]: {
      count: prev.count + 1,
      texts: [...prev.texts, text],
    },
  }
}

// 结束一次加载，引用计数 -1（不会小于 0）
const stop = (key = 'default') => {
  const prev = getState(key)
  if (prev.count <= 0) return
  const nextCount = prev.count - 1
  const nextTexts = prev.texts.slice(0, -1)
  states.value = {
    ...states.value,
    [key]: {
      count: nextCount,
      texts: nextCount > 0 ? nextTexts : [],
    },
  }
}

// 强制重置某个 key（用于异常恢复，慎用）
const reset = (key: string) => {
  if (!(key in states.value)) return
  const { [key]: _omit, ...rest } = states.value
  states.value = rest
}

export const useLoadingStore = () => ({
  isLoading,
  isAnyLoading,
  getText,
  start,
  stop,
  reset,
})
