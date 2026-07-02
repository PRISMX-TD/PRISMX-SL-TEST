// 市场概览卡（仪表盘右下）：环形图 + 图例 + 信号总数 + 准确率曲线
// Market overview card (dashboard bottom-right): donut + legend + total signals + accuracy sparkline
import { type FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Signal, Trend } from '../../api/types'
import { trendStance } from './signalView'

interface Props {
  signals: Signal[]
  trends: Record<string, Trend>
}

// 品种分组：按多周期趋势立场统计 / group symbols by trend stance
function computeDistribution(signals: Signal[], trends: Record<string, Trend>) {
  let long = 0, short = 0, neutral = 0
  const seen = new Set<string>()
  for (const s of signals) {
    if (s.status !== 'ACTIVE') continue
    if (seen.has(s.symbol)) continue
    seen.add(s.symbol)
    const st = trendStance(trends[s.symbol])
    if (st === 'BULL') long++
    else if (st === 'BEAR') short++
    else neutral++
  }
  const total = long + short + neutral
  return { long, short, neutral, total }
}

const CIRCUMFERENCE = 2 * Math.PI * 47 // r=47

const MarketOverview: FC<Props> = ({ signals, trends }) => {
  const { t } = useTranslation()
  const dist = useMemo(() => computeDistribution(signals, trends), [signals, trends])
  const total = Math.max(1, dist.total)
  const longFrac = dist.long / total
  const shortFrac = dist.short / total
  const neutralFrac = dist.neutral / total

  // 环形图各段 dasharray / donut segment dasharray
  const seg1Dash = `${longFrac * CIRCUMFERENCE} ${CIRCUMFERENCE}`
  const seg2Dash = `${shortFrac * CIRCUMFERENCE} ${CIRCUMFERENCE}`
  const seg2Offset = -longFrac * CIRCUMFERENCE
  const seg3Dash = `${neutralFrac * CIRCUMFERENCE} ${CIRCUMFERENCE}`
  const seg3Offset = -(longFrac + shortFrac) * CIRCUMFERENCE

  // 准确率 placeholder（暂无真实数据源）
  const accuracy = signals.length > 0 ? '--' : '--'
  const sparkPoints = '0,40 37,28 74,28 111,20 148,18 185,14 222,10 259,8'

  return (
    <section className="card glass dash-overview p-4">
      <div className="flex items-center gap-2 px-0">
        <h3 className="text-[15px] font-bold">{t('signals.focus.overview', '市场概览')}</h3>
        <button className="ml-auto flex items-center gap-1 h-7 px-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 font-semibold cursor-pointer font-inherit">
          {t('signals.focus.period7d', '7日')}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>

      <div className="donut-wrap">
        <div className="donut">
          <svg width="116" height="116" viewBox="0 0 116 116">
            <circle cx="58" cy="58" r="47" fill="none" stroke="#26262e" strokeWidth="13" />
            <circle cx="58" cy="58" r="47" fill="none" stroke="#2ee07e" strokeWidth="13" strokeLinecap="round" strokeDasharray={seg1Dash} />
            <circle cx="58" cy="58" r="47" fill="none" stroke="#ff4d67" strokeWidth="13" strokeLinecap="round" strokeDasharray={seg2Dash} strokeDashoffset={seg2Offset} />
            <circle cx="58" cy="58" r="47" fill="none" stroke="#a855f7" strokeWidth="13" strokeLinecap="round" strokeDasharray={seg3Dash} strokeDashoffset={seg3Offset} />
          </svg>
          <div className="donut-center">
            <div>
              <b className="num">{signals.filter(s => s.status === 'ACTIVE').length}</b>
              <span>{t('signals.focus.signalTotal', '信号总数')}</span>
            </div>
          </div>
        </div>

        <div className="ov-legend">
          <div className="row">
            <span className="sw" style={{ background: '#2ee07e' }} />
            <span className="k">{t('signals.focus.bull')}</span>
            <span className="v num">{Math.round(longFrac * 100)}% <i>({dist.long})</i></span>
          </div>
          <div className="row">
            <span className="sw" style={{ background: '#ff4d67' }} />
            <span className="k">{t('signals.focus.bear')}</span>
            <span className="v num">{Math.round(shortFrac * 100)}% <i>({dist.short})</i></span>
          </div>
          <div className="row">
            <span className="sw" style={{ background: '#a855f7' }} />
            <span className="k">{t('signals.focus.neutral')}</span>
            <span className="v num">{Math.round(neutralFrac * 100)}% <i>({dist.neutral})</i></span>
          </div>
        </div>
      </div>

      <div className="acc-section">
        <div className="acc-row">
          <span className="k">{t('signals.focus.accuracy7d', '信号准确率 (7日)')}</span>
          <span className="v num">{accuracy}</span>
        </div>
        <svg className="acc-spark" viewBox="0 0 260 56" preserveAspectRatio="none">
          <polyline fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            points={sparkPoints}
          />
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="1" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
          <polygon fill="url(#sparkGrad)"
            points="0,56 0,40 37,28 74,28 111,20 148,18 185,14 222,10 259,8 259,56"
          />
        </svg>
        <div className="acc-x-labels">
          <span>D1</span><span>D2</span><span>D3</span><span>D4</span><span>D5</span><span>D6</span><span>D7</span>
        </div>
      </div>
    </section>
  )
}

export default MarketOverview
