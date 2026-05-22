import { ref } from 'vue'
import { ElMessage } from 'element-plus'
// 显式引入 message 样式入口（含 base + badge + message 三层）：
// .ts 文件里 AutoImport 不会自动注入侧效 CSS，需要走 components/message/style/css 才能拿到完整样式
import 'element-plus/es/components/message/style/css'
import { useLoadingStore } from '@/stores/loading'

interface UseAsyncActionOptions {
  /**
   * 全局 loading key。设置后会同时驱动 loadingStore（用于全屏遮罩等）。
   * 不设置则仅维护局部 loading ref。
   */
  globalKey?: string
  /**
   * 与 globalKey 配合使用：全屏遮罩展示的文案。
   */
  globalText?: string
  /**
   * 错误提示策略：
   *   - undefined（默认）：不主动 toast；本项目接口层 `readApiData` 在响应失败时已经
   *     自动调用 ElMessage.error，再次 toast 会双弹。
   *   - 传入字符串：用该字符串覆盖默认提示（即便 API 层已 toast，也会再加一条业务文案）。
   *   - 传入 false：完全静默（同 undefined 但语义更明确）。
   *   - 传入 true：使用 `error.message` 强制 toast 一次（用于不走 readApiData 的场景，
   *     例如纯前端校验抛错或第三方库错误）。
   */
  errorMessage?: string | boolean
  /**
   * 是否在 loading 期间忽略后续调用，防止重复点击。默认 true。
   */
  ignoreReentry?: boolean
  /**
   * 是否将原始错误向外抛出（默认 false，已 toast 并 console.error）。
   * 若需要在调用方根据错误分支处理，设为 true。
   */
  rethrow?: boolean
}

/**
 * 异步动作封装
 *
 * 用例：
 *   const { run: handleSave, loading: saving } = useAsyncAction(
 *     async (payload) => saveWorkflow(payload),
 *     { globalKey: 'save-workflow', errorMessage: '保存失败，请重试' },
 *   )
 *   <WfButton :loading="saving" @click="handleSave(payload)">保存</WfButton>
 *
 * 内置能力：
 *   - 自动 try/finally 切换 loading
 *   - 防重复点击（loading 期间忽略调用）
 *   - 错误自动 toast + console.error
 *   - 可选 globalKey 联动全局 loading store
 */
export const useAsyncAction = <Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: UseAsyncActionOptions = {},
) => {
  const loading = ref(false)
  const store = useLoadingStore()
  const {
    globalKey,
    globalText,
    errorMessage,
    ignoreReentry = true,
    rethrow = false,
  } = options

  const run = async (...args: Args): Promise<Result | undefined> => {
    if (ignoreReentry && loading.value) {
      return undefined
    }
    loading.value = true
    if (globalKey) store.start(globalKey, globalText)

    // 包装 cleanup，避免 finally 与 catch 里重复 stop 引发引用计数漂移
    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      loading.value = false
      if (globalKey) store.stop(globalKey)
    }

    try {
      return await fn(...args)
    } catch (error) {
      // 关键：先清理 loading/overlay，再弹 toast，否则 ElMessage 会被全屏遮罩盖住
      cleanup()

      // 仅在显式声明 errorMessage 时才弹 toast，避免与 readApiData 的自动 toast 双弹
      const shouldToast =
        typeof errorMessage === 'string'
        || errorMessage === true
      if (shouldToast) {
        const rawMessage = (error as { message?: unknown } | null)?.message
        const message = typeof errorMessage === 'string' && errorMessage
          ? errorMessage
          : (typeof rawMessage === 'string' && rawMessage) || '操作失败，请重试'
        ElMessage.error(message)
      }
      // eslint-disable-next-line no-console
      console.error('[useAsyncAction]', error)
      if (rethrow) throw error
      return undefined
    } finally {
      cleanup()
    }
  }

  return { run, loading }
}
