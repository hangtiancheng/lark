import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react'
import { Attention, CheckOne, CloseOne, Caution } from '@icon-park/react'

export interface ToastMainProps {
  message: string
  type: 'success' | 'error' | 'warning' | 'default'
  duration: number //! duration >= 500 && duration <= 2500, default 1500
}

export interface ToastMainRef {
  mount: () => void
  isAlive: boolean
}

const ToastMain = forwardRef<ToastMainRef, ToastMainProps>((props, ref) => {
  const { message, type, duration } = props
  const [isAlive, setIsAlive] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const mount = () => {
    if (timerRef.current) {
      return
    }
    setIsAlive(true)
    timerRef.current = window.setTimeout(() => {
      setIsAlive(false)
      timerRef.current = null
    }, duration)
  }

  useImperativeHandle(ref, () => ({
    mount,
    get isAlive() {
      return isAlive
    },
  }))

  if (!isAlive) return null

  return (
    <div className="border-1st animate__animated animate__fadeIn animate__faster fixed top-[10%] left-[50%] z-100 -translate-x-[50%] rounded-lg border-[3px] p-1.25">
      <div className="flex items-center gap-1.25">
        {type === 'success' && <CheckOne theme="filled" size="24" fill="#7ed321" />}
        {type === 'error' && <CloseOne theme="filled" size="24" fill="#d0021b" />}
        {type === 'warning' && <Caution theme="filled" size="24" fill="#f5a623" />}
        {type === 'default' && <Attention theme="filled" size="24" fill="#4a90e2" />}
        <span>{message}</span>
      </div>
    </div>
  )
})

ToastMain.displayName = 'ToastMain'

export default ToastMain
