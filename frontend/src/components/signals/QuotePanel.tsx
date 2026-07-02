// 实时报价组件：移动端单行报价条 + 桌面端完整面板。
// Live quote widgets: single-line bar for mobile + full panel for desktop.
import { useTranslation } from 'react-i18next'
import type { Quote } from '../../api/types'

// 严格按交易商小数位数显示，避免浮点残差（如 1.32386999…）。
// Format strictly by broker digits to avoid float noise.
const fmtPrice = (v: number, digits?: number) =>
  typeof digits === 'number' ? v.toFixed(digits) : String(v)

// 单行报价条：只显示当前聚焦品种的 bid/ask，用于移动端。
// Single-line quote bar: shows only the focused symbol's bid/ask, for mobile.
export function QuoteBar({ quote }: { quote?: Quote }) {
  const { t } = useTranslation()
  if (!quote) return null
  return (
    <div className="glass flat-card mb-3 flex items-center gap-2 px-3 py-2.5 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full bg-up animate-breathe" />
      <span className="font-semibold text-slate-200">{quote.symbol}</span>
      <span className="ml-auto text-[10px] text-slate-500">{t('signals.quotes.bidShort')}</span>
      <span className="font-mono font-bold tabular-nums text-up">{fmtPrice(quote.bid, quote.digits)}</span>
      <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">{t('signals.quotes.spread')}</span>
      <span className="text-[10px] text-slate-500">{t('signals.quotes.askShort')}</span>
      <span className="font-mono font-bold tabular-nums text-down">{fmtPrice(quote.ask, quote.digits)}</span>
    </div>
  )
}

// 实时报价面板：展示桥接上报的 bid/ask。未连接 MT5 时显示占位。
// Live quotes panel: shows bid/ask reported by the bridge; placeholder when MT5 offline.
export function QuotePanel({ quotes, mt5Online }: { quotes: Record<string, Quote>; mt5Online: boolean }) {
  const { t } = useTranslation()
  const nameOf = (sym: string) => t(`signals.symbolNames.${sym}`, { defaultValue: '' })
  const rows = Object.values(quotes).sort((a, b) => a.symbol.localeCompare(b.symbol))

  return (
    <div className="glass flat-card mt-4 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
          {t('signals.quotes.title')}
        </h3>
        <span
          className={`h-1.5 w-1.5 rounded-full ${mt5Online ? 'bg-up animate-breathe' : 'bg-slate-600'}`}
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 py-6 text-xs text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          {mt5Online ? t('signals.quotes.waiting') : t('signals.quotes.notConnected')}
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* 列头 / column header */}
          <div className="grid grid-cols-3 px-2 text-[10px] uppercase tracking-wider text-slate-500">
            <span>{/* symbol */}</span>
            <span className="text-right">{t('signals.quotes.bid')}</span>
            <span className="text-right">{t('signals.quotes.ask')}</span>
          </div>
          {rows.map((q) => (
            <div
              key={q.symbol}
              className="grid grid-cols-3 items-center rounded-xl bg-white/[0.03] px-2 py-2"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold text-slate-100">{q.symbol}</div>
                {nameOf(q.symbol) && <div className="truncate text-[10px] text-slate-500">{nameOf(q.symbol)}</div>}
              </div>
              <div className="text-right font-mono text-sm font-semibold text-up">{fmtPrice(q.bid, q.digits)}</div>
              <div className="text-right font-mono text-sm font-semibold text-down">{fmtPrice(q.ask, q.digits)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
