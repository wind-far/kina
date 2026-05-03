import type { Component, ComputedRef, VNode } from 'vue'

export interface FormItem {
  key: string
  label?: string | (() => VNode) | Component
  labelWidth?: string | number
  type?: string
  render?: (() => VNode) | Component
  hidden?: boolean | ComputedRef<boolean>
  span?: number
  options?: Record<string, any>
  props?: Record<string, any>
  slots?: Record<string, (() => any) | undefined>
  placeholder?: string
  rules?: any
}
