// Google 登录按钮 / Google Sign-In button
// 使用 Google Identity Services 渲染官方按钮，登录成功后回调 credential（ID Token）。
// Renders the official GIS button and calls back with the credential (ID token).
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// GSI 全局对象的最小类型声明 / minimal typing for the GSI global
interface GoogleCredentialResponse {
  credential: string
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: GoogleCredentialResponse) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

interface Props {
  onCredential: (credential: string) => void
  onError?: (msg: string) => void
}

export default function GoogleLoginButton({ onCredential, onError }: Props) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential

  useEffect(() => {
    if (!CLIENT_ID) return
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    // GSI 脚本可能尚未加载完成，轮询等待 / poll until the async GSI script is ready
    const timer = window.setInterval(() => {
      if (cancelled) return
      const gsi = window.google?.accounts?.id
      if (!gsi) return
      window.clearInterval(timer)
      gsi.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          if (resp.credential) onCredentialRef.current(resp.credential)
          else onError?.(t('auth.googleError'))
        },
      })
      gsi.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320,
      })
    }, 100)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [t, onError])

  // 未配置 Client ID 时不渲染（如本地未设环境变量）/ render nothing if not configured
  if (!CLIENT_ID) return null

  return <div ref={containerRef} className="flex justify-center" />
}
