// PWA 回退守卫：拦截 Android 回退手势/按钮，改为应用内导航而非退出程序
// PWA back guard: intercept Android back gesture to navigate in-app instead of closing

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function PwaBackGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const guardRef = useRef(false)

  useEffect(() => {
    // 注入一条守卫 history，确保回退不会直接退出 PWA
    // Inject a guard history entry so back never exits the PWA entirely
    if (!guardRef.current) {
      guardRef.current = true
      window.history.pushState({ __pwaGuard: true }, '', window.location.href)
    }

    const handlePopState = () => {
      // 如果用户回退到了守卫条目，回推守卫并导航到应用首页
      // If user reaches the guard entry, push it back and navigate to app home
      if (window.history.state?.__pwaGuard) {
        window.history.pushState({ __pwaGuard: true }, '', window.location.href)
        navigate('/app', { replace: true })
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [navigate])

  return <>{children}</>
}
