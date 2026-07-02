// 信号面板页：仪表盘 + 信号面板 双视图
// Signals page: Dashboard + Signal Panel dual views
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLive } from '../store/live'
import { orderApi } from '../api/client'
import { clientOrderId } from '../api/utils'
import type { Signal } from '../api/types'
import SignalHero from '../components/signals/SignalHero'
import SignalExec from '../components/signals/SignalExec'
import SignalOthers from '../components/signals/SignalOthers'
import QuotesTable from '../components/signals/QuotesTable'
import MarketOverview from '../components/signals/MarketOverview'
import SignalGrid from '../components/signals/SignalGrid'
import SlideOrderModal from '../components/SlideOrderModal'
import { useFocusEntries, useNewSignalIds, useNow } from '../components/signals/hooks'
import { trendStance, type TrendStance } from '../components/signals/signalView'
import type { FocusState } from '../components/signals/signalView'

export default function SignalsPage() {
  const { t } = useTranslation()
  const { signals, anyOnline, accounts, loaded, refreshAll, quotes, trends } = useLive()
  const now = useNow(1000)
  const newIds = useNewSignalIds(signals)
  const focusEntries = useFocusEntries(signals, now)

  // 当前视图：dashboard | signals
  const [view, setView] = useState<'dashboard' | 'signals'>('dashboard')
  // 聚焦品种索引
  const [focusIdx, setFocusIdx] = useState(0)
  // 下单弹窗
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null)
  // Toast
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

  const idx = Math.min(focusIdx, Math.max(0, focusEntries.length - 1))
  const cur = focusEntries[idx]
  const stance: TrendStance = cur ? trendStance(trends[cur.symbol]) : 'NEUTRAL'

  // 品种中文名 / Chinese name
  const nameOf = (sym: string) => t(`signals.symbolNames.${sym}`, { defaultValue: '' })

  // 全市场情绪 / market sentiment
  const sentiment = useMemo(() => {
    let long = 0, short = 0, watch = 0
    for (const e of focusEntries) {
      const st = trendStance(trends[e.symbol])
      if (st === 'BULL') long += 1
      else if (st === 'BEAR') short += 1
      else watch += 1
    }
    return { long, short, watch, total: focusEntries.length }
  }, [focusEntries, trends])

  // 其他活跃信号（排除当前聚焦品种）/ other active signals (exclude current focus)
  const otherEntries = useMemo(() => {
    return focusEntries
      .map((e, i) => ({ ...e, i }))
      .filter((e) => e.i !== idx && e.state !== 'WATCH' && e.signal != null)
      .map(({ symbol, state, signal, i }) => ({ symbol, state: state as FocusState, signal: signal!, idx: i }))
  }, [focusEntries, idx])

  const goPrev = () => setFocusIdx((i) => (i - 1 + focusEntries.length) % focusEntries.length)
  const goNext = () => setFocusIdx((i) => (i + 1) % focusEntries.length)

  const handleConfirm = async (
    volume: number,
    mt5Login: string | null,
    stopLoss: number | null,
    takeProfit: number | null,
  ) => {
    if (!activeSignal) return
    const placed = await orderApi.place({
      signalId: activeSignal.id,
      symbol: activeSignal.symbol,
      side: activeSignal.side,
      volume,
      clientOrderId: clientOrderId(),
      mt5Login,
      stopLoss,
      takeProfit,
    })
    setActiveSignal(null)
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
      } catch { /* continue polling */ }
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
    <div className="max-w-[1520px] mx-auto">
      {/* Loading state */}
      {!loaded ? (
        <div className="glass flat-card flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-2 border-prism-600/30 border-t-prism-500" />
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        </div>
      ) : (
        <>
          {/* ═══ 仪表盘视图 / Dashboard View ═══ */}
          {view === 'dashboard' && cur && (
            <div className="dash-grid">
              <SignalHero
                symbol={cur.symbol}
                cnName={nameOf(cur.symbol)}
                entriesCount={focusEntries.length}
                focusIdx={idx}
                focusTotal={focusEntries.length}
                stance={stance}
                trend={trends[cur.symbol]}
                sentiment={sentiment}
                onPrev={goPrev}
                onNext={goNext}
                onSelectIdx={setFocusIdx}
              />

              {/* Exec card: only show when current symbol has an active signal */}
              {cur.signal ? (
                <SignalExec
                  signal={cur.signal}
                  now={now}
                  onTrade={(s) => setActiveSignal(s)}
                />
              ) : (
                <section className="card glass dash-exec p-4 flex items-center justify-center text-sm text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-breathe mr-2" />
                  {t('signals.focus.noExecutable')}
                </section>
              )}

              <SignalOthers
                entries={otherEntries}
                newIds={newIds}
                now={now}
                onTrade={(s) => setActiveSignal(s)}
                onFocus={(i) => setFocusIdx(i)}
                onViewAll={() => setView('signals')}
              />

              <QuotesTable
                signals={signals}
                quotes={quotes}
                mt5Online={anyOnline}
                onTrade={(s) => setActiveSignal(s)}
              />

              <MarketOverview
                signals={signals}
                trends={trends}
              />
            </div>
          )}

          {/* ═══ 信号面板视图 / Signal Panel View ═══ */}
          {view === 'signals' && (
            <div>
              {/* 返回仪表盘 / back to dashboard */}
              <button
                onClick={() => setView('dashboard')}
                className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {t('signals.focus.backToDashboard', '返回仪表盘')}
              </button>
              <SignalGrid
                signals={signals}
                newIds={newIds}
                now={now}
                onTrade={(s) => setActiveSignal(s)}
              />
            </div>
          )}
        </>
      )}

      {/* ═══ 滑动确认下单弹窗 / Slide-to-confirm order modal ═══ */}
      {activeSignal && (
        <SlideOrderModal
          signal={activeSignal}
          accounts={accounts}
          quote={quotes[activeSignal.symbol]}
          onCancel={() => setActiveSignal(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* ═══ Toast ═══ */}
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
