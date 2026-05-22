import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useLoadingStore } from '@/stores/loading'

interface UseAsyncActionOptions {
  /**
   * 全局 loading key。设置后会同时驱动 loadingStore（用于全屏遮罩等）。
   * 不设置则仅维护局部 loading ref。
   */
  globalKey?: string
  /**
   * 出错时显示的固定文案。不设置则尝试读取 error.message。
   * 设为 false 完全静默（业务自行处理错误）。
   */
  errorMessage?: string | false
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
    errorMessage,
    ignoreReentry = true,
    rethrow = false,
  } = options

  const run = async (...args: Args): Promise<Result | undefined> => {
    if (ignoreReentry && loading.value) {
      return undefined
    }
    loading.value = true
    if (globalKey) store.start(globalKey)

    try {
      return await fn(...args)
    } catch (error) {
      if (errorMessage !== false) {
        const message = typeof errorMessage === 'string' && errorMessage
          ? errorMessage
          : (error instanceof Error && error.message) || '操作失败，请重试'
        ElMessage.error(message)
      }
      // eslint-disable-next-line no-console
      console.error('[useAsyncAction]', error)
      if (rethrow) throw error
      return undefined
    } finally {
      loading.value = false
      if (globalKey) store.stop(globalKey)
    }
  }

  return { run, loading }
}
