import { ElMessageBox } from 'element-plus'

export interface AdminConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export const useAdminConfirm = () => {
  const confirm = async (options: AdminConfirmOptions) => {
    await ElMessageBox.confirm(options.message, options.title, {
      type: options.danger ? 'warning' : 'info',
      confirmButtonText: options.confirmText || '确认',
      cancelButtonText: options.cancelText || '取消',
      confirmButtonClass: options.danger ? 'el-button--danger' : '',
    })
  }

  const confirmDanger = async (options: Omit<AdminConfirmOptions, 'danger'>) => {
    await confirm({
      ...options,
      danger: true,
    })
  }

  return {
    confirm,
    confirmDanger,
  }
}
