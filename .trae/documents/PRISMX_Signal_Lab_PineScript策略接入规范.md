# PRISMX Signal Lab - PineScript 策略接入规范

> 最后更新: 2026-06-30 | 维护者: PRISMX-TD
> 本文档说明：一个 TradingView PineScript 策略要满足哪些条件，才能挂上去并把真实信号推到 PRISMX 网页。
> 配套部署说明见《部署与上线进度》第八节。

---

## 一、核心要求一句话

策略必须在触发时，用 `alert()` 发出一段**符合约定格式的 JSON 字符串**，里面带上正确的 `secret`，并通过 TradingView 警报的 Webhook 推到：

```
https://api.prismxsignallab.com/api/webhook/tradingview
```

后端只认这段 JSON，画图、买卖箭头、回测表现都不影响是否产生信号——**唯一决定能否产信号的，是 `alert()` 里那段 JSON。**

---

## 二、信号 JSON 字段规范

后端接口接收的字段如下（对应 `routers/webhook.py` 的 `TradingViewSignal`）：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `secret` | ✅ | 字符串 | webhook 密钥，必须与服务器 `.env` 的 `WEBHOOK_SECRET` 完全一致，否则 401 |
| `symbol` | ✅ | 字符串 | 品种代码，1-20 位，只允许字母/数字/`._-`，如 `XAUUSD`、`EURUSD` |
| `side` | ✅ | 字符串 | 方向，`BUY` / `SELL`（大小写均可，后端统一转大写） |
| `entry` | 选填 | 数字 | 入场价。不带引号的纯数字 |
| `stopLoss` | 选填 | 数字 | 止损价，≥0 |
| `takeProfit` | 选填 | 数字 | 止盈价，≥0 |
| `strategy` | 选填 | 字符串 | 策略名，展示在网页 indicator 栏；省略则显示 "TradingView" |
| `id` | 选填 | 字符串 | 外部唯一编号，用于去重；建议用 `品种+K线时间` 拼成 |

**几个关键约束（写错会导致信号被拒或显示异常）：**

- 数字字段（`entry` / `stopLoss` / `takeProfit`）**不能加引号**，必须是纯数字。
- 字符串字段（`secret` / `symbol` / `side` / `strategy` / `id`）**必须加双引号**。
- 整段必须是**合法 JSON**：键用双引号、字段间用逗号、末尾字段后不能多逗号。
- `secret` 写错 → 后端返回 401，信号不入库。
- 带了重复的 `id` → 后端去重，返回 `deduped:true`，网页不会重复显示。

---

## 三、必须遵守的三条铁律

### 铁律 1：用 `strategy`，不用 `indicator`

声明用 `strategy(...)`，因为要发的就是「一笔交易」（入场+止盈+止损），strategy 内部天然支持，且能回测看胜率。

### 铁律 2：只在 K 线收盘后触发，防止重绘

未收盘 K 线的数据会变，会导致信号闪烁/重发。两个手段一起上：

- 触发条件加 `and barstate.isconfirmed`
- `alert()` 用 `alert.freq_once_per_bar_close`

### 铁律 3：`id` 必须唯一且稳定

用 `syminfo.ticker + "-" + str.tostring(time)` 拼成。`time` 是当前 K 线开盘时间戳，同一根 K 线固定不变，天然适合去重，TradingView 偶发重发也不会在网页上重复。

---

## 四、标准模板（可直接改用）

下面是一个最小可用骨架。**写新策略时，只改「信号条件」和「止盈止损算法」两处，其余原样保留。**

```pinescript
//@version=5
strategy("策略名", overlay=true)

// ===== 1) 固定配置：不要改 =====
SECRET = "<你的 WEBHOOK_SECRET>"

f_json(side, entry, sl, tp, name) =>
    s = '{"secret":"' + SECRET + '",'
    s := s + '"symbol":"' + syminfo.ticker + '",'
    s := s + '"side":"' + side + '",'
    s := s + '"entry":' + str.tostring(entry) + ','
    s := s + '"stopLoss":' + str.tostring(sl) + ','
    s := s + '"takeProfit":' + str.tostring(tp) + ','
    s := s + '"strategy":"' + name + '",'
    s := s + '"id":"' + syminfo.ticker + '-' + str.tostring(time) + '"}'
    s

f_round(p) => math.round_to_mintick(p)

// ===== 2) 信号条件：改这里 =====
// 示例：均线交叉。换成你自己的进场逻辑
fastMA = ta.sma(close, 20)
slowMA = ta.sma(close, 50)
goLong  = ta.crossover(fastMA, slowMA)  and barstate.isconfirmed
goShort = ta.crossunder(fastMA, slowMA) and barstate.isconfirmed

// ===== 3) 止盈止损算法：改这里 =====
// 示例：ATR 法。也可改成固定点数、支撑阻力等
atr = ta.atr(14)
slDist = atr * 1.5
tpDist = atr * 3.0

// ===== 4) 下单 + 发信号：不要改 =====
if goLong
    e = f_round(close)
    sl = f_round(close - slDist)
    tp = f_round(close + tpDist)
    strategy.entry("Long", strategy.long)
    strategy.exit("Long X", "Long", stop=sl, limit=tp)
    alert(f_json("BUY", e, sl, tp, "策略名"), alert.freq_once_per_bar_close)

if goShort
    e = f_round(close)
    sl = f_round(close + slDist)
    tp = f_round(close - tpDist)
    strategy.entry("Short", strategy.short)
    strategy.exit("Short X", "Short", stop=sl, limit=tp)
    alert(f_json("SELL", e, sl, tp, "策略名"), alert.freq_once_per_bar_close)
```

---

## 五、PineScript 常见报错速查

| 报错 | 原因 | 修复 |
|------|------|------|
| `Syntax error ... end of line without line continuation` | 多行字符串用了跨行续接，或缩进混用 Tab | JSON 拼接改成逐行 `s := s + ...`；缩进只用空格不用 Tab |
| `Could not find function or function reference 'alert'` | version 声明缺失或写成了 `//@version=4` | 顶部必须是 `//@version=5` |
| `Mismatched input` | JSON 里漏了逗号或引号不配对 | 对照第二节逐字段检查 |
| 警报建了但网页没信号 | 警报条件没选「alert() 函数调用」 | 重建警报，条件选「任意 alert() function call」 |

---

## 六、上线前自检清单

挂一个新策略前，逐项确认：

- [ ] 顶部是 `//@version=5` 且用 `strategy(...)` 声明
- [ ] `SECRET` 填的是当前服务器 `.env` 里的 `WEBHOOK_SECRET`，且一致
- [ ] 进场条件都带了 `and barstate.isconfirmed`
- [ ] `alert()` 用了 `alert.freq_once_per_bar_close`
- [ ] `id` 用 `syminfo.ticker + "-" + str.tostring(time)`
- [ ] 数字字段无引号，字符串字段有引号
- [ ] TradingView 警报条件选了「任意 alert() 函数调用」，通知勾了 Webhook URL 并填对地址
- [ ] 先用历史回测确认策略表现，再对外发布
- [ ] 真正上线用合适周期（建议 ≥15 分钟），不要用 1 分钟图对外

---

## 七、注意事项

- **`secret` 不要泄露**：策略代码里含密钥，分享代码截图前记得打码。若密钥泄露，在服务器 `.env` 换新值并同步更新所有策略。
- **本示例策略仅用于验证链路**：均线交叉不构成稳定盈利逻辑，对外发布前请用真实策略并充分回测。
- **合规提醒**：对外发布外汇/黄金买卖信号在部分地区可能涉及投资建议监管，产品内应附免责声明。

