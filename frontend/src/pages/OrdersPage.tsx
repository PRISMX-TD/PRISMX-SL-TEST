// 订单与回执页 / Orders & receipts page
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLive } from '../store/live'
import { fmtTime } from '../api/utils'
import type { OrderStatus } from '../api/types'
import PositionCard from '../components/PositionCard'

const statusStyle: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  FILLED: 'bg-up/15 text-up',
  REJECTED: 'bg-down/15 text-down',
  FAILED: 'bg-down/15 text-down',
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const { orders, positions, refreshAll } = useLive()
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' | 'info' } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = (msg: string, kind: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ msg, kind })
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
    // 触发一次刷新以尽快反映平仓/改单结果 / refresh to reflect the result sooner
    refreshAll()
  }

  const toastStyle =
    toast?.kind === 'error'
      ? 'border-down/40 bg-down/15 text-down'
      : toast?.kind === 'info'
        ? 'border-prism-600/40 bg-prism-600/15 text-prism-300'
        : 'border-up/40 bg-up/15 text-up'

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-slate-100">
          <span className="neon-text">{t('orders.title')}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t('orders.subtitle')}</p>
      </div>

      {/* 持仓概览 / positions overview */}
      <div className="glass mb-5 p-5">
        <h3 className="mb-3 font-display text-lg font-semibold text-slate-100">
          {t('orders.positions')}
        </h3>
        {positions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">{t('orders.noPositions')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((p, i) => (
              <PositionCard key={p.ticket ?? i} position={p} onActionDone={showToast} />
            ))}
          </div>
        )}
      </div>

      {/* 订单表 / orders table */}
      <div className="glass overflow-hidden">
        {orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">{t('orders.empty')}</p>
        ) : (
          <>
            {/* 桌面端表格 / desktop table */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">{t('orders.colTime')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colType')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colAccount')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colSymbol')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colSide')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colVolume')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colStatus')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colTicket')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colPrice')}</th>
                  <th className="px-4 py-3 font-medium">{t('orders.colMessage')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-white/5 transition hover:bg-prism-600/10"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {fmtTime(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="tag border border-white/10 bg-white/[0.05] text-slate-300">
                        {t(`orders.action.${o.action ?? 'ORDER'}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">{o.mt5Login ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-slate-100">{o.symbol}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`tag ${
                          o.side === 'BUY' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                        }`}
                      >
                        {o.side === 'BUY' ? t('common.buy') : t('common.sell')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200">{o.volume}</td>
                    <td className="px-4 py-3">
                      <span className={`tag ${statusStyle[o.status]}`}>
                        {t(`orders.status.${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{o.mt5Ticket ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{o.filledPrice ?? '-'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-400">
                      {o.message ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* 移动端卡片列表 / mobile card list */}
            <div className="divide-y divide-white/5 md:hidden">
              {orders.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-100">{o.symbol}</span>
                      <span
                        className={`tag ${
                          o.side === 'BUY' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                        }`}
                      >
                        {o.side === 'BUY' ? t('common.buy') : t('common.sell')}
                      </span>
                    </div>
                    <span className={`tag ${statusStyle[o.status]}`}>
                      {t(`orders.status.${o.status}`)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colType')}</span>
                      <span className="text-slate-300">{t(`orders.action.${o.action ?? 'ORDER'}`)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colVolume')}</span>
                      <span className="font-mono text-slate-200">{o.volume}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colAccount')}</span>
                      <span className="font-mono text-slate-300">{o.mt5Login ?? '-'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colPrice')}</span>
                      <span className="font-mono text-slate-200">{o.filledPrice ?? '-'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colTicket')}</span>
                      <span className="font-mono text-slate-400">{o.mt5Ticket ?? '-'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">{t('orders.colTime')}</span>
                      <span className="text-slate-400">{fmtTime(o.createdAt)}</span>
                    </div>
                  </div>

                  {o.message && (
                    <p className="mt-2 break-words text-xs text-slate-500">{o.message}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

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
