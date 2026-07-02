// 信号面板专用 Hook / hooks used by the signals panel
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Signal } from '../../api/types'
import {
  DEFAULT_WATCHLIST,
  NEW_HIGHLIGHT_MS,
  effectiveStatus,
  type FocusEntry,
  type FocusState,
} from './signalView'

// 每秒滴答的当前时间，用于实时倒计时 / a per-second ticking clock for live countdowns
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

// 跟踪新到达的信号 id，用于短暂高亮 / track freshly arrived signal ids for a brief highlight
export function useNewSignalIds(signals: Signal[]): Set<string> {
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

// 由实时信号派生每个关注品种的当前状态。
// 关注列表 = 默认清单 ∪ 任何当前有 ACTIVE 信号的品种（不漏掉引擎新出的品种）。
export function useFocusEntries(signals: Signal[], now: number): FocusEntry[] {
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
