import { createVNode, getCurrentInstance, inject, render } from 'vue'
import ToastMain from './toast-main.vue'

import type { App, Plugin, VNode } from 'vue'

/**
 * @description 一个自定义 toast Vue 插件
 */
export const toastPlugin: Plugin = {
  install(app: App) {
    // 创建容器 (document.body)
    const container = document.body

    /**
     *
     * @param options { message, type?, duration? }
     * @description 挂载 toast (防抖 debounce)
     */
    const mountToast = (options: {
      message: string
      type: 'success' | 'error' | 'warning' | 'default'
      duration: number
    }) => {
      //! duration >= 500 && duration <= 2500, default 1500
      const duration = Math.min(
        2500,
        Math.max(500, options.duration ?? 1500 /** defaultDuration */),
      )

      // 清除旧 toast
      render(null, container)
      // 创建新 toast
      const vnode: VNode = createVNode(ToastMain, {
        message: options.message,
        type: options.type ?? 'default',
        duration,
      })

      // 渲染到容器 (document.body)
      render(vnode, container)
      vnode.component?.exposed?.mount()
    }

    // 注册全局方法
    app.config.globalProperties.$toast = {
      default: (message: string, duration?: number) =>
        mountToast({ message, type: 'default', duration: duration ?? 1500 }),
      success: (message: string, duration?: number) =>
        mountToast({ message, type: 'success', duration: duration ?? 1500 }),
      warning: (message: string, duration?: number) =>
        mountToast({ message, type: 'warning', duration: duration ?? 1500 }),
      error: (message: string, duration?: number) =>
        mountToast({ message, type: 'error', duration: duration ?? 1500 }),
    }
  },
}

// 类型扩展
declare module 'vue' {
  export interface ComponentCustomProperties {
    $toast: {
      default: (message: string, duration?: number) => void
      success: (message: string, duration?: number) => void
      warning: (message: string, duration?: number) => void
      error: (message: string, duration?: number) => void
    }
  }
}

export const useToast = (): IToast => {
  const appInstance = getCurrentInstance()
  const proxy = appInstance?.proxy
  return proxy?.$toast as IToast
}

//////////////////////////////////////////////////

export function createToast(): {
  default: (message: string, duration?: number) => void
  success: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
} {
  // 创建容器 (document.body)
  const container = document.body

  // 防抖 debounce (只触发最后一次)
  // let timer: number | null = null

  /**
   *
   * @param options { message, type?, duration? }
   * @description 挂载 toast (防抖 debounce)
   */
  const mountToast = (options: {
    message: string
    type: 'success' | 'error' | 'warning' | 'default'
    duration: number
  }) => {
    //! duration >= 500 && duration <= 2500, default 1500
    const duration = Math.min(2500, Math.max(500, options.duration ?? 1500 /** defaultDuration */))

    // 清除旧 toast
    render(null, container)
    // 创建新 toast
    const vnode: VNode = createVNode(ToastMain, {
      message: options.message,
      type: options.type ?? 'default',
      duration,
    })

    // 渲染到容器 (document.body)
    render(vnode, container)
    vnode.component?.exposed?.mount()
  }

  return {
    default: (message: string, duration?: number) =>
      mountToast({ message, type: 'default', duration: duration ?? 1500 }),
    success: (message: string, duration?: number) =>
      mountToast({ message, type: 'success', duration: duration ?? 1500 }),
    warning: (message: string, duration?: number) =>
      mountToast({ message, type: 'warning', duration: duration ?? 1500 }),
    error: (message: string, duration?: number) =>
      mountToast({ message, type: 'error', duration: duration ?? 1500 }),
  }
}

export const useToast2 = (): IToast => {
  //! main.ts
  //* const toast: IToast = createToast()
  //* app.provide<IToast>('toast', readonly(toast))
  return inject<IToast>('toast')!
}

export interface IToast {
  default: (message: string, duration?: number) => void
  success: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
}
