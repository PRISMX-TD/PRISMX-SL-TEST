// 通用工具 / Common utilities

// 生成幂等下单 ID / generate idempotent client order id
export function clientOrderId(): string {
  return 'co_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// 格式化时间 / format timestamp
// 后端统一存 UTC 时间。若字符串无时区标记（Postgres TIMESTAMP 读出时常无），
// 补 'Z' 当作 UTC 解析，避免被浏览器按本地时区误读导致差 8 小时；
// 再固定按马来西亚时区（Asia/Kuala_Lumpur, UTC+8）显示。
// Backend stores UTC. If the string carries no tz marker, treat it as UTC,
// then always render in Malaysia time.
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)
  const d = new Date(hasTz ? iso : iso + 'Z')
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
