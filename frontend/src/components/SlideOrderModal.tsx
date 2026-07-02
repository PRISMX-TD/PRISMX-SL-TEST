// 滑动确认下单弹窗 / Slide-to-confirm order modal
import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type TouchEvent as RTouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { MT5Account, Quote, Signal } from '../api/types'

interface Props {
  signal: Signal
  accounts: MT5Account[]
  quote?: Quote
  onCancel: () => void
  onConfirm: (
    volume: number,
    mt5Login: string | null,
    stopLoss: number | null,
    takeProfit: number | null,
  ) => Promise<void>
}

const QUICK_LOTS = [0.01, 0.10, 0.50, 1.00]

export default function SlideOrderModal({ signal, accounts, quote, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<'waiting' | 'ok' | 'error' | null>(null)
  const [error, setError] = useState('')
  const [slidePct, setSlidePct] = useState(0)

  const onlineAccounts = accounts.filter((a) => a.online)
  const [login, setLogin] = useState<string>(() => onlineAccounts[0]?.login ?? '')
  const selected = onlineAccounts.find((a) => a.login === login) || null

  const suggestVolume = (eq?: number | null): string => {
    if (!eq || eq <= 0) return '0.10'
    const v = Math.max(0.01, Math.min(eq / 200, 1))
    return (Math.floor(v * 100) / 100).toFixed(2)
  }
  const [volume, setVolume] = useState(() => suggestVolume(onlineAccounts[0]?.equity))
  const [sl, setSl] = useState(signal.stopLoss != null ? String(signal.stopLoss) : '')
  const [tp, setTp] = useState(signal.takeProfit != null ? String(signal.takeProfit) : '')

  const trackRef = useRef<HTMLDivElement>(null)
  const sliding = useRef(false)

  useEffect(() => {
    if (!login && onlineAccounts[0]) setLogin(onlineAccounts[0].login)
  }, [onlineAccounts, login])

  useEffect(() => {
    setVolume(suggestVolume(selected?.equity))
  }, [selected?.login])

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting])

  // PWA back gesture
  useEffect(() => {
    window.history.pushState({ __modal: true }, '', window.location.href)
    const onPop = () => {
      window.history.pushState({ __modal: true }, '', window.location.href)
      if (!submitting) onCancel()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.history.back()
    }
  }, [onCancel, submitting])

  const getPct = (clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    return Math.max(0, Math.min(100, pct))
  }

  const onStart = (clientX: number) => {
    if (submitting) return
    sliding.current = true
    setSlidePct(getPct(clientX))
  }
  const onMove = (clientX: number) => {
    if (!sliding.current || submitting) return
    const pct = getPct(clientX)
    setSlidePct(pct)
    if (pct >= 100) {
      sliding.current = false
      handleSubmit()
    }
  }
  const onEnd = () => {
    if (!sliding.current || submitting) return
    sliding.current = false
    if (slidePct < 95) setSlidePct(0)
  }

  const handleSubmit = async () => {
    setReceipt('waiting')
    setSubmitting(true)
    setError('')
    const vol = parseFloat(volume)
    if (!vol || vol <= 0) {
      setError(t('order.volume'))
      setSlidePct(0)
      setSubmitting(false)
      setReceipt(null)
      return
    }
    const slNum = sl.trim() === '' ? null : parseFloat(sl)
    const tpNum = tp.trim() === '' ? null : parseFloat(tp)
    try {
      await onConfirm(vol, login || null, slNum, tpNum)
      setReceipt('ok')
      setTimeout(() => onCancel(), 2000)
    } catch (err) {
      setReceipt('error')
      setError(err instanceof Error ? err.message : 'error')
      setTimeout(() => {
        setReceipt(null)
        setSlidePct(0)
        setSubmitting(false)
      }, 2000)
    }
  }

  const stepLot = (dir: number) => {
    const v = parseFloat(volume) || 0.01
    const next = Math.max(0.01, Math.min(10, +(v + dir * 0.01).toFixed(2)))
    setVolume(String(next))
  }

  const isBuy = signal.side === 'BUY'
  const symLetter = (signal.symbol[0] ?? '?').toUpperCase()
  const avaBg = isBuy ? 'rgba(46,224,126,0.15)' : 'rgba(255,77,103,0.15)'
  const avaColor = isBuy ? 'var(--up)' : 'var(--down)'

  const hasAccounts = onlineAccounts.length > 0
  const offlineMsg = accounts.length === 0 ? t('order.noBridge') : t('order.allOffline')

  return (
    <div className="slide-overlay" onClick={onCancel}>
      <div className="slide-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="slide-cancel-x" onClick={onCancel}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <div className="slide-sheet-head">
          <div className="slide-sheet-ava" style={{ background: avaBg, color: avaColor }}>{symLetter}</div>
          <h3 className="text-lg mt-2.5 text-white font-bold">
            {isBuy ? t('common.buy') : t('common.sell')} {signal.symbol}
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            现价 <span className="num" style={{ color: 'var(--up)' }}>
              {quote ? (isBuy ? (quote.ask?.toFixed(quote.digits ?? 5) ?? signal.entry) : (quote.bid?.toFixed(quote.digits ?? 5) ?? signal.entry)) : signal.entry ?? '-'}
            </span>
            {selected && <> · 账户 {selected.login}</>}
          </p>
        </div>

        <div className="slide-sheet-rows">
          <div className="slide-row">
            <span className="k">{t('order.volume')}</span>
            <span className="stepper">
              <button onClick={() => stepLot(-1)}>−</button>
              <span className="lot-val num">{parseFloat(volume).toFixed(2)}</span>
              <button onClick={() => stepLot(1)}>+</button>
            </span>
          </div>
          <div className="slide-row">
            <span className="k">{t('signals.colSl')} / {t('signals.colTp')}</span>
            <span className="v num">
              <span style={{ color: 'var(--down)' }}>{sl || '-'}</span>
              <i> / </i>
              <span style={{ color: 'var(--up)' }}>{tp || '-'}</span>
            </span>
          </div>
          {/* Quick lots */}
          <div className="slide-row">
            <span className="k">{t('order.volume')}</span>
            <div className="flex gap-1.5">
              {QUICK_LOTS.map((q) => (
                <button key={q} onClick={() => setVolume(q.toFixed(2))} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-slate-300 hover:border-prism-500/50 hover:text-prism-300 font-mono">
                  {q.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="slide-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>{t('order.riskNote')}</span>
        </div>

        {!hasAccounts && (
          <div className="mb-3 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{offlineMsg}</div>
        )}
        {error && (
          <div className="mb-3 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">{error}</div>
        )}

        {/* Receipt card */}
        {receipt && (
          <div className="receipt-card">
            <div className={`receipt-line ${receipt === 'ok' ? 'ok' : 'wait'}`}>
              {receipt === 'waiting' && <><span className="spinner" />{t('order.submitting')}...</>}
              {receipt === 'ok' && <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>{t('order.filled', { price: '' })}</>}
              {receipt === 'error' && <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>{error || t('order.rejected', { msg: '' })}</>}
            </div>
          </div>
        )}

        {/* Slide track */}
        {!submitting && hasAccounts && (
          <div
            ref={trackRef}
            className={`slide-track ${slidePct >= 95 ? 'done' : ''}`}
            onMouseMove={(e: RMouseEvent) => onMove(e.clientX)}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchMove={(e: RTouchEvent) => onMove(e.touches[0].clientX)}
            onTouchEnd={onEnd}
          >
            <div className="slide-track-fill" style={{ width: `${slidePct}%` }} />
            <div className="slide-track-label">{t('order.slideToConfirm', '滑动确认下单')}</div>
            <div
              className="slide-knob"
              onMouseDown={(e: RMouseEvent) => { e.preventDefault(); onStart(e.clientX) }}
              onTouchStart={(e: RTouchEvent) => onStart(e.touches[0].clientX)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        )}

        {/* Slide done state: close button */}
        {receipt && (
          <button onClick={onCancel} className="btn btn-ghost slide-close-btn">
            {t('common.close')}
          </button>
        )}
      </div>
    </div>
  )
}
