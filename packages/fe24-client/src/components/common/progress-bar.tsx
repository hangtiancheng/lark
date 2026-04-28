import React, { useState, useImperativeHandle, forwardRef } from 'react'

export interface ProgressBarRef {
  loadStart: () => void
  loadEnd: () => void
}

const ProgressBar = forwardRef<ProgressBarRef>((_, ref) => {
  const [progress, setProgress] = useState(0)
  const requestIdRef = React.useRef<number>(0)

  const loadStart = () => {
    const fn = () => {
      setProgress((prev) => {
        if (prev < 100) {
          requestIdRef.current = window.requestAnimationFrame(fn)
          return prev + 1
        } else {
          window.cancelAnimationFrame(requestIdRef.current)
          return 0
        }
      })
    }
    requestIdRef.current = window.requestAnimationFrame(fn)
  }

  const loadEnd = () => {
    setTimeout(() => {
      requestIdRef.current = window.requestAnimationFrame(() => {
        setProgress(0)
      })
    }, 3000)
  }

  useImperativeHandle(ref, () => ({
    loadStart,
    loadEnd,
  }))

  return (
    <main className="fixed top-0 z-50 h-1.25 w-dvw">
      <div className="h-1.25 bg-(--color-green)" style={{ width: `${progress}%` }}></div>
    </main>
  )
})

ProgressBar.displayName = 'ProgressBar'

export default ProgressBar
