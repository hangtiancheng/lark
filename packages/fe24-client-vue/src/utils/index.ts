/* eslint-disable @typescript-eslint/no-explicit-any */

// 防抖 debounce
export const debounced = (fn: (...args: any) => void, delay: number): typeof fn => {
  let timer: number | null = null
  const debouncedFn: typeof fn = (...args) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }
  return debouncedFn
}

// 节流 throttle
export const throttled = (fn: (...args: any) => void, delay: number): typeof fn => {
  let timer: number | null = null
  const throttledFn: typeof fn = (...args) => {
    if (timer) {
      return
    }
    fn(...args)
    timer = setTimeout(() => {
      timer = null
    }, delay)
  }
  return throttledFn
}

export function getDate() {
  const pad0 = (num: number) => num.toString().padStart(2, '0')
  const time = new Date()
  return `${time.getFullYear()}-${pad0(time.getMonth() + 1)}-${pad0(time.getDay())}`
}

export function getTime() {
  const pad0 = (num: number) => num.toString().padStart(2, '0')
  const time = new Date()
  return `${pad0(time.getHours())}:${pad0(time.getMinutes())}:${pad0(time.getSeconds())}`
}
