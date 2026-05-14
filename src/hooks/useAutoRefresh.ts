// src/hooks/useAutoRefresh.ts
import { useEffect, useRef } from 'react'

export function useAutoRefresh(
  interval: number,
  callback: () => void | Promise<void>,
  enabled: boolean = true
) {
  const callbackRef = useRef(callback)

  // 更新callback引用
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || interval <= 0) {
      return
    }

    const timer = setInterval(() => {
      callbackRef.current()
    }, interval * 1000)

    return () => clearInterval(timer)
  }, [interval, enabled])
}
