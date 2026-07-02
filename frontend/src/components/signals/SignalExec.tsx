// 交易信号执行卡：入场价 + SL/TP + RR + 倒计时 + 下单按钮
// Signal exec card: entry + SL/TP + RR + countdown + trade button
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import type { Signal } from '../../api/types'
import { calcRiskReward, calcCountdown } from '../../api/utils'
import { SIGNAL_LIFESPAN_MS, rrTone } from './signalView'

interface Props {
  signal: Signal
  now: number
  onTrade: (s: Signal) => void
}

const SignalExec: FC<Props> = ({ signal, now, onTrade }) => {
  const { t } = useTranslation()
  const rr = calcRiskReward(signal.symbol, signal.entry, signal.stopLoss, signal.takeProfit)
  const cd = calcCountdown(signal.expireAt, SIGNAL_LIFESPAN_MS, now)
  const isBuy = signal.side === 'BUY'
  const sideTag = isBuy ? t('common.buy') : t('common.sell')

  return (
    <section className="card glass dash-exec p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
        <h3 className="text-[15px] font-bold">{t('signals.focus.signalHeading')}</h3>
        <span className={`chip ml-2 ${isBuy ? 'chip-buy' : 'chip-sell'}`}>{sideTag}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-down font-semibold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          {t('signals.focus.remainingTtl')} <b className="num">{cd?.text ?? '-'}</b>
        </span>
      </div>

      {/* Entry price */}
      <div className="entry-block">
        <div className="cap">{t('signals.colEntry').toUpperCase()}</div>
        <div className="val num">{signal.entry ?? '-'}</div>
      </div>

      {/* SL / TP tiles */}
      <div className="sl-tp-grid mt-4">
        <div className="exec-tile tile-sl">
          <div className="cap">{t('signals.colSl')}</div>
          <div className="val num">{signal.stopLoss ?? '-'}</div>
        </div>
        <div className="exec-tile tile-tp">
          <div className="cap">{t('signals.colTp')}</div>
          <div className="val num">{signal.takeProfit ?? '-'}</div>
        </div>
      </div>

      {/* Stats row: RR + Win rate placeholder */}
      <div className="exec-stats-row mt-4">
        <div>
          <div className="k">{t('signals.focus.rrLabel')}</div>
          <div className={`v num ${rrTone(rr?.rr ?? null)}`}>
            {rr?.rr != null ? `1 : ${rr.rr.toFixed(2)}` : '-'}
          </div>
        </div>
        <div>
          <div className="k">{t('signals.focus.trendLabel')}</div>
          <div className="v num">{signal.symbol}</div>
        </div>
      </div>

      {/* Trade button */}
      <button onClick={() => onTrade(signal)} className="btn btn-primary exec-full-btn mt-auto">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        {t('signals.trade')}
      </button>

      {/* Expiry note */}
      {signal.expireAt && (
        <div className="exec-expiry">
          {t('signals.focus.remainingTtl')}: <span className="num">{cd?.text ?? '-'}</span>
        </div>
      )}
    </section>
  )
}

export default SignalExec
