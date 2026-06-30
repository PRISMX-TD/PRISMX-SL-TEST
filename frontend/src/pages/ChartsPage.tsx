// 实时行情图表页：嵌入 TradingView 高级图表 Widget。
// Live charts page: embeds the TradingView Advanced Chart widget.
//
// 数据由用户浏览器直连 TradingView，不经过后端 / VPS，因此无论多少用户都
// 不会给后端带来额外负载。品种默认联动用户当前持仓 / 信号。
// Candle data is fetched by the browser directly from TradingView (never via
// our backend/VPS), so it adds no server load regardless of user count. The
// symbol defaults to the user's current position / latest signal.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLive } from '../store/live'
import { mt5ToTradingView } from '../api/utils'

// 可选周期 / selectable intervals (TradingView interval codes)
const INTERVALS: { code: string; label: string }[] = [
  { code: '1', label: '1m' },
  { code: '5', label: '5m' },
  { code: '15', label: '15m' },
  { code: '60', label: '1H' },
  { code: '240', label: '4H' },
  { code: 'D', label: '1D' },
]

const INTERVAL_KEY = 'prismx.charts.interval'

export default function ChartsPage() {
  const { t } = useTranslation()
  const { positions, signals } = useLive()
  const containerRef = useRef<HTMLDivElement>(null)

  // 候选品种：来自持仓与信号，去重 / candidate symbols from positions & signals
  const symbols = useMemo(() => {
    const set = new Set<string>()
    positions.forEach((p) => p.symbol && set.add(p.symbol))
    signals.forEach((s) => s.symbol && set.add(s.symbol))
    const list = Array.from(set)
    // 没有任何持仓/信号时给个常用默认 / fallback when nothing is open
    return list.length ? list : ['XAUUSD', 'EURUSD', 'BTCUSD']
  }, [positions, signals])

  const [symbol, setSymbol] = useState<string>(symbols[0])
  const [interval, setIntervalCode] = useState<string>(
    () => localStorage.getItem(INTERVAL_KEY) || '15'
  )

  // 候选品种变化后，若当前选择已不在列表中则回退到第一个。
  // If the current pick disappears from the list, fall back to the first one.
  useEffect(() => {
    if (!symbols.includes(symbol)) setSymbol(symbols[0])
  }, [symbols, symbol])

  useEffect(() => {
    localStorage.setItem(INTERVAL_KEY, interval)
  }, [interval])

  const tvSymbol = mt5ToTradingView(symbol)

  // 每次品种 / 周期变化时重建 widget。TradingView 脚本以子节点形式注入，
  // 销毁时清空容器即可。Rebuild the widget on symbol/interval change.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''

    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget h-full w-full'
    el.appendChild(widget)

    const script = document.createElement('script')
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      interval,
      autosize: true,
      timezone: 'Asia/Kuala_Lumpur',
      theme: 'dark',
      style: '1',
      locale: t('charts.tvLocale'),
      // 黑紫主题配色 / black & purple theme styling
      backgroundColor: 'rgba(10, 7, 16, 1)',
      gridColor: 'rgba(139, 70, 255, 0.08)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      withdateranges: true,
      support_host: 'https://www.tradingview.com',
    })
    el.appendChild(script)

    return () => {
      el.innerHTML = ''
    }
  }, [tvSymbol, interval, t])

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-bold text-slate-100">
          <span className="neon-text">{t('charts.title')}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t('charts.subtitle')}</p>
      </div>

      {/* 控制条：品种 + 周期 / controls: symbol + interval */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {t('charts.symbol')}
          </span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded-lg border border-white/10 bg-ink-800/80 px-3 py-1.5 text-sm text-slate-100 outline-none transition focus:border-prism-500"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-800/50 p-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.code}
              onClick={() => setIntervalCode(iv.code)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                interval === iv.code
                  ? 'bg-prism-600/30 text-prism-200 shadow-prism'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* 图表容器：自适应高度，移动端给底部 Tab 栏留空间 */}
      {/* Chart container: responsive height, leaves room for the mobile tab bar */}
      <div className="glass relative flex-1 overflow-hidden p-1.5">
        <div
          ref={containerRef}
          className="tradingview-widget-container h-[60vh] w-full sm:h-[calc(100vh-16rem)]"
        />
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-600">
        {t('charts.disclaimer')}
      </p>
    </div>
  )
}
