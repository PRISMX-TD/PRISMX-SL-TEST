# PRISMX Signal Lab 运维手册

> 最后更新: 2026-06-30 | 维护者: PRISMX-TD
> 架构设计见《技术架构文档》第1节；功能需求见《产品需求文档》。
> 本次更新: 新增 Google 登录(见第七节)。

---

## 一、线上环境速查

| 项目 | 地址 / 实例 |
|------|-----------|
| 前端 | 正式域名 `https://prismxsignallab.com`(根域 → www，Vercel)；`prismx-signal-lab.vercel.app` 仍可用(备用) |
| 后端 API | `https://api.prismxsignallab.com`(VPS: 43.134.110.47, Ubuntu 24.04, 2核4G) |
| 数据库 | Supabase PostgreSQL 17.6, Session pooler: `postgres.efnnpyrauoxwpqjeqqvk@aws-1-ap-northeast-1.pooler.supabase.com:5432` |
| GitHub | `PRISMX-TD/PRISMX-SIGNAL-LAB`(公开仓库) |
| 域名 DNS | Namecheap, `api` A → 43.134.110.47(已配)；根域 `@` A → 216.198.79.1(Vercel)；`www` CNAME → cname.vercel-dns.com(已配) |

## 二、VPS 后端

### 2.1 systemd 服务

配置文件 `/etc/systemd/system/prismx.service`(用户 `ubuntu`,监听 `127.0.0.1:8000`,崩溃自动重启)。

```bash
sudo systemctl status prismx   # 查看状态
sudo systemctl restart prismx  # 重启(代码更新后必须)
sudo journalctl -u prismx -f   # 实时日志
```

### 2.2 环境变量(.env)

位置 `/home/ubuntu/PRISMX-SIGNAL-LAB/backend/.env`(**不入 Git**):

```
ENV=production
JWT_SECRET=<python3 -c "import secrets; print(secrets.token_urlsafe(48))" 生成>
DATABASE_URL=postgresql://postgres.efnnpyrauoxwpqjeqqvk:<密码>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
GOOGLE_CLIENT_ID=<Google Cloud OAuth Web 客户端 ID，形如 xxxx.apps.googleusercontent.com>
```

> **重要(安全)**:生产必须设 `ENV=production`。此时若 `JWT_SECRET` 仍为默认弱密钥，后端会直接拒绝启动，防止 token 被伪造。
> `GOOGLE_CLIENT_ID` 用于 Google 登录(见第七节);留空则 `/api/auth/google` 返回 503(关闭该入口),不影响邮箱登录。
> 注意 `>>` 追加写入前,确认 `.env` 末尾有换行,否则新行会黏到上一行末尾导致启动失败。
> 可选限流覆盖:`RATE_LIMIT_LOGIN`(默认 `10/minute`)、`RATE_LIMIT_REGISTER`(默认 `5/minute`)、`RATE_LIMIT_GOOGLE`(默认 `10/minute`)。
> 如需放行额外的精确预览域名,设 `CORS_ORIGINS`(逗号分隔);已不再用通配正则放行所有 `*.vercel.app`。

密码含 `#` → 写 `%23`；`@ : / ? & %` 同理需 URL 转义。

### 2.3 代码更新流程

```bash
su - ubuntu
cd ~/PRISMX-SIGNAL-LAB && git pull
cd backend && source .venv/bin/activate && pip install -r requirements.txt  # 如有新依赖
sudo systemctl restart prismx
sleep 3 && curl -s https://api.prismxsignallab.com/  # 验证
```

### 2.4 Nginx 与防火墙

站点 `/etc/nginx/sites-available/prismx`(certbot 已自动配 SSL + HTTP→HTTPS 重定向 + WebSocket 升级头)。

双层防火墙:腾讯云安全组(TCP 22/80/443, `0.0.0.0/0`) + ufw(OpenSSH + Nginx Full)。

## 三、前端 Vercel

### 3.1 项目配置

- Framework: Vite | Root: `frontend` | Build: `npm run build`(`tsc -b && vite build`) | Output: `dist`
- 环境变量:
  - **`VITE_API_BASE`** = `https://api.prismxsignallab.com`
  - **`VITE_GOOGLE_CLIENT_ID`** = `<与后端 GOOGLE_CLIENT_ID 同一个值>`(Google 登录用)

> Vite 环境变量在**构建时**注入。新增/修改变量后,必须 Redeploy 一次才生效,否则旧构建读不到。

### 3.2 更新流程

推 GitHub → Vercel 自动构建部署。无需手动操作。

## 四、Bridge 打包与分发

### 4.1 打包命令

```bash
python -m pip install pyinstaller psutil MetaTrader5 "numpy<2"
python -m PyInstaller --clean --noconsole --onefile \
    --name PRISMX-Bridge --collect-all MetaTrader5 --collect-all numpy bridge_app.py
```

产物 `dist/PRISMX-Bridge.exe`(约 33MB)。注意 `--collect-all` 和 `numpy<2` **缺一不可**,否则 MT5 import 失败。

### 4.2 用户使用

打开 exe → 填 API Token(网站获取)→ 点连接。后端地址已内置。必须本机已登录 MT5(`terminal64.exe`)。

## 五、踩坑记录

| # | 问题 | 原因 | 修复 | 影响文件 |
|---|------|------|------|---------|
| 1 | Vercel 构建 `TS2339: Property 'env' does not exist on type 'ImportMeta'` | 缺少 Vite 类型声明 | 创建 `vite-env.d.ts`(含 `/// <reference types="vite/client" />`) | `vite-env.d.ts` |
| 2 | 注册时报 CORS `No 'Access-Control-Allow-Origin' header` | 后端未放行 `*.vercel.app` | 加 `CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"` + VPS 重启 | `config.py`, `main.py` |
| 3 | Supabase `Network is unreachable`(IPv6) | 直连地址只解析 IPv6,腾讯云无 IPv6 | 改用 Session pooler(`aws-1-...pooler.supabase.com`),走 IPv4 | `.env` |
| 4 | HTTPS 连接超时(`curl -v` 卡在 443) | 腾讯云安全组只放了 80,没放 443 | 安全组加 TCP 443,来源 `0.0.0.0/0` | — |
| 5 | Bridge numpy 报错 `numpy._core.multiarray failed to import` | numpy 2.x 与 MetaTrader5 不兼容 | `numpy<2` + PyInstaller `--collect-all numpy` 重新打包 | `bridge_app.py`(打包参数) |
| 6 | Bridge 点连接后打开 MT4,卡死 | `scan_terminals` 匹配了 `terminal.exe`(MT4),MT5 库误连 | 只匹配 `terminal64.exe`(MT5) + `initialize` 加 `timeout=10000` | `bridge_app.py`, `mt5_worker.py` |
| 7 | VPS 操作掉进 root 用户,找不到代码 | root 家目录是 `/root`,代码在 `/home/ubuntu` | `su - ubuntu` 切回 | — |
| 8 | Google 登录 `/api/auth/google` 返回 401,日志报 `ImportError: The requests library is not installed` | `google-auth` 的 `google.auth.transport.requests` 依赖 `requests`,但未列入依赖 | `requirements.txt` 补 `requests`,重装依赖重启 | `requirements.txt` |
| 9 | 重启后 `curl` 偶发 `502 Bad Gateway` | 重启瞬间后端未就绪,nginx 暂时连不上(几秒后自愈) | 等待 `Application startup complete` 后再验证;非故障 | — |
| 10 | 浏览器控制台 `Cross-Origin-Opener-Policy policy would block the window.postMessage call` | Google GSI 弹窗用 postMessage 通信,触发 COOP 提示 | 仅警告,登录不受影响,无需处理 | — |

## 六、安全加固(2026-06-30)

对全项目做了一轮安全升级，重点防注入式攻击与认证爆破。已确认无 SQL 注入(全程 ORM 参数化)、无 XSS(React 自动转义)、无命令注入(无 eval/subprocess)。本轮加固项:

| 级别 | 加固内容 | 影响文件 |
|------|---------|---------|
| P0 | 登录/注册按 IP 限流(slowapi),防在线密码爆破 | `core/rate_limit.py`, `main.py`, `routers/auth.py` |
| P0 | JWT 生产判定改用 `ENV=production`,默认弱密钥在生产拒绝启动 | `core/config.py` |
| P1 | 输入校验:password≥8、symbol/login/suffix 白名单、side 枚举、volume 范围 | `schemas.py`, `routers/bridge.py`, `routers/ea_poll.py` |
| P1 | close/modify 补账号归属校验,修复 IDOR 缺口 | `routers/orders.py` |
| P1 | 前端 WS 鉴权 token 移出 URL query,改首帧 AUTH 消息(避免被代理日志泄露) | `routers/ws.py`, `frontend/src/store/useClientSocket.ts` |
| P1 | 收紧 CORS,去掉放行所有 `*.vercel.app` 的通配正则 | `core/config.py`, `main.py` |
| P1 | Bridge 校验后端下发指令(字段白名单+范围),单条 try/except 隔离,畸形指令不中断整批 | `bridge/mt5_worker.py`, `bridge/bridge_app.py` |
| P2 | API Token 用 `secrets.compare_digest` 常量时间比较;注册去用户枚举;JWT 有效期 7 天→1 天 | `core/security.py`, `routers/auth.py`, `core/config.py` |

部署注意:`requirements.txt` 新增 `slowapi`,VPS `git pull` 后需 `pip install -r requirements.txt` 再重启;`.env` 需新增 `ENV=production`(见 2.2)。

## 七、Google 登录(2026-06-30)

在原邮箱+密码登录之外,新增 Google 一键登录。两种方式并存,按邮箱自动归并到同一账号。

### 7.1 工作原理

前端 Google Identity Services 渲染官方按钮 → 用户授权后拿到 ID Token(`credential`)→ POST 给后端 `/api/auth/google` → 后端用 `google-auth` 按 `GOOGLE_CLIENT_ID` 校验签名/签发方/受众,且只接受已验证邮箱 → 按邮箱找到或创建用户 → 签发本系统 JWT(与邮箱登录一致)。现有鉴权体系不变。

### 7.2 代码改动

| 端 | 改动 | 影响文件 |
|----|------|---------|
| 后端 | 新增配置 `GOOGLE_CLIENT_ID`、`RATE_LIMIT_GOOGLE` | `core/config.py` |
| 后端 | 新增 `verify_google_id_token()`,校验失败记 warning | `core/security.py` |
| 后端 | 新增端点 `POST /auth/google`(找或建用户后签发 JWT) | `routers/auth.py`, `schemas.py` |
| 后端 | `User.password_hash` 改可空(Google 用户无密码);`verify_password` 加空值保护 | `models/__init__.py`, `core/security.py` |
| 后端 | 轻量迁移:生产 Postgres 自动 `ALTER ... DROP NOT NULL` | `core/database.py` |
| 后端 | 依赖新增 `google-auth`、`requests` | `requirements.txt` |
| 前端 | 引入 GSI 脚本 | `index.html` |
| 前端 | 新增 `GoogleLoginButton` 组件 | `components/GoogleLoginButton.tsx` |
| 前端 | 接入 `loginWithGoogle` 与 `/auth/google` | `store/auth.tsx`, `api/client.ts` |
| 前端 | 登录页加分隔线 + Google 按钮 + i18n 文案 | `pages/LoginPage.tsx`, `i18n/en.json`, `i18n/zh.json` |

### 7.3 上线前置(各做一次)

1. **Google Cloud Console** → 创建 OAuth 客户端 ID(类型 Web 应用)。已获授权的 JavaScript 来源填:`http://localhost:5173`、`https://prismxsignallab.com`、`https://www.prismxsignallab.com`。重定向 URI 留空(用弹窗模式)。来源变更需数分钟至数小时生效。
2. **后端 `.env`** 加 `GOOGLE_CLIENT_ID`(见 2.2)。
3. **Vercel** 加环境变量 `VITE_GOOGLE_CLIENT_ID`(与后端同值),并 Redeploy(见 3.1)。
4. 前后端务必使用**同一个 Client ID**:后端用它做 audience 校验,不一致会一律返回 401。

### 7.4 部署步骤

```bash
# 后端(VPS)
cd ~/PRISMX-SIGNAL-LAB && git pull
cd backend && source .venv/bin/activate && pip install -r requirements.txt  # 装 google-auth + requests
sudo systemctl restart prismx
sleep 3 && curl -s https://api.prismxsignallab.com/   # 返回 {"status":"ok"} 即可
# 前端: 推 GitHub 后 Vercel 自动构建; 若环境变量是构建后才加的, 需 Redeploy
```

## 八、TradingView Webhook 接入真实信号(2026-06-30)

用 TradingView 付费账号的警报(alert)产生真实信号,通过 webhook 推到后端,
落库后经 WebSocket 实时显示到网页。无需额外 Windows VPS 挂机:TradingView
警报运行在其自有服务器,本地关机不影响触发。

> PineScript 策略如何编写才能挂上去产信号,见独立文档
> 《PRISMX_Signal_Lab_PineScript策略接入规范.md》。

### 8.1 链路

```
TradingView 警报(策略 alert() 拼 JSON)
  → POST https://api.prismxsignallab.com/api/webhook/tradingview
  → 后端校验 body 内 secret → 按 external_id 去重 → 写 signals 表
  → manager.broadcast_to_clients 经 WebSocket 推所有在线前端
```

### 8.2 代码改动

| 端 | 改动 | 影响文件 |
|----|------|---------|
| 后端 | 新增端点 `POST /api/webhook/tradingview`(校验/去重/落库/广播) | `routers/webhook.py`(新增) |
| 后端 | 注册路由 + mock 引擎受开关控制 | `main.py` |
| 后端 | 新增 `WEBHOOK_SECRET`、`SIGNAL_EXPIRE_MINUTES`、`ENABLE_MOCK_SIGNAL_ENGINE` | `core/config.py` |
| 后端 | `Signal` 表加 `source`、`external_id`(唯一,去重) | `models/__init__.py` |
| 后端 | 轻量迁移:signals 表自动补 `source`/`external_id` 列 | `core/database.py` |

### 8.3 环境变量(.env 新增)

```
WEBHOOK_SECRET=<python3 -c "import secrets; print(secrets.token_urlsafe(32))" 生成>
```

> **重要(安全)**:生产(`ENV=production`)必须设 `WEBHOOK_SECRET`,否则后端拒绝启动;
> 留空时所有 webhook 请求一律 401。该密钥同时要填进 TradingView 警报 JSON 的 `secret` 字段,两边必须一致。
> TradingView webhook 不支持自定义请求头,故密钥放在 body 而非 header。
>
> 可选:`SIGNAL_EXPIRE_MINUTES`(默认 30,信号有效期分钟)、
> `ENABLE_MOCK_SIGNAL_ENGINE`(默认 `true`;接入真实信号后设 `false` 关闭内置模拟引擎,
> 否则真假信号会混在一起)。

### 8.4 TradingView 警报配置

1. 把策略(PineScript `strategy`)添加到图表。
2. 新建警报 → 条件选「策略名 + 任意 alert() 函数调用 / Any alert() function call」。
   ⚠️ 不要在「消息」框手填内容,JSON 已由代码内 `alert()` 生成,消息框内容会被忽略。
3. 通知只勾 **Webhook URL**,填 `https://api.prismxsignallab.com/api/webhook/tradingview`。

### 8.5 部署步骤

```bash
cd ~/PRISMX-SIGNAL-LAB && git pull
# .env 追加 WEBHOOK_SECRET(注意末尾换行,避免黏行;生产没配会拒绝启动)
echo "" >> backend/.env
echo "WEBHOOK_SECRET=<生成的密钥>" >> backend/.env
sudo systemctl restart prismx
sleep 5 && curl -s https://api.prismxsignallab.com/    # {"status":"ok"} 即可
```

### 8.6 验证(curl 自测)

```bash
# 成功入库,返回 {"ok":true,"deduped":false,"id":"..."}
curl -s -X POST https://api.prismxsignallab.com/api/webhook/tradingview -H "Content-Type: application/json" -d '{"secret":"<密钥>","symbol":"XAUUSD","side":"BUY","entry":2345.6,"stopLoss":2338.0,"takeProfit":2360.0,"strategy":"测试","id":"test-001"}'
# 同 id 再发一次 → {"ok":true,"deduped":true,...}(去重生效)
# 错误密钥 → 401 {"detail":"Webhook 密钥无效 ..."}
```

## 九、待办

- [x] 配正式域名 `prismxsignallab.com` → Vercel(Namecheap 删 URL Redirect，根域 A → 216.198.79.1、`www` CNAME → cname.vercel-dns.com；CORS 已含正式域名；SSL 已签发，`https://prismxsignallab.com` 已验证可访问)
- [x] Google 一键登录(前后端已上线,见第七节)
- [x] TradingView Webhook 接入真实信号(已上线并验证,见第八节)
- [ ] 接入真实策略警报后,`.env` 设 `ENABLE_MOCK_SIGNAL_ENGINE=false` 关闭模拟信号
- [ ] Bridge.exe 下载分发(33MB,放网站下载入口)
- [ ] EA 两个版本在 MT5 实测(WebSocket + HTTP 轮询)
- [ ] 数据库备份策略
- [ ] 后续:多用户性能测试、信号策略优化

## 十、接手指南

1. 确认仓库最新 commit、`curl https://api.prismxsignallab.com/` 可通、前端可注册
2. 改后端 → 推 GitHub → VPS `git pull` + `sudo systemctl restart prismx`
3. 改前端 → 推 GitHub → Vercel 自动部署
4. 改 Bridge → 推 GitHub + 本机重新打包 exe + 分发
5. Google 登录相关配置(`GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`、Client ID 一致性)见第七节
6. TradingView 信号接入(`WEBHOOK_SECRET`、警报配置、PineScript 规范)见第八节及《PineScript策略接入规范》
7. 完整架构/API/数据模型见《技术架构文档》
