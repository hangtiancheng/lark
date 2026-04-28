import React, { useState, useRef, ReactNode } from 'react'
import ToastMain, { ToastMainRef } from './toast-main'
import { ToastContext, IToast } from './toast-context'

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toastOptions, setToastOptions] = useState<{
    message: string
    type: 'success' | 'error' | 'warning' | 'default'
    duration: number
    key: number
  } | null>(null)

  const toastRef = useRef<ToastMainRef>(null)

  const mountToast = (options: {
    message: string
    type: 'success' | 'error' | 'warning' | 'default'
    duration: number
  }) => {
    //! duration >= 500 && duration <= 2500, default 1500
    const duration = Math.min(2500, Math.max(500, options.duration ?? 1500))

    // Update options and generate a new key to force re-render/re-mount if needed
    setToastOptions({
      ...options,
      duration,
      key: Date.now(),
    })

    // Wait for state update to trigger render, then call mount
    // Request animation frame ensures DOM is updated before we call mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toastRef.current?.mount()
      })
    })
  }

  const toastMethods: IToast = {
    default: (message: string, duration?: number) =>
      mountToast({ message, type: 'default', duration: duration ?? 1500 }),
    success: (message: string, duration?: number) =>
      mountToast({ message, type: 'success', duration: duration ?? 1500 }),
    warning: (message: string, duration?: number) =>
      mountToast({ message, type: 'warning', duration: duration ?? 1500 }),
    error: (message: string, duration?: number) =>
      mountToast({ message, type: 'error', duration: duration ?? 1500 }),
  }

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      {toastOptions && (
        <ToastMain
          key={toastOptions.key}
          ref={toastRef}
          message={toastOptions.message}
          type={toastOptions.type}
          duration={toastOptions.duration}
        />
      )}
    </ToastContext.Provider>
  )
}
