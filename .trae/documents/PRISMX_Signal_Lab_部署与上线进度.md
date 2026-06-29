# PRISMX Signal Lab 部署与上线进度

> 最后更新: 2026-06-29
> 维护者: PRISMX-TD

## 一、当前状态概览(一图看懂)

```
用户浏览器
  │  访问 prismxsignallab.com(暂用 prismx-signal-lab.vercel.app)
  ↓
Vercel(前端静态托管)
  │  调用 https://api.prismxsignallab.com
  ↓
腾讯云 VPS — FastAPI 后端
  │  uvicorn + systemd(常驻) + Nginx + HTTPS
  │  ├─ REST API(注册/登录/信号/下单)
  │  ├─ WebSocket(/ws)(前端实时推送)
  │  ├─ 信号引擎(每15秒生成信号)
  │  └─ EA 桥接(/ws/ea + /api/ea/poll)
  │
  ↓ 读写
Supabase(PostgreSQL 17.6)
  │  users / ea_bindings / signals / orders

Bridge.exe(用户电脑)
  │  扫描本机 MT5(terminal64.exe)
  ↓  下单 / 回执
MT5 终端(真实交易/模拟)
```

## 二、各平台职责与关键信息

| 平台 | 职责 | 关键实例/域名 | 状态 |
|------|------|-------------|------|
| **GitHub** | 代码仓库 | `PRISMX-TD/PRISMX-SIGNAL-LAB`(仓库公开) | ✅ |
| **Vercel** | 前端托管(Vite, root: frontend) | `prismx-signal-lab.vercel.app`(临时) | ✅ |
| **腾讯云 VPS** | 后端 FastAPI + Nginx + HTTPS | IP: 43.134.110.47 / 域名: `api.prismxsignallab.com` | ✅ |
| **Supabase** | PostgreSQL 数据库 | Session pooler: `postgres.efnnpyrauoxwpqjeqqvk@aws-1-ap-northeast-1.pooler.supabase.com:5432` | ✅ |
| **Namecheap** | 域名 DNS | `prismxsignallab.com` / `api` A 记录 → 43.134.110.47 | ⚠️ api 已配,根域待配 Vercel |
| **Let's Encrypt** | HTTPS 证书(自动续期) | certbot + Nginx 插件,到期 2026-09-26 | ✅ |

## 三、已完成的代码改动(Git 提交历史)

| 提交 | 内容 | 影响文件 |
|------|------|---------|
| `52e66c3` | Initial commit(60 files) | 全部 |
| `c10188c` | Postgres 支持: psycopg2 驱动,类型映射,生产 CORS | `requirements.txt`, `database.py`, `config.py` |
| `df24e0e` | 前端支持 VITE_API_BASE(REST + WebSocket) | `client.ts`, `useClientSocket.ts`, `.env.example` |
| `ad29928` | Fix: vite-env.d.ts(修复 import.meta.env TS 类型) | `vite-env.d.ts` |
| `821a19b` | CORS 正则放行所有 `*.vercel.app`(含 preview) | `config.py`, `main.py` |
| `e253380` | Bridge 默认连线上 + 隐藏后端地址输入框 | `bridge_app.py` |
| `b621502` | Bridge: 只扫 MT5 terminal64.exe(排除 MT4)+ init 超时 | `bridge_app.py`, `mt5_worker.py` |

### 关键代码改动细节(以后接手 AI 必读)

1. **数据库切换(SQLite → Postgres)**
   - [database.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/backend/app/core/database.py) 第 37-69 行:`_migrate_columns` 现在按 `DATABASE_URL` 是否以 `postgres` 开头自动切换 `DATETIME` ↔ `TIMESTAMP` 类型
   - `.env` 文件中 `DATABASE_URL` 设完整 Postgres 连接串即可(见"VPS 上的 .env"一节)
   - ⚠️ 如密码含 `#`,必须转义为 `%23`

2. **前端 API 地址配置**
   - [client.ts](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/backend/app/main.py#L14):REST 用 `VITE_API_BASE` 前缀,留空则走开发期 Vite 代理
   - [useClientSocket.ts](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/frontend/src/store/useClientSocket.ts#L19):WebSocket 同样用 `VITE_API_BASE`,自动 `http→ws`/`https→wss` 转换;留空则回退到 `location.host`
   - [vite-env.d.ts](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/frontend/src/vite-env.d.ts):声明了 `ImportMetaEnv.VITE_API_BASE`,否则 `tsc -b` 会报 TS2339

3. **CORS 配置**
   - [config.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/backend/app/core/config.py#L18-L23):`CORS_ORIGINS` 放行 `prismxsignallab.com` + `www` + localhost
   - 额外 `CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"` 放行所有 Vercel 部署域名(含预览)
   - [main.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/backend/app/main.py#L10-L17):应用 `allow_origin_regex` 参数

4. **Bridge 改动**
   - [bridge_app.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/bridge/bridge_app.py#L30):`DEFAULT_BACKEND = "https://api.prismxsignallab.com"`(写死线上)
   - 移除了"后端地址"输入框(第 365-367 行原有,现删除,只保留 Token 输入)
   - `_on_connect` 强制用 `DEFAULT_BACKEND`
   - `scan_terminals` **只匹配** `terminal64.exe`(MT5),**排除** `terminal.exe`(MT4),否则 MT5 库误连 MT4 会卡死
   - [mt5_worker.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/bridge/mt5_worker.py#L252):`initialize` 加了 `timeout=10000`(10秒),防止异常终端无限阻塞

## 四、VPS 部署完整复盘

### 4.1 VPS 配置

- 服务商: 腾讯云轻量
- 系统: Ubuntu 24.04 LTS(x86_64)
- 配置: 2核 / 4GB / 90GB SSD
- 公网 IP: **43.134.110.47**
- SSH 用户: **ubuntu**(有 sudo 权限)

### 4.2 安装的软件

```
python3(3.12.3,系统自带) + nginx(1.24) + git(2.43) + certbot + ufw + 虚拟环境
```

### 4.3 后端运行方式: systemd

服务名称: `prismx.service`
配置文件: `/etc/systemd/system/prismx.service`

```ini
[Unit]
Description=PRISMX Signal Lab Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/PRISMX-SIGNAL-LAB/backend
EnvironmentFile=/home/ubuntu/PRISMX-SIGNAL-LAB/backend/.env
ExecStart=/home/ubuntu/PRISMX-SIGNAL-LAB/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

关键点:
- `--host 127.0.0.1`: uvicorn 只监听本机,Nginx 反代后才对外暴露(安全)
- `EnvironmentFile`: 自动加载 `.env`(JWT 密钥 + 数据库连接串)
- `Restart=always`: 崩溃自动重启

常用管理命令:
```bash
sudo systemctl status prismx      # 查看状态
sudo systemctl restart prismx     # 重启(代码更新后必须执行)
sudo journalctl -u prismx -f      # 查看实时日志
```

### 4.4 VPS 上的 .env(位置: /home/ubuntu/PRISMX-SIGNAL-LAB/backend/.env)

**此文件不在 GitHub 仓库中,由 .gitignore 排除。** 需要两个变量:

```
JWT_SECRET=<强随机密钥,由 python3 -c "import secrets; print(secrets.token_urlsafe(48))" 生成>
DATABASE_URL=postgresql://postgres.efnnpyrauoxwpqjeqqvk:<数据库密码>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

⚠️ 如密码含 `#` → 写成 `%23`(URL 转义)。如含 `@ : / ? &` 也需类似转义。

### 4.5 Nginx 配置

站点文件: `/etc/nginx/sites-available/prismx`(已软链至 sites-enabled,原 default 已删除)

certbot 已自动添加 SSL 配置(自动重定向 HTTP → HTTPS,并处理 WebSocket 升级头)。

### 4.6 防火墙

两层:
- 腾讯云控制台安全组: 放行 TCP 22 / 80 / 443(来源 0.0.0.0/0)
- 服务器 ufw: OpenSSH + Nginx Full
- ⚠️ 部署时血的教训: 只放了 80 没放 443 → HTTPS 超时,必须两层都放

### 4.7 VPS 代码拉取流程(后续代码更新时在 VPS 执行)

```bash
su - ubuntu                                        # 如当前是 root,切回 ubuntu
cd ~/PRISMX-SIGNAL-LAB && git pull                 # 拉取最新代码
cd backend && source .venv/bin/activate && pip install -r requirements.txt  # 如有新依赖
sudo systemctl restart prismx                      # 重启后端
sleep 3 && curl -s https://api.prismxsignallab.com/  # 验证
```

### 4.8 已解决的 VPS 问题

1. **Supabase 直连 IPv6 不可达(Network is unreachable)** → 改用 Session pooler(`aws-1-...pooler.supabase.com`),走 IPv4。详见 [database.py](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/backend/app/core/database.py#L37-L69)
2. **腾讯云安全组 443 未放行** → 导致 HTTPS 连接超时,加上后正常
3. **频繁掉进 root 用户** → `su - ubuntu` 切回(ubuntu 是部署用户,代码在 `/home/ubuntu`,root 的家目录是 `/root` 没有代码)

## 五、前端部署(Vercel)复盘

### 5.1 Vercel 项目配置

- 仓库: `PRISMX-TD/PRISMX-SIGNAL-LAB`
- Framework Preset: **Vite**(不是多服务模式,只部署 frontend)
- Root Directory: **`frontend`**
- Build Command: `npm run build`(触发 `tsc -b && vite build`)
- Output Directory: `dist`
- Install Command: `npm install`

### 5.2 环境变量

| 名称 | 值 | 说明 |
|------|-----|------|
| `VITE_API_BASE` | `https://api.prismxsignallab.com` | Vite 只暴露 `VITE_` 开头的变量,前端用它拼接 API 和 WebSocket 地址 |

⚠️ 如以后 Vercel 预览部署也需要连后端,环境变量要勾选 `Preview` 环境(默认只 Production 生效)。

### 5.3 已解决的前端构建问题

1. **TS2339: Property 'env' does not exist on type 'ImportMeta'**
   - 原因: 用了 `import.meta.env.VITE_API_BASE` 但缺少 Vite 的类型声明
   - 修复: 创建 [vite-env.d.ts](file:///c:/Users/REX/Downloads/PRISMX%20SIGNAL/frontend/src/vite-env.d.ts),带 `/// <reference types="vite/client" />`
   - tsconfig.json 的 `include: ["src"]` 会自动包含它

2. **CORS 拦截(No 'Access-Control-Allow-Origin' header)**
   - 原因: 后端只放行了正式域名,没放 `*.vercel.app`
   - 修复: 加 `CORS_ORIGIN_REGEX`(见上文 三.3),然后 VPS 上 `git pull` + `sudo systemctl restart prismx`

### 5.4 部署流程

1. Vercel 自动检测 GitHub push → 触发构建
2. 构建成功 → 自动部署到 `prismx-signal-lab.vercel.app`
3. 每次 push 新代码,Vercel 自动重新部署(Production 环境)
4. ⚠️ 如 Preview 部署报 CORS 错: Preview 生成不同子域(`xxx-git-xxx.vercel.app`),但 CORS 正则 `.*\.vercel\.app` 已覆盖所有,应正常

## 六、Bridge 打包与分发

### 6.1 打包命令

```bash
python -m pip install pyinstaller psutil MetaTrader5 "numpy<2"
python -m PyInstaller --clean --noconsole --onefile \
    --name PRISMX-Bridge \
    --collect-all MetaTrader5 --collect-all numpy \
    bridge_app.py
```

产物: `dist/PRISMX-Bridge.exe`(约 33MB,含 numpy + MT5 库)

⚠️ 注意:
- **必须 `numpy < 2`** — MetaTrader5 库不兼容 numpy 2.x,报错 `numpy._core.multiarray failed to import`
- **必须 `--collect-all`** — 否则 PyInstaller 可能遗漏 numpy 的二进制文件

### 6.2 当前 exe 位置

`c:\Users\REX\Downloads\PRISMX SIGNAL\bridge\dist\PRISMX-Bridge.exe`(2026-06-29 11:16 生成,33MB)

### 6.3 用户使用说明

- 用户只需: 1) 打开 exe, 2) 填入 API Token(网站绑定页面获取), 3) 点连接
- 后端地址已内置(`https://api.prismxsignallab.com`),无需用户手动填
- ⚠️ 用户电脑必须已安装并登录 MT5 终端(进程名 `terminal64.exe`)

### 6.4 已解决的 Bridge 问题

1. **numpy 版本冲突 → MT5 import 失败** → `numpy 2.x` 降级为 `1.26.4` + `--collect-all numpy` 重新打包
2. **MT4 被误当 MT5 → 卡死无响应** → `scan_terminals` 只匹配 `terminal64.exe`(MT5),排除 `terminal.exe`(MT4)
3. **初始化卡死** → `mt5.initialize(path=..., timeout=10000)` 加 10 秒超时兜底
4. **用户需手动填后端地址** → 改为 `DEFAULT_BACKEND` 写死 + 隐藏输入框

## 七、MT5 实盘链路验证

**已通过完整端到端验证:**

```
网站下单 → Vercel 前端 → api.prismxsignallab.com 后端
  → Supabase 落库(信号/订单)
  → WebSocket 推送指令
  → PRISMX Bridge(另一台 VPS)
  → MT5 terminal64.exe
  → 真实执行(错误码 #10027 "AutoTrading disabled by client" → 开启 Algo Trading 后成交)
```

错误码 **#10027** 是 MT5 客户端的"自动交易被禁用"提示,不是系统问题。用户在 MT5 菜单 `Tools → Options → Expert Advisors → Allow Algo Trading` 开启即可。

## 八、未完成的待办(优先级排序)

### 8.1 高优先级

- [ ] **配正式域名** `prismxsignallab.com` → Vercel
  - Vercel 项目 → Settings → Domains → Add `prismxsignallab.com`
  - Namecheap: 删除现有的 URL Redirect Record(域名停放跳转),添加 CNAME 或 A 记录指向 Vercel
  - 同时添加 `www.prismxsignallab.com` 并设跳转到不带 www
  - Vercel 自动签发正式 HTTPS 证书
  - 后端 CORS 名单已有 `prismxsignallab.com`,域名配好后直接能用

### 8.2 中优先级

- [ ] **Bridge 下载分发** — 把 `dist/PRISMX-Bridge.exe`(33MB,最新版)放到用户可下载的位置,或网站提供下载入口
- [ ] **测试 EA 两个版本**(`PRISMX_EA_WS.mq5` / `PRISMX_EA_Poll.mq5`)在真实 MT5 环境运行,确认 WebSocket 和 HTTP 轮询都能正常工作
- [ ] **Bridge.exe 版本管理** — 后续 Bridge 源码改动后重新打包,文件大小应保持约 33MB(如果大幅变小说明 PyInstaller 没正确 `--collect-all`,会复现 numpy 问题)

### 8.3 低优先级

- [ ] `.gitignore` 已正确忽略 `dist/`、`build/`、`*.spec`、`.env`、`prismx.db` 等,定期检查别误传
- [ ] Supabase 数据库备份策略
- [ ] 监控告警(服务宕机通知)
- [ ] 多用户/高并发下的性能测试

### 8.4 后续功能开发(非部署)

- MT5 EA 自动交易链路完整联调(目前下单链路已通,EA 未正式跑)
- 多语言完善(i18n)
- 信号策略优化

## 九、接手指南(新 AI 接手后的第一步)

1. 确认 GitHub 仓库 `PRISMX-TD/PRISMX-SIGNAL-LAB` 最新提交是 `b621502`
2. 确认 VPS 可访问: `curl https://api.prismxsignallab.com/` 返回 JSON
3. 确认前端可访问: 打开 `prismx-signal-lab.vercel.app` 能注册登录
4. 想本地开发: `git clone` + 读 `.env.example` + 装依赖。如需连 Supabase,去 Supabase 后台拿连接串
5. 改后端代码后: 推 GitHub → VPS 上 `git pull` + `sudo systemctl restart prismx`(不会自动更新!)
6. 改前端代码后: 推 GitHub → Vercel 自动构建
7. 改 Bridge 代码后: 必须在本机**重新打包 exe** + 分发(见 六.1 打包命令)
