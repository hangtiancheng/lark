import { createContext, useContext } from 'react'

export interface IToast {
  default: (message: string, duration?: number) => void
  success: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
}

export const ToastContext = createContext<IToast | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
