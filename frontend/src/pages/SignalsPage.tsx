// 信号面板页 / Signals dashboard page
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLive } from '../store/live'
import { orderApi } from '../api/client'
import { clientOrderId, calcRiskReward, calcCountdown } from '../api/utils'
import type { Signal } from '../api/types'
import OrderModal from '../components/OrderModal'

// 信号总有效时长，与后端 expire_at = created_at + 10min 一致 / lifespan matches backend
const SIGNAL_LIFESPAN_MS = 10 * 60 * 1000
// 剩余低于此值视为"即将到期" / below this is considered "expiring soon"
const EXPIRING_THRESHOLD_MS = 2 * 60 * 1000
// 新信号高亮持续时间 / how long a new signal stays highlighted
const NEW_HIGHLIGHT_MS = 6000

// focus 视图默认关注品种（与后端引擎产出对齐，XAGUSD 暂无信号则恒显观望）。
// Default watchlist (aligned with the engine's symbols; XAGUSD stays in "watch"
// until it ever emits a signal).
const DEFAULT_WATCHLIST = ['XAUUSD', 'EURUSD', 'GBPUSD', 'XAGUSD', 'BTCUSD']

// 品种在 focus 视图下的状态：观望 / 做多 / 做空 / per-symbol state in the focus view
type FocusState = 'WATCH' | 'LONG' | 'SHORT'

// 每秒滴答的当前时间，用于实时倒计时 / a per-second ticking clock for live countdowns
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

// 跟踪新到达的信号 id，用于短暂高亮 / track freshly arrived signal ids for a brief highlight
function useNewSignalIds(signals: Signal[]): Set<string> {
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  const seen = useRef<Set<string>>(new Set())
  const firstRun = useRef(true)

  useEffect(() => {
    // 首次加载不高亮已有信号 / don't highlight pre-existing signals on first load
    if (firstRun.current) {
      firstRun.current = false
      seen.current = new Set(signals.map((s) => s.id))
      return
    }
    const fresh = signals.filter((s) => !seen.current.has(s.id)).map((s) => s.id)
    if (fresh.length === 0) return
    fresh.forEach((id) => seen.current.add(id))
    setNewIds((prev) => {
      const next = new Set(prev)
      fresh.forEach((id) => next.add(id))
      return next
    })
    const timer = window.setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev)
        fresh.forEach((id) => next.delete(id))
        return next
      })
    }, NEW_HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [signals])

  return newIds
}

// 信号的有效状态（结合实时倒计时）/ effective status combining live countdown
type EffStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED'
function effectiveStatus(signal: Signal, now: number): EffStatus {
  if (signal.status === 'EXPIRED') return 'EXPIRED'
  const cd = calcCountdown(signal.expireAt, SIGNAL_LIFESPAN_MS, now)
  if (cd?.expired) return 'EXPIRED'
  if (cd && cd.remainMs <= EXPIRING_THRESHOLD_MS) return 'EXPIRING'
  return 'ACTIVE'
}

// 风险回报比颜色 / risk-reward color
function rrTone(rr: number | null): string {
  if (rr == null) return 'text-slate-400'
  if (rr >= 2) return 'text-up'
  if (rr >= 1) return 'text-prism-300'
  return 'text-down'
}

// 单个关注品种在 focus 视图中的派生数据 / derived per-symbol data for the focus view
interface FocusEntry {
  symbol: string
  state: FocusState
  signal: Signal | null
}

// focus 状态的视觉映射 / visual mapping for each focus state
const FOCUS_TONE: Record<FocusState, { color: string; chipBg: string; glow: string }> = {
  WATCH: { color: 'text-slate-400', chipBg: 'bg-white/5 text-slate-400', glow: 'rgba(148,163,184,.18)' },
  LONG: { color: 'text-up', chipBg: 'bg-up/15 text-up', glow: 'rgba(47,230,160,.28)' },
  SHORT: { color: 'text-down', chipBg: 'bg-down/15 text-down', glow: 'rgba(255,77,109,.28)' },
}
const FOCUS_DOT: Record<FocusState, string> = { WATCH: '#94a3b8', LONG: '#2fe6a0', SHORT: '#ff4d6d' }

// 由实时信号派生每个关注品种的当前状态。
// 关注列表 = 默认清单 ∪ 任何当前有 ACTIVE 信号的品种（不漏掉引擎新出的品种）。
function useFocusEntries(signals: Signal[], now: number): FocusEntry[] {
  return useMemo(() => {
    const repBySymbol = new Map<string, Signal>()
    for (const s of signals) {
      if (effectiveStatus(s, now) === 'EXPIRED') continue
      const cur = repBySymbol.get(s.symbol)
      if (!cur || new Date(s.createdAt).getTime() > new Date(cur.createdAt).getTime()) {
        repBySymbol.set(s.symbol, s)
      }
    }
    const symbols = [...DEFAULT_WATCHLIST]
    for (const sym of repBySymbol.keys()) if (!symbols.includes(sym)) symbols.push(sym)
    return symbols.map((symbol) => {
      const signal = repBySymbol.get(symbol) ?? null
      const state: FocusState = !signal ? 'WATCH' : signal.side === 'BUY' ? 'LONG' : 'SHORT'
      return { symbol, state, signal }
    })
  }, [signals, now])
}

// focus 视图：单品种聚焦英雄卡 + 全市场情绪 + 其他活跃信号。
function FocusView({
  entries,
  now,
  newIds,
  onTrade,
}: {
  entries: FocusEntry[]
  now: number
  newIds: Set<string>
  onTrade: (s: Signal) => void
}) {
  const { t } = useTranslation()
  const [focusIdx, setFocusIdx] = useState(0)

  const idx = Math.min(focusIdx, Math.max(0, entries.length - 1))
  const cur = entries[idx]

  const sentiment = useMemo(() => {
    let long = 0,
      short = 0,
      watch = 0
    for (const e of entries) {
      if (e.state === 'LONG') long += 1
      else if (e.state === 'SHORT') short += 1
      else watch += 1
    }
    return { long, short, watch, total: entries.length }
  }, [entries])

  if (!cur) return null

  const stateLabel = (s: FocusState) =>
    s === 'LONG' ? t('signals.focus.long') : s === 'SHORT' ? t('signals.focus.short') : t('signals.focus.watch')
  const nameOf = (sym: string) => t(`signals.symbolNames.${sym}`, { defaultValue: '' })

  const tone = FOCUS_TONE[cur.state]
  const hasSignal = cur.state !== 'WATCH' && cur.signal != null
  const rr = cur.signal ? calcRiskReward(cur.signal.symbol, cur.signal.entry, cur.signal.stopLoss, cur.signal.takeProfit) : null
  const total = Math.max(1, sentiment.total)
  const longW = Math.round((sentiment.long / total) * 100)
  const shortW = Math.round((sentiment.short / total) * 100)

  const others = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => i !== idx && e.state !== 'WATCH' && e.signal)

  return (
    <div className="mx-auto max-w-2xl">
      {/* 品种滑动导航 + 状态圆点 / symbol nav + colored state dots */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setFocusIdx((idx - 1 + entries.length) % entries.length)}
          className="glass grid h-9 w-9 place-items-center text-prism-200"
          aria-label="prev"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-bold text-slate-100">{cur.symbol}</span>
          {nameOf(cur.symbol) && <span className="text-xs text-slate-500">{nameOf(cur.symbol)}</span>}
        </div>
        <button
          type="button"
          onClick={() => setFocusIdx((idx + 1) % entries.length)}
          className="glass grid h-9 w-9 place-items-center text-prism-200"
          aria-label="next"
        >
          ›
        </button>
      </div>
      <div className="mb-4 flex justify-center gap-1.5">
        {entries.map((e, i) => (
          <button
            key={e.symbol}
            type="button"
            onClick={() => setFocusIdx(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === idx ? '20px' : '8px',
              background: i === idx ? FOCUS_DOT[e.state] : FOCUS_DOT[e.state] + '66',
            }}
            aria-label={e.symbol}
          />
        ))}
      </div>

      {/* 英雄卡 / hero card */}
      <div
        className="glass animate-fade-in-up overflow-hidden p-4"
        style={{ boxShadow: `0 8px 32px rgba(0,0,0,.45), 0 0 30px ${tone.glow}, inset 0 1px 0 rgba(255,255,255,.08)` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 2" strokeLinecap="round" />
            </svg>
            {t('signals.focus.heading')} · {cur.symbol}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">{t('signals.focus.rrLabel')}</div>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <div className={`font-display text-5xl font-extrabold leading-none ${tone.color}`}>{stateLabel(cur.state)}</div>
          <div className={`font-display text-4xl font-bold leading-none ${hasSignal ? tone.color : 'text-slate-600'}`}>
            {hasSignal && rr?.rr != null ? `1:${rr.rr.toFixed(2)}` : '—'}
          </div>
        </div>

        {/* 全市场情绪条 / market sentiment bar */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-up">{t('signals.focus.long')} {sentiment.long}</span>
            <span className="uppercase tracking-wider text-slate-500">{t('signals.focus.marketSentiment')}</span>
            <span className="text-down">{t('signals.focus.short')} {sentiment.short}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            <div style={{ width: `${longW}%`, background: 'linear-gradient(90deg,#1f9e6e,#2fe6a0)' }} />
            <div className="flex-1" />
            <div style={{ width: `${shortW}%`, background: 'linear-gradient(90deg,#ff4d6d,#b3263f)' }} />
          </div>
          <div className="mt-1 text-center text-[10px] text-slate-500">
            {t('signals.focus.watching')} {sentiment.watch} · {t('signals.focus.symbolsTotal', { n: sentiment.total })}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300">
          {hasSignal ? cur.signal!.indicator || t('signals.focus.waiting') : t('signals.focus.waiting')}
        </div>

        {hasSignal ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('signals.focus.remainingTtl')}</div>
              <div className="font-mono text-sm text-amber-400">
                {calcCountdown(cur.signal!.expireAt, SIGNAL_LIFESPAN_MS, now)?.text ?? '-'}
              </div>
            </div>
            <button onClick={() => onTrade(cur.signal!)} className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold">
              {t('signals.focus.viewDetail')}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 py-2.5 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-breathe" />
            {t('signals.focus.noExecutable')}
          </div>
        )}
      </div>

      {/* 其他活跃信号 / other active signals */}
      {others.length > 0 && (
        <>
          <div className="mb-2 mt-5 flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
              {t('signals.focus.otherActive')}
            </h3>
            <span className="chip">{others.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {others.map(({ e, i }) => {
              const oTone = FOCUS_TONE[e.state]
              const oRr = calcRiskReward(e.signal!.symbol, e.signal!.entry, e.signal!.stopLoss, e.signal!.takeProfit)
              const isNew = newIds.has(e.signal!.id)
              return (
                <button
                  key={e.symbol}
                  type="button"
                  onClick={() => setFocusIdx(i)}
                  className={`glass flex w-full items-center gap-3 px-3 py-2.5 text-left ${isNew ? 'ring-2 ring-prism-500/70 animate-glow-pulse' : ''}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: FOCUS_DOT[e.state] + '1f' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: FOCUS_DOT[e.state] }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{e.symbol}</span>
                      <span className={`tag ${oTone.chipBg}`}>{stateLabel(e.state)}</span>
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{e.signal!.indicator || '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono text-sm font-bold ${rrTone(oRr?.rr ?? null)}`}>
                      {oRr?.rr != null ? `1:${oRr.rr.toFixed(2)}` : '-'}
                    </div>
                    <div className="font-mono text-[10px] text-amber-400">
                      {calcCountdown(e.signal!.expireAt, SIGNAL_LIFESPAN_MS, now)?.text ?? '-'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function SignalsPage() {
  const { t } = useTranslation()
  const { signals, anyOnline, accounts, loaded, refreshAll } = useLive()
  const now = useNow(1000)
  const newIds = useNewSignalIds(signals)
  const focusEntries = useFocusEntries(signals, now)

  const [active, setActive] = useState<Signal | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' | 'info' } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (msg: string, kind: 'success' | 'error' | 'info' = 'success', ms = 3000) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ msg, kind })
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }

  const handleConfirm = async (
    volume: number,
    mt5Login: string | null,
    stopLoss: number | null,
    takeProfit: number | null,
  ) => {
    if (!active) return
    const placed = await orderApi.place({
      signalId: active.id,
      symbol: active.symbol,
      side: active.side,
      volume,
      clientOrderId: clientOrderId(),
      mt5Login,
      stopLoss,
      takeProfit,
    })
    setActive(null)
    refreshAll()

    if (placed.status === 'FILLED') {
      showToast(t('order.filled', { price: placed.filledPrice ?? '-' }), 'success')
      return
    }
    if (placed.status === 'REJECTED' || placed.status === 'FAILED') {
      showToast(t('order.rejected', { msg: placed.message || '-' }), 'error')
      return
    }
    showToast(t('order.submitted'), 'info', 8000)
    await waitForReceipt(placed.id)
  }

  // 轮询订单直到终态或超时 / poll the order until terminal status or timeout
  const waitForReceipt = async (orderId: string) => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const { orders } = await orderApi.list()
        const o = orders.find((x) => x.id === orderId)
        if (!o) continue
        if (o.status === 'FILLED') {
          showToast(t('order.filled', { price: o.filledPrice ?? '-' }), 'success')
          refreshAll()
          return
        }
        if (o.status === 'REJECTED' || o.status === 'FAILED') {
          showToast(t('order.rejected', { msg: o.message || '-' }), 'error')
          refreshAll()
          return
        }
      } catch {
        // 忽略单次失败，继续轮询 / ignore a single failure and keep polling
      }
    }
    showToast(t('order.ackTimeout'), 'info')
  }

  const toastStyle =
    toast?.kind === 'error'
      ? 'border-down/40 bg-down/15 text-down'
      : toast?.kind === 'info'
        ? 'border-prism-600/40 bg-prism-600/15 text-prism-300'
        : 'border-up/40 bg-up/15 text-up'

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold text-slate-100">
          <span className="neon-text">{t('signals.title')}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t('signals.subtitle')}</p>
      </div>

      {!loaded ? (
        <div className="glass flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-2 border-prism-600/30 border-t-prism-500" />
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        </div>
      ) : (
        <FocusView entries={focusEntries} now={now} newIds={newIds} onTrade={setActive} />
      )}

      {active && (
        <OrderModal
          signal={active}
          eaOnline={anyOnline}
          accounts={accounts}
          onCancel={() => setActive(null)}
          onConfirm={handleConfirm}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-xl border px-5 py-3 text-sm shadow-prism sm:bottom-6 ${toastStyle}`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
