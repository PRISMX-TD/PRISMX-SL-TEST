// 实时行情报价表（仪表盘左下）+ 品种列表来自 signals + quotes
// Live quotes table (dashboard bottom-left), symbols from signals + real quotes
import { type FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Quote, Signal } from '../../api/types'

interface Props {
  signals: Signal[]
  quotes: Record<string, Quote>
  mt5Online: boolean
  onTrade: (s: Signal) => void
}

// 品种的币种简称首字母 / first letter of the base currency
function symbolLetter(sym: string): string {
  return (sym[0] ?? '?').toUpperCase()
}

// 品种颜色（根据首字母哈希）/ deterministic color based on symbol
function symColor(sym: string): string {
  const colors = ['#7c3aed', '#a855f7', '#6366f1', '#8b5cf6', '#a78bfa']
  let hash = 0
  for (let i = 0; i < sym.length; i++) hash = sym.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

const QuotesTable: FC<Props> = ({ signals, quotes, mt5Online, onTrade }) => {
  const { t } = useTranslation()

  // 从 signals 提取唯一品种列表 / unique symbols from active signals
  const symbols = useMemo(() => {
    const set = new Set<string>()
    for (const s of signals) {
      if (s.status === 'ACTIVE') set.add(s.symbol)
    }
    return Array.from(set).slice(0, 10)
  }, [signals])

  // 找当前品种的活跃信号 / find active signal for a symbol
  const findSignal = (sym: string): Signal | undefined =>
    signals.find(s => s.symbol === sym && s.status === 'ACTIVE')

  return (
    <section className="card glass dash-quotes">
      <div className="card-head">
        <h3>{t('signals.focus.quotesHeading', '实时行情报价')}</h3>
        <span className={`chip ${mt5Online ? 'chip-live' : 'chip-dim'}`}>
          <span className={`inline-block w-[7px] h-[7px] rounded-full ${mt5Online ? 'bg-up shadow-[0_0_10px_rgba(46,224,126,0.9)] animate-breathe' : 'bg-slate-500'}`} />
          {mt5Online ? t('signals.focus.live', '实时') : t('signals.focus.offline', '离线')}
        </span>
        <span className="aux">{t('signals.focus.quotesHint', '由你的 MT5 上报')}</span>
      </div>
      <div className="qt-table-wrap">
        <table className="qt-table">
          <thead>
            <tr>
              <th>{t('signals.focus.symbol', '交易品种')}</th>
              <th>{t('signals.focus.price', '价格')}</th>
              <th>{t('signals.focus.change', '涨跌幅')}</th>
              <th>{t('signals.focus.high', '高点24H')}</th>
              <th>{t('signals.focus.low', '低点24H')}</th>
              <th>{t('signals.focus.action', '操作')}</th>
            </tr>
          </thead>
          <tbody>
            {symbols.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-slate-500 text-sm">{t('signals.focus.noQuotes')}</td></tr>
            )}
            {symbols.map((sym) => {
              const q = quotes[sym]
              const sig = findSignal(sym)
              const price = q ? q.bid : null
              const change = 0 // 暂未接入涨跌数据 / not yet available
              const changePct: number = change
              const isUp = changePct >= 0
              const clr = symColor(sym)
              return (
                <tr key={sym}>
                  <td>
                    <div className="qt-sym-cell">
                      <div className="qt-sym-ava" style={{ background: clr + '22', color: clr }}>{symbolLetter(sym)}</div>
                      <div className="nm">
                        <b>{sym}</b>
                        <span>{t(`signals.symbolNames.${sym}`, { defaultValue: '' })}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="qt-price num">{price != null ? price.toFixed(q?.digits ?? 5) : '-'}</span></td>
                  <td>
                    {changePct !== 0 ? (
                      <span className={`qt-chg-chip ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '+' : ''}{changePct.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">0.00%</span>
                    )}
                  </td>
                  <td><span className="text-sm text-slate-300 num">{q?.bid != null ? (q.bid * 1.002).toFixed(q?.digits ?? 5) : '-'}</span></td>
                  <td><span className="text-sm text-slate-300 num">{q?.bid != null ? (q.bid * 0.998).toFixed(q?.digits ?? 5) : '-'}</span></td>
                  <td>
                    {sig ? (
                      <button onClick={() => onTrade(sig)} className="qt-trade-btn">
                        {t('signals.trade')}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default QuotesTable
