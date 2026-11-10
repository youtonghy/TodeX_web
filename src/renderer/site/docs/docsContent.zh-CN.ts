// Simplified Chinese docs content pack. Structure mirrors docsContent.en.ts:
// same slugs, same section keys — only title/description/body are translated.
import type { DocsLocalePack } from './docsContent';

const body = (markdown: string) => `${markdown.trim()}\n`;

export const zhCNDocs: DocsLocalePack = {
  sections: {
    'section-introduction': '介绍',
    'section-backend': '后端',
    'section-desktop': '桌面端',
    'section-mobile': '移动端',
  },
  pages: {

    // ------------------------------------------------------------- 介绍

    'introduction': {
      slug: 'introduction',
      title: '概览',
      description: 'TodeX 是什么、各部分如何协同工作，以及从哪里开始。',
      body: body(`
TodeX 是一个**可自托管的多智能体编程工作台**。一个 Rust 后端——
\`todex-agentd\`——将你已经在使用的编程智能体（Codex、
Claude Code、Pi、Devin、OpenCode、Grok Build、Antigravity、omp，以及任何兼容 ACP 的智能体）
统一编排到一个带认证的 API 之后。桌面端、Web 端和移动端客户端
通过加密通道连接到它。

没有任何流量会经过 TodeX 的基础设施中转：后端运行在你自己的机器或服务器上，
智能体使用你自己的账号与凭据运行，你的代码也绝不会离开你所授权的
工作区根目录。

## 组成部分

\`\`\`text
TodeX Desktop (Electron)          Todex Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 device auth + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, …)
\`\`\`

| 组件 | 说明 |
| --- | --- |
| **后端** | \`todex-agentd\`，负责管理对话、工作区、Provider 驱动与安全的守护进程。 |
| **桌面端** | Electron + React 19 客户端，提供三栏工作台。 |
| **Web 端** | 本站通过 HTTP 提供同款工作台——无需安装。 |
| **移动端** | 面向 iPhone 与 iPad 的原生 Swift + UIKit 客户端（开发中）。 |

## 亮点

- **不绑定智能体。**对话与 Provider 解耦；可以按线程切换智能体，
  也可以在同一个工作区中并行运行多个智能体。
- **持久化对话。**每个对话都是后端主机上的一个文件夹——包含清单、
  只追加的事件日志、快照以及 Provider 原生状态——因此轮次可以
  跨客户端重连和守护进程重启恢复。
- **Fail-closed 安全模型。**设备通过验证码完成注册，每个请求都带有
  Ed25519 签名，传输层还可升级为后量子 ML-KEM-768。
- **完整工作台。**流式对话与审批、嵌入式终端、Git 状态与差异、
  Skills/MCP 目录以及任务看板——桌面端与 Web 端完全一致。

## 接下来

| 目标 | 文档 |
| --- | --- |
| 了解 2.4 的变化，并观看实时演示 | [2.4 新功能](/docs/introduction/whats-new) |
| 十分钟内跑起来 | [快速开始](/docs/introduction/quick-start) |
| 了解术语 | [核心概念](/docs/introduction/concepts) |
| 运行后端 | [后端概览](/docs/backend) |
| 使用桌面应用 | [桌面端概览](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: "2.4 新功能",
      description: "隐私对话、从任意回复分叉、本机与容器后端、签名发布——附带可交互控制的实时演示。",
      body: body(`
TodeX 2.4.0（2026 年 11 月）同时发布了桌面端、后端和 Web 工作台。下面的演示
就是真实的工作台，运行在演示数据上：脚本会新建对话、发送任务，并展开工作过程，
让你看到智能体读取、修改代码并跑测试。可以在任意一步暂停细看，也可以从头播放。

:::demo

## 对话

- **隐私对话** — 从侧边栏新建（⌘⇧P / Ctrl Shift P，Web 端为 ⌥⇧P）。内容只保存在
  后端内存中：不写日志、不进历史缓存，守护进程重启后即消失。Claude Code、Codex
  和 Pi 完全不写会话文件；omp、OpenCode 和 DeepSeek Harness 把会话文件放在随对话
  一起删除的临时目录里（仅 Linux 和 macOS）。
- **从更早的回复分叉** — 每条回复下都有分叉按钮。新对话保留到这条回复为止的历史，
  工作区文件保持现状。Codex 和 Pi 可以从任意回复分叉，其他智能体只能从最新回复分叉。
- **目标** — \`/goal <目标>\` 给 Codex 设定原生目标。输入框上方的目标栏显示状态、
  Token 与耗时，并提供暂停、继续和清除。
- **压缩指令** — Pi 支持 \`/todex compact <指令>\`。
- **自动接受编辑** — Claude Code 的一种权限模式：文件修改自动通过，命令仍会询问。
- **后台任务** — 智能体等待后台任务时，输入框和侧边栏行会持续显示为运行中。

## 侧边栏与个人主页

- **统一布局**（设置 → 外观 → 侧边栏布局）把每个工作区的对话收在它下面。
- 工作区和分组可以加**标签**，**按标签分组**会按标签把列表分成几段。
- “None”改名为**无工作区**。
- **个人主页**取代了用量和额度弹窗——点击侧边栏底部的身份卡片即可打开。

## 设置

- **CLI 管理**移入设置，每个智能体 CLI 一个页面，并提供**全部更新**。
- **配置同步**把 CLI 账户、设置、MCP、Skill 和 SSH 连接从一个后端复制到另一个，
  两边并排实时显示。
- **历史缓存**（桌面端）让最近看过的对话先从本机打开；只保存加密后的内容。
- **Computer Use 引擎** — 内置，或实验性的 agent-desktop。

详见[设置](/docs/desktop/settings)。

## 后端与容器

- **本机 Backend** — 桌面端可以部署并运行本机的 \`todex-agentd\`，通过本地 IPC
  连接，无需开放网络端口。详见[本机 Backend](/docs/desktop/local-backend)。
- **TodeX 容器** — 在 Docker 中运行后端并创建容器工作区，支持空闲冻结和初始化命令。
  详见[容器](/docs/desktop/containers)。
- 新增支持 **omp（oh-my-pi）** 智能体。

## 安全

- 安装脚本、后端自更新和桌面端更新只安装 \`SHA256SUMS.sig\` 能用发布密钥验证的版本。
- 后端只响应来自桌面应用、回环页面和你列出的来源的跨域请求，并把经过代理的请求
  视为远程请求。详见[安全与配对](/docs/backend/security)。
- 隐私过滤器能识别多个国家/地区的证件号和电话号码，并新增激进选项；展示给你的
  SSH 输出会把被过滤的值盖在可刮开的涂层下。
- 终端主机列表新增 **本机** 主机，打开 \`ssh localhost\`。
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: '快速开始',
      description: '安装后端、配对客户端，并开始你的第一个智能体对话。',
      body: body(`
你需要一台能运行后端的机器，以及至少一个已完成登录的智能体 CLI
（\`codex\`、\`claude\`、\`pi\`、\`devin\`、\`opencode\`……）。

## 1. 安装后端

在 macOS、Linux 或 WSL 上——无需 Rust 工具链：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

该脚本会把 \`todex-agentd\` 安装到 \`~/.local/bin\`，校验发布版本的
校验和，并重启正在运行的受管守护进程。使用
\`install.sh install --version 2.0.2\` 可固定到某个版本，
也可以用 \`cargo build --release\` 从源码构建。

## 2. 启动并批准你的设备

\`\`\`bash
todex-agentd tui
\`\`\`

TUI 会显示守护进程状态、实时日志和配对工具。当客户端首次请求接入时，
按 \`d\` 显示验证码，与客户端核对后按 \`a\` 批准（或按 \`r\` 拒绝）。
退出 TUI 后，守护进程仍会在后台继续运行。

## 3. 连接客户端

- **桌面端**——从发布页安装软件包，打开设置，只需填入后端地址
  （默认 \`http://127.0.0.1:7345\`）。完成设备验证即可，验证过程
  会同时钉住后端的加密密钥。
- **Web 端**——在托管的 TodeX 站点上打开 \`/app\`，或打开你自己部署
  提供的页面，用同样的方式指向你的后端。

## 4. 创建工作区和对话

在已配置的工作区根目录下添加一个项目目录，
然后选择任意可用 Provider 开始对话。提示词、审批、终端和 Git 状态
都经由同一条连接实时传输。

## 故障排查

| 现象 | 检查 |
| --- | --- |
| 客户端连不上后端 | \`todex-agentd daemon status\`；默认端口为 7345 |
| 每个请求都返回 \`401\` | 设备未批准——在 TUI 中重新完成验证 |
| REST 正常但 WebSocket 失败 | 加密配置不匹配——在设置中重新配对设备 |
| 智能体显示不可用 | 主机上未安装或未登录对应的 Provider CLI |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: '核心概念',
      description: '每个 TodeX 界面背后的词汇：Provider、工作区、对话、设备。',
      body: body(`
## Provider 与 Provider 驱动

*Provider* 是后端可以驱动的智能体引擎——Codex、Claude Code、
Pi、Grok Build、Devin、OpenCode、Antigravity，或在 \`config.toml\` 中声明的
任意 ACP 2.0 profile。每个 Provider 都有原生驱动
（JSON-RPC app-server、stream-json、RPC 或 ACP stdio），因此
Skills、斜杠命令和模型目录等能力直接来自已安装的 CLI，
而不是近似模拟。

*Provider 账户*（cc-switch 模式）允许你为每个智能体保存多套
账号配置——TodeX 通过改写智能体自身的全局配置来激活其中一个，
因此在 TodeX 之外启动的会话行为完全一致。

## 工作区

*工作区*是位于已配置的*工作区根目录*
（\`TODEX_AGENTD_WORKSPACE_ROOT\`，默认 \`~/projects\`）下的一个项目目录。
智能体、终端和 Git 可以在已配置根目录内的任意工作区中运行。

## 对话

一个对话就是 \`$DATA_DIR/conversations/<uuid>/\` 下的一个文件夹：

| 文件 | 内容 |
| --- | --- |
| \`manifest.json\` | 元数据、当前 Provider 配置、所属工作区、时间戳 |
| \`events.jsonl\` | 只追加的事件日志——历史记录的事实来源 |
| \`snapshot.json\` | 用于快速重载的紧凑状态快照 |
| \`provider-state.json\` | 用于恢复轮次的原生引擎状态 |

轮次受乐观并发保护：一轮运行期间发起的第二个变更请求会返回
\`409 Conflict\`，而不是悄悄排队。

## 设备与配对

客户端不使用密码登录。每个客户端*设备*会生成一把 Ed25519 密钥并
请求注册；你只需在后端 TUI 中核对一次验证码即可完成批准。此后
每个 HTTP 请求都会携带设备签名，设备也可以单独吊销。

## 传输加密

| 模式 | 含义 |
| --- | --- |
| \`none\` | 明文（仅限回环部署） |
| \`x25519\` | X25519 + ChaCha20-Poly1305 |
| \`ml-kem-768\` | NIST 后量子算法 ML-KEM-768（配对默认） |

后端的加密密钥在设备配对时下发并校验：验证码覆盖了该密钥，
因此核对验证码的同时也完成了对密钥的认证。

## 租户

所有数据都按 \`tenant_id\` 做命名空间隔离；查询、日志和订阅
绝不会跨租户。
`),
    },

    // ------------------------------------------------------------------ 后端

    'backend': {
      slug: 'backend',
      title: '后端概览',
      description: 'todex-agentd——负责编排智能体、对话与安全的 Rust 守护进程。',
      body: body(`
\`todex-agentd\` 是 TodeX 的核心：一个基于 Tokio 与 Axum 构建的
单一 Rust 二进制文件，对外提供一个 REST 接口面（\`/v2/*\`）和
一条复用的 WebSocket（\`/v2/ws\`），用于事件流、审批和终端会话。

设置 \`[api] enabled = true\` 后，它还会为脚本和服务提供使用 API key 鉴权的
REST + SSE 接口，见[外部 API 与密钥](/docs/backend/external-api)。

## Provider 驱动

| Provider | 传输方式 | 说明 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`、\`turn\`、\`status\`、\`stop\`、\`attach\`、\`replay\`、\`interrupt\` |
| **Claude Code** | stream-json | 驱动 Claude CLI；内置模型别名，无需网关 |
| **Pi** | 原生 RPC | 命令发现、动态模型、交互式工具审批 |
| **Grok Build** | 受管 CLI | 带版本管理，与其他受管 CLI 一样可自更新 |
| **Antigravity** | stream-json | 驱动 \`agy\` 打印模式；写入 \`~/.gemini/config\` 的 TodeX PreToolUse hook 按工具审批（询问 / 完全访问）；自动模式在账号开通时使用 agy 自带的 Auto 审核（否则按询问处理）；并接入 TodeX 的 MCP 工具 |
| **ACP 2.0** | stdio profile | Devin（\`devin acp\`）、OpenCode（\`opencode acp\`）、omp（\`omp acp\`）、自定义 \`config.toml\` profile |

后端从不为了适配界面而改动 Provider 的安装：能力目录
（Skills、MCP 服务器、斜杠命令、模型）都是实时内省获得的，
并遵循项目优先于用户的优先级；Skills 通过 \`resourceId\`
注入到提示词中，而不是上传。

## 对话引擎

所有轮次状态都存放在对话文件夹中，以只追加事件的形式记录日志，
并配合快照与 Provider 原生状态。订阅可以从序号
（\`afterSequence\`）开始重放，因此客户端在重连后可以重新同步，
不会丢失消息。

## 一条连接，多路复用

\`/v2/ws\` 在单条连接上复用对话订阅、提示词分发、权限裁决、
PTY 终端会话和引擎控制——并带有心跳检测与 UTF-8 帧强制校验。

## 管理守护进程

\`todex-agentd\` 自带交互式 TUI（\`todex-agentd tui\`），可查看状态、
日志、批准设备并显示配对二维码；同时提供基于 PID 文件的守护进程模式
（\`daemon start|stop|restart|status\`）和登录自启动
（\`daemon autostart enable\`）。参见[安装与运行](/docs/backend/install)。
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: '安装与运行',
      description: '安装脚本、源码构建、运行模式与更新。',
      body: body(`
## 安装脚本（macOS / Linux / WSL）

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # install or update to the latest release
install.sh update                  # update an existing install
install.sh install --version 2.0.2 # pin a specific release
install.sh status                  # installed/latest versions and daemon state
install.sh uninstall               # stop the daemon and remove the binary
install.sh uninstall --purge       # also remove the ~/.todex-agent data dir
\`\`\`

脚本安装到 \`~/.local/bin\`（可用 \`--prefix\` 或
\`TODEX_INSTALL_DIR\` 覆盖），校验 \`SHA256SUMS\` 及其签名 \`SHA256SUMS.sig\`
（使用已安装的 \`todex-agentd\` 或 OpenSSL 3），保留一份回滚副本，
并重启正在运行的受管守护进程。无法校验签名时会拒绝安装，除非传入
\`--allow-unverified\`；2.3.6 及之前的版本没有签名，会给出警告并只校验摘要。
后端自带的更新程序同样只安装由发布密钥签名的版本。预编译的 Linux 二进制需要 glibc
2.28+；Alpine 等 musl 发行版必须从源码构建。WSL 会被自动识别。

固定的 \`--version\` 只有在 \`TODEX_AUTO_UPDATE=0\` 时才会保持——
否则 \`serve\`、\`tui\` 和 \`daemon start\` 会在启动时自更新；
运行中的守护进程会在所有智能体连续五分钟没有运行后，
重启进入新版本。

## 从源码构建

\`\`\`bash
cargo build --release
\`\`\`

需要 Rust 1.80+（MSRV）。产物为 \`todex-agentd\`。

## 运行模式

\`\`\`bash
# Interactive TUI — status, logs, device approval, pairing QR codes
todex-agentd tui

# Foreground server
todex-agentd serve --host 127.0.0.1 --port 7345

# Background daemon (PID file under the data dir)
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# Launch at login (launchd / systemd user service / registry Run key)
todex-agentd daemon autostart enable
\`\`\`

退出 TUI 后守护进程仍会继续运行。配对二维码只包含服务器地址，
以实心终端单元格渲染；当二维码超出终端宽度时，可在二维码弹窗中
按 \`b\`，在浏览器里打开一个正方形 SVG 版本。凭据弹窗显示的是
传输密钥指纹。

## 无界面管理

没有 TUI 时（在容器里或通过 SSH），同样的操作有对应命令：

\`\`\`bash
todex-agentd pair list                    # pending pairing requests
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>
todex-agentd providers install codex claude --if-missing
\`\`\`

退出码 2 表示没有匹配项；3 表示运行命令的用户与守护进程不同。桌面端也可以在
本机部署并管理后端——见[本机 Backend](/docs/desktop/local-backend)。
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '配置',
      description: 'config.toml、环境变量及其优先级。',
      body: body(`
## 优先级

1. 命令行参数
2. 环境变量
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`（默认 \`~/.todex-agent/config.toml\`）
4. 内置默认值

## 选项

| 选项 | CLI 参数 | 环境变量 | 默认值 |
| --- | --- | --- | --- |
| 主机 | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| 端口 | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| 数据目录 | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| 工作区根目录 | \`--workspace-root\`（可重复） | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| 默认智能体 | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex 二进制 | — | \`TODEX_AGENTD_CODEX_BIN\` | \`codex\` |
| Claude 二进制 | — | \`TODEX_AGENTD_CLAUDE_BIN\` | \`claude\` |
| Pi 二进制 | — | \`TODEX_AGENTD_PI_BIN\` | \`pi\` |
| 设备认证 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| 配对加密 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |
| 外部 API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | 关闭 / \`7346\` |
| 网络接口 | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| 本地 IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | 开启 / \`<data_dir>/agentd.sock\` |
| 允许的浏览器来源 | — | \`TODEX_AGENTD_CORS_ORIGINS\` | 无 |
| 受信任的代理 | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | 无 |
| 配对来源 | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | 无 |
| omp 二进制 | — | \`[agent]\` 中的 \`omp_bin\` | \`omp\` |

\`network_enabled = false\` 需要开启 IPC：此时后端只通过 IPC 套接字（Windows 上为
命名管道）为客户端服务，并保留一个随机回环端口供智能体工具和 \`/v2/version\` 使用。
容器部署还有自己的变量——见[容器](/docs/desktop/containers)。

## 示例 \`config.toml\`

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]
# Serve clients over local IPC only (needs [ipc] enabled).
# network_enabled = false

[ipc]
enabled = true
# path = "~/.todex-agent/agentd.sock"

[agent]
default_agent = "codex"
codex_bin = "codex"
claude_bin = "claude"
pi_bin = "pi"
# Stop a turn whose provider produces no output for this many minutes (0 disables).
provider_idle_timeout_minutes = 60

[agent.acp_profiles.default]
command = "mcp-server"
args = ["--stdio"]

[security]
enable_auth = true
enable_tls = false
# Browser origins allowed besides the desktop app and loopback pages.
# cors_origins = ["https://todex.example.com"]
# Proxies whose forwarded client address is trusted.
# trusted_proxies = ["10.0.0.2"]

[api]
enabled = false
host = "127.0.0.1"
port = 7346
\`\`\`

> **注意：**原生监听器有意禁止 \`enable_tls = true\`，以避免造成
> 虚假的安全预期。远程访问请在可信的反向代理（如 Nginx、Caddy
> 或 Cloudflare Tunnel）上终止 TLS。
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: '安全与配对',
      description: '设备验证、请求签名、工作区边界与传输加密。',
      body: body(`
TodeX 采用 fail-closed 设计：设备被显式批准之前，没有任何东西
能与后端通信；且每个请求都带有加密签名。

## 设备验证

每个客户端设备都会生成一对 Ed25519 密钥并请求注册。
整个流程需要人工核对：

1. 只需填入后端地址。客户端显示一个随机验证码和传输密钥指纹
   （\`XXXX-XXXX-XXXX-XXXX\`），然后等待。
2. 在后端 TUI 中按 \`d\` 打开设备面板，核对完整验证码；
   指纹显示在验证码旁边。
3. 按 \`a\` 批准或按 \`r\` 拒绝。已批准的设备会显示在同一面板中；
   按 \`x\` 吊销选中的设备。

批准后，每个 HTTP 请求都会携带设备签名——未授权的请求会被以
\`401 Unauthorized\` 拒绝。验证码基于包含传输协议与公钥的记录
计算，因此批准设备的同时也认证了后端的加密密钥：客户端会一步
钉住设备密钥、加密协议与公钥，然后建立连接。

## 传输加密

| 模式 | 套件 | 适用场景 |
| --- | --- | --- |
| \`none\` | 明文 | 仅限回环部署 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 常规远程访问 |
| \`ml-kem-768\` | NIST 后量子 ML-KEM | 配对默认 |

密钥只能通过设备配对下发，不支持自行导入。设置中会显示已钉住的
协议、密钥指纹与验证状态。未经配对验证就保存了密钥的档案，在任何
主机上（包括回环）都会被拒绝，直到重新配对。明文 \`none\` 仅限回环。

## 浏览器来源与代理

后端只响应来自桌面应用（\`todex-desktop://app\`）、回环页面以及
\`security.cors_origins\` 中精确列出的来源的跨域请求。带有 \`Forwarded\`、
\`X-Forwarded-For\` 或 \`X-Real-IP\` 的请求即使从回环地址到达也视为远程请求，
因此同一主机上的反向代理无法访问仅限回环的路径；把代理写进
\`security.trusted_proxies\` 后才会采用它转发的客户端地址。配对请求会显示其来源。

## 本地 IPC

IPC 套接字（Windows 上为命名管道）只接受运行守护进程的那个用户。通过它连接的
客户端不需要设备签名，并可使用本地管理 API。设置 \`network_enabled = false\`
后，IPC 是唯一的入口。见[本机 Backend](/docs/desktop/local-backend)。

## 签名发布

每个版本都会发布 \`SHA256SUMS.sig\`——对摘要文件的 Ed25519 签名。\`install.sh\`、
后端更新程序、桌面端的后端部署以及桌面端更新都会拒绝签名无法验证的版本。

## 隐私对话

隐私对话只保存在守护进程内存中：不写日志、不写密钥环、不计入历史存储，重启后即
消失。Claude Code、Codex 和 Pi 不写会话文件；omp、OpenCode 和 DeepSeek Harness
把会话文件写到临时目录（依次尝试 \`$XDG_RUNTIME_DIR/todex-private\`、\`/dev/shm\`、
系统临时目录），随对话一起删除，且仅支持 Linux 和 macOS。Grok Build、Devin、
Antigravity 和 ACP 配置不支持隐私对话。隐私对话不能分叉、定时、压缩，也不能被
其他对话引用。内存仍可能进入交换分区或核心转储，智能体的服务商按其自身政策处理
请求，对工作区文件的修改照常保留。

## 隐私过滤器

输出过滤器会把机密内容从智能体看到的输出中隐藏。它能识别证件号（中国大陆、香港、
台湾、美国 SSN、英国、新加坡、韩国、西班牙和巴西按校验位或格式识别；护照等其他
证件需紧邻名称词）和电话号码（国际格式及多个国家/地区的本地格式）。**激进选项**
默认关闭，还会覆盖 URL Token、高熵字符串、UUID、邮箱、电话号码和公网 IP；另外最多
可添加 32 个自定义键名。在智能体 SSH 输出视图中，被过滤的值盖在可刮开的涂层下。

## 工作区边界

\`workspace_roots\` 将所有文件与目录 API 限制在授权范围内——
客户端无法读取范围之外的内容。移除工作区会取消正在运行的轮次，
但不会删除它的对话。

## 隔离

- **租户**——所有查询、日志和订阅都按 \`tenant_id\` 限定作用域。
- **子进程**——智能体 CLI 在经过净化的环境中运行，
  管理类环境变量不会泄漏到 Provider 会话中。
- **TLS**——原生监听器拒绝 \`enable_tls\`；请在反向代理上
  终止 TLS，而不是依赖绕过手段。
- **API key**——[外部 API](/docs/backend/external-api) 的每把 key 只能访问
  自己的会话，以及 scope 内的 Agent 和 workspace。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API 参考',
      description: '/v2 REST 接口与复用的 /v2/ws WebSocket。',
      body: body(`
所有端点都位于 \`/v2\` 之下。每个请求都必须携带已注册的
设备签名；请求体与响应均为 JSON。

面向脚本和服务的 API key 调用使用单独的端口和 \`/api/v1\`，见
[外部 API 与密钥](/docs/backend/external-api)。

## 系统

| 端点 | 用途 |
| --- | --- |
| \`GET /health\` | 存活探针 |
| \`GET /v2/version\` | 守护进程版本、工作区根目录、能力列表 |

## 工作区

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/workspaces\` | 当前租户的缓存工作区列表 |
| \`PUT /v2/workspaces\` | 合并工作区缓存；返回规范化 ID |
| \`DELETE /v2/workspaces/{id}\` | 取消运行中的轮次并移除工作区（对话会被保留） |
| \`GET /v2/workspace/entries?workspace=&query=\` | 为 \`@\` 选择器提供文件/文件夹建议 |
| \`GET /v2/workspace/directories?path=\` | 目录树浏览 |
| \`GET /v2/workspace/file?path=\` | 读取沙箱根目录内的文件 |
| \`GET /v2/browser/fetch?url=\` | 代理拉取网页资源 |

## Providers

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/providers\` | Provider 列表及其启用状态 |
| \`GET /v2/providers/versions\` | 各智能体已安装与最新的 CLI 版本 |
| \`POST /v2/providers/{provider}/install\` | 安装缺失的受管 CLI（厂商官方脚本） |
| \`POST /v2/providers/{provider}/upgrade\` | 发起一次 single-flight 的 CLI 升级；进行中的智能体工作会阻塞它 |
| \`GET /v2/providers/upgrades/{operationId}\` | 异步安装/升级进度与校验后的版本 |
| \`GET /v2/providers/models?provider=&workspace=\` | Provider 的模型目录 |
| \`GET /v2/providers/commands?provider=&workspace=\` | 斜杠命令与扩展 |

Provider 账户位于 \`/v2/agent-providers/{agent}\` 之下，
\`GET .../export\` 与 \`POST .../import\` 以签名 JSON 文件的形式
在主机之间迁移配置。

## 对话

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/conversations\` | 当前租户已持久化的对话 |
| \`POST /v2/conversations\` | 使用某个 Provider 创建对话文件夹 |
| \`GET /v2/conversations/{id}\` | 清单与详情 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | 分页的事件日志；\`beforeSequence=N\` 向前翻页以惰性加载历史 |
| \`POST /v2/conversations/{id}/prompt\` | 发起一轮——文本、类型化内容、模型、思考强度、Skill 资源 ID |
| \`POST /v2/conversations/{id}/cancel\` | 取消正在运行的轮次 |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | 处理一次交互式审批 |

轮次运行期间的第二个变更请求会返回 \`409 Conflict\`——
轮次不会被悄悄排队。

## WebSocket — \`/v2/ws\`

一条连接上复用以下通道：

- \`conversation.subscribe\` ——实时事件日志，支持按序号续传
- 提示词分发与取消
- 权限裁决
- \`terminal.start\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.stop\` ——PTY 会话；\`terminal.attach\` 重新接入运行中的终端并回放最近输出
- 本地 Codex 引擎进程控制

帧强制 UTF-8 长度限制；心跳用于检测死连接。

权威契约以后端仓库中的 [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
为准。
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: '外部 API 与密钥',
      description: '使用后端管理的 API key，从脚本和服务通过 REST + SSE 调用 Agent。',
      body: body(`
除了设备端口（7345），\`todex-agentd\` 还可以在另一个端口提供 REST + SSE
接口，供脚本、CI 任务和其他服务调用。它使用**后端签发的 API key** 鉴权，
不需要设备配对，也不走 transport v2，可以调用 TodeX 已接入的所有 Agent。
它与 daemon 共用同一个会话引擎，但每把 key 只能看到自己的会话。

## 开启

外部 API **默认关闭**。可以在 \`config.toml\` 中设置 \`[api] enabled = true\`，
或使用 \`--enable-api\`、\`TODEX_AGENTD_API_ENABLED=true\` 开启；TUI 设置中也能
开关并修改端口（下次启动时生效）。

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # 仅限 TLS 反向代理之后
\`\`\`

API 端口必须与主端口不同。key 是 bearer 凭据，所以 \`api.host\` 不是回环
地址时，必须设置 \`allow_plaintext_remote = true\` 才能启动；远程使用请在
前面放 TLS 反向代理。外部 API 不提供 CORS，浏览器无法跨域调用。

## 签发与管理 key

key 的格式为 \`tdx_<id>_<secret>\`，只在创建时显示**一次**。后端只在
\`<data_dir>/api-keys.json\`（0600）中保存 secret 的哈希，单凭这个文件
既不能鉴权，也不能解密。

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

TUI 中有 **API Keys** 面板（\`i\`：\`n\` 新建，\`a\` 切换审批策略，连按两次
\`x\` 吊销）；已配对设备也可以调用 \`GET/POST /v2/api-keys\`、
\`PATCH/DELETE /v2/api-keys/{id}\`。修改无需重启 daemon 即可生效；被吊销或
过期的 key 会立即收到 \`401\`，其正在运行的 turn 会被取消。

每把 key 包含：

- **Agent**：允许使用的 Agent（默认全部）。
- **Workspace**：允许使用的绝对路径，包含子目录（默认全部 workspace 根目录）。
- **审批策略**：权限请求的处理方式，\`ask\`（默认，由调用方回答）、
  \`auto-approve\` 或 \`reject\`。绑定到特定设备的请求永远不会代 key 批准。
- **过期时间**：可选。

API 会话只使用 Agent 自身的工具，不注入 TodeX 的 SSH、桌面和浏览器工具；
turn 也不能覆盖权限模式或沙箱模式，由 key 的审批策略统一处理。

## 接口

请求 \`http://127.0.0.1:7346\` 时携带 \`Authorization: Bearer <key>\`
（或 \`X-API-Key\`）。

| 端点 | 用途 |
| --- | --- |
| \`GET /api/v1/health\` | 存活探测（无需 key） |
| \`GET /api/v1/me\` | 当前 key 及其 scope 与审批策略 |
| \`GET /api/v1/agents\` | key 可用的 Agent |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | 实时模型列表 |
| \`GET /api/v1/workspaces\` | key 可用的 workspace |
| \`POST /api/v1/conversations\` | 创建会话：\`{agent, workspace, title?}\` |
| \`GET /api/v1/conversations\` | 该 key 的会话列表 |
| \`GET / DELETE /api/v1/conversations/{id}\` | 查看或删除会话 |
| \`POST /api/v1/conversations/{id}/turns\` | 发起 turn：\`{text, model?, reasoningEffort?}\`；带 \`Accept: text/event-stream\` 时流式返回 |
| \`GET /api/v1/conversations/{id}/events?after=&limit=\` | 事件分页（明文） |
| \`GET /api/v1/conversations/{id}/events/stream\` | SSE：先历史后实时，支持 \`Last-Event-ID\` 续传 |
| \`POST /api/v1/conversations/{id}/cancel\` | 取消运行中的 turn |
| \`POST /api/v1/conversations/{id}/permissions/{permissionId}\` | 回答权限请求 |
| \`POST /api/v1/runs\` | 一次调用：新建会话并执行一个 turn，可流式或等待结果 |

SSE 事件包含 \`id: <sequence>\`、\`event: <type>\`，\`data\` 为事件 JSON；每
15 秒发送一次 \`: \` keepalive。错误格式与 \`/v2\` 相同，为
\`{"code", "message"}\`。

## 一次性调用

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"总结 README"}' \\
  http://127.0.0.1:7346/api/v1/runs
# {"conversationId":"…","turnId":"…","status":"completed","output":"…","error":null}

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"列出 TODO","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

不带 \`stream\` 时，请求会等待 turn 结束（\`timeoutSecs\` 默认 600，最大
3600；超时后取消该 turn 并返回 \`504\`）。

## 历史仍然加密

会话历史在磁盘上始终端到端加密。每把 key 由自己的 secret 派生一个专属的
历史接收方，只有该 key 自己的会话会封装给它。处理带这把 key 的请求时，
后端在内存中解密这些事件并返回明文，不保存任何由 key 派生的内容。即使
数据目录被盗也无法读取历史，某把 key 泄露也只会暴露它自己的会话。

权威接口说明见后端仓库
[docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
中的“外部 API（API Key）”一章。
`),
    },

    // ------------------------------------------------------------------ 桌面端

    'desktop': {
      slug: 'desktop',
      title: '桌面端概览',
      description: 'Electron 客户端——面向 macOS、Windows 与 Linux 的三栏工作台。',
      body: body(`
TodeX 桌面端是 \`todex-agentd\` 的原生客户端，基于 Electron 44、
React 19、Vite 7、Tailwind CSS v4 与 HeroUI Pro 构建。它与 Web
客户端共享 \`@todex/protocol\` 传输库，因此工作台完全一致——
桌面应用在此基础上提供原生集成。

## 三栏布局

- **左侧边栏**——工作区浏览器、带智能体徽标的对话历史、
  线程生命周期操作（新建、重命名、分叉、删除）以及快捷设置。
- **中间对话区**——带 Shiki 高亮与 KaTeX 数学渲染的流式
  Markdown 时间线、交互式审批卡片（命令、diff、工具调用），
  以及支持模型与思考强度选择器、\`@\` 引用菜单（文件、文件夹、对话、Skill、MCP）、\`/\` 斜杠命令、
  \`#\` Skill/MCP 建议和 Codex Fast 模式的输入框。
- **右侧工作台**——标签页抽屉：斜杠命令参考、实时 Git Diff、
  内嵌的 xterm.js PTY 终端、Skills/MCP 能力目录和实验功能。

## 桌面端独有功能

- [本机 Backend](/docs/desktop/local-backend)：部署并运行本机的后端，通过 IPC 连接。
- [容器](/docs/desktop/containers)：在 Docker 中运行后端并创建容器工作区。
- 最近看过的对话的本机历史缓存。
- 面向回环工作区的原生文件与目录选择器。
- Electron \`userData\` 持久化、经由 \`contextBridge\` 的安全 IPC
  （\`nodeIntegration: false\`），以及按构建划分的诊断日志。
- 连接诊断可区分后端不可达、URL 错误、认证失败、已弃用的
  \`/v1\` 端点以及 WebSocket 不匹配等情况。

## 发布

预编译包通过 GitHub Releases 发布：Windows NSIS（x64 + ARM64）、
macOS Apple Silicon DMG、Linux x64 AppImage，均附 SHA-256 校验和。
开发构建参见[安装与构建](/docs/desktop/setup)。
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: '安装与构建',
      description: '前置要求、开发模式与发布打包。',
      body: body(`
## 前置要求

- Node.js 22+、pnpm 11+
- 一个正在运行的 \`todex-agentd\` 后端（默认 \`http://127.0.0.1:7345\`）
- 用于安装依赖包的 HeroUI Pro 许可证令牌

## 安装

\`@heroui-pro/react\` 在安装时需要鉴权，请先导出令牌：

\`\`\`bash
export HEROUI_AUTH_TOKEN="your_heroui_key"   # or: export HEROUI_AUTH_TOKEN="$HEROUI_KEY"
pnpm install
pnpm run dev
\`\`\`

> **警告：**切勿将令牌提交到仓库。

如果 Electron 二进制下载中断，可用
\`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\` 修复。

## 脚本

| 命令 | 作用 |
| --- | --- |
| \`pnpm run dev\` | 先做 predev 检查，然后以 Vite 开发模式启动应用（1280×800 窗口） |
| \`pnpm run build\` | 构建 main、preload 与 renderer |
| \`pnpm run package\` | 使用 electron-builder 打包 |
| \`pnpm run preview\` | 预览生产构建 |
| \`pnpm run typecheck\` | 对 main 与 renderer 目标做类型检查 |
| \`pnpm run check:electron\` | 校验原生 Electron 二进制 |

## 发布

软件包由 **Release desktop packages** GitHub 工作流产出：
输入形如 \`1.2.3\` 的语义化版本号后，它会向该 release tag 发布
Windows NSIS（x64 + ARM64）、macOS Apple Silicon DMG、
Linux x64 AppImage 以及 SHA-256 校验和。开发构建版本号为
\`DEV0.0.0\`；该工作流需要 \`HEROUI_AUTH_TOKEN\`，以及——在协议仓库
仍为私有期间——\`PROTOCOL_REPO_TOKEN\` 这两个 Actions secrets。
macOS 发布需要签名，详见桌面端仓库中的
\`docs/automatic-updates.md\`。

## 开发日志

标记为 \`DEV0.0.0\` 的构建会把诊断信息写入
\`userData/logs/todex-desktop-debug.log\`（可用
\`TODEX_DESKTOP_LOG_PATH\` 覆盖）。日志覆盖窗口、IPC、HTTP、
WebSocket 及未捕获错误，令牌、Cookie、密钥与附件均已脱敏。
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: '连接后端',
      description: '配对流程、设备验证与连接诊断。',
      body: body(`
桌面应用同一时间只连接一个后端，通信走 REST + WebSocket；
每个请求都使用设备已注册的密钥签名。

## 配对方式

| 方式 | 说明 |
| --- | --- |
| **设备验证** | 填入后端地址；应用会显示验证码和传输密钥指纹——在后端 TUI 中批准（按 \`d\`，再按 \`a\`）后加密密钥即被钉住，应用随即连接。 |

设置中会显示已钉住的协议、密钥指纹与验证状态。使用**重新配对**
可再次进行验证；修改后端地址会清除已钉住的密钥。

对于同一台机器上的后端，桌面端可以跳过以上步骤，直接通过本地 IPC 连接——见
[本机 Backend](/docs/desktop/local-backend)。容器后端会显示批准本设备的
\`todexc\` / \`docker exec\` 命令——见[容器](/docs/desktop/containers)。

## 从客户端管理 Provider

**设置 → CLI 管理**列出后端上智能体 CLI 的已安装与最新版本，可安装缺失的 CLI，
并同时运行多个升级（见[设置](/docs/desktop/settings)）。**配置同步**可在两个后端
之间复制账户、设置、MCP、Skill 和 SSH 连接。Provider 账户可导出/导入为 JSON 文件，用于在主机之间
同步智能体凭据——文件内含明文密钥，请像对待机密一样保管。

## 诊断

| 状态 | 原因 | 处理 |
| --- | --- | --- |
| 后端不可达 | \`/v2/version\` 或 \`/health\` 失败 | 启动 \`todex-agentd\`；检查端口 |
| 后端 URL 无效 | URL 无法解析 | 使用 \`http://127.0.0.1:7345\` 形式 |
| 认证失败 | HTTP 401/403 | 重新进行设备验证 |
| 协议已弃用 | URL 路径包含 \`/v1\` | 切换到 \`/v2\` |
| WebSocket 失败 | REST 正常但 \`/v2/ws\` 失败 | 防火墙、令牌或加密不匹配——重新配对设备 |
| 智能体不可用 | Provider 显示 \`available = false\` | 在后端主机上安装/登录该智能体 CLI |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: '工作台',
      description: '侧边栏、对话面板、工作台标签页与键盘快捷键。',
      body: body(`
工作台在桌面端与 Web 端完全一致。本页使用桌面端术语；
Web 端有差异之处会单独注明。先看看它实际运行的样子——下面的演示是运行在演示数据上的
真实界面，由脚本自动操作：

:::demo

## 左侧边栏

上方是工作区，下方是对话；或者在**设置 → 外观 → 侧边栏布局**中选择**统一**，让每个
工作区下面直接列出它的对话（每页五条）。对话行会显示当前智能体徽标和运行状态，
智能体等待后台任务时也保持“运行中”；右键操作包括新建、重命名、分叉和删除。工作区
可从已配置工作区根目录下的任意目录添加，也可以建在[容器](/docs/desktop/containers)里。

- **标签** — 在工作区上**编辑标签**，或在分组上**编辑分组标签**。工作区标题栏上的
  标签按钮可开启**按标签分组**：每个标签一段，**未加标签**排在最后。
- **无工作区**（原“None”）存放不属于任何工作区的对话；有多个后端时，它们合成一个
  内置分组。
- **隐私对话** — **新建隐私对话**（⌘⇧P / Ctrl Shift P）选择智能体后开始一段只保存在
  后端内存中的对话，带有徽标和提示。见[安全与配对](/docs/backend/security)。
- **个人主页** — 点击底部的身份卡片打开个人主页：用量、套餐额度和活跃情况。

## 定时对话与可选功能

- **定时对话** — 从侧边栏（或看板任务）创建并选择时间。对话会立即创建；
  在其中发送的内容都会保存在后端队列里，到时间后按顺序发出。侧边栏行显示
  倒计时图标，输入框上方的栏提供“立即发送”“修改时间”“取消”。
- **功能**（设置 → 功能）— 定时对话、终端和看板任务板可分别在侧边栏中显示、
  折叠到“更多”下，或关闭（同时移除对应快捷键与菜单项）。按设备保存。
- **连接** — 后端仍在加载时，侧边栏显示“正在等待后端加载完成”，客户端最长
  会重试 2 分钟而不是直接失败。当前对话的智能体会被预热，首条消息启动更快。

## 中间——对话

- 流式 Markdown，Shiki 代码高亮与 KaTeX 数学渲染。
- 针对命令、文件 diff 和工具调用的审批卡片——在轮次运行期间
  就地处理。
- 输入框：\`@\` 打开引用菜单，先选类型再搜索具体内容：\`@file:\`、\`@folder:\`、
  \`@chat:\`（将工作区内其他对话导出为 Markdown 文件附加）、\`@skill:\` 与 \`@mcp:\`；\`/\` 运行 Provider 斜杠命令，
  \`#\` 引用 Skill 或 MCP 能力。模型选择器按名称大小写不敏感匹配，
  并带有可拖动的思考强度控件；Provider 支持时还可开启
  Codex Fast 模式。
- 推理过程与工具详情在展开时才懒加载挂载；最终回答与上下文和
  执行噪声保持隔离。
- 回复下方的**从这条回复分叉**会新建一个对话，保留到这里为止的历史（工作区文件不会
  回滚）。Codex 和 Pi 可从任意回复分叉，其他智能体只能从最新回复分叉。
- **\`/goal <目标>\`**（Codex）设定原生目标；输入框上方的目标栏显示状态与用量，并提供
  暂停、继续和清除。Pi 支持 \`/todex compact <指令>\`。
- 权限选择器为 Claude Code 提供**自动接受编辑**：文件修改自动通过，命令仍会询问。

## 右侧——工作台标签页

| 标签页 | 内容 |
| --- | --- |
| 斜杠命令 | Provider 命令参考 |
| Git Diff | 实时工作目录变更 |
| 终端 | 内嵌 xterm.js PTY（WebGL），断线与重载后恢复输出，支持查找、链接、Shell 集成和命令结束提醒 |
| 能力 | 已启用 Skills 与 MCP 服务器的只读目录 |
| 实验 | 功能开关与开发者诊断 |

## 键盘快捷键

| 按键 | 操作 |
| --- | --- |
| ⌘B / Ctrl B | 切换左侧边栏 |
| ⌘⌥B / Ctrl Alt B | 切换工作台侧栏 |
| ⇧⌘G / Ctrl Shift G | Git 操作 |
| ⌘N（Web 端为 ⌥N） | 新建对话 |
| ⇧⌘N（Web 端为 ⌥⇧N） | 添加工作区 |
| ⇧⌘P（Web 端为 ⌥⇧P） | 新建隐私对话 |
| ⌘L / Ctrl L | 快速搜索（对话及其内容） |
| ⌘1…⌘9 / Ctrl 1…9 | 切换工作台标签页 |
| ⇧⌘K / Ctrl Shift K | 看板任务面板 |
| ⇧⌘T（Web 端为 ⌥⇧T） | 终端视图（SSH 主机、密钥、远程文件） |

> 浏览器保留了 ⌘N / ⇧⌘N / ⇧⌘T，因此 Web 端这两个“新建”操作
> 和终端视图改用 Option 键。其余快捷键完全一致。

## 终端

在终端内（macOS 用 ⌘，Linux 与 Windows 用 Ctrl Shift）：

| 按键 | 操作 |
| --- | --- |
| ⌘C / Ctrl Shift C | 复制（有选中文本时 Ctrl C 也会复制） |
| ⌘V / Ctrl Shift V | 粘贴 |
| ⌘F / Ctrl Shift F | 查找 |
| ⌘K / Ctrl Shift K | 清屏 |
| ⌘↑ ⌘↓ / Ctrl Shift ↑ ↓ | 上一个 / 下一个提示符 |

右键菜单提供同样的操作。Ctrl/⌘ 点击可打开链接，以及工作区内文件的
\`路径:行号\` 引用。向未开启 bracketed paste 的程序粘贴多行内容时会先确认。

**Shell 集成**（设置 → 外观 → 终端，默认开启）会为新开的 bash、zsh、
fish 终端加载一小段脚本：标记每个提示符（失败的命令显示为红色）、
让路径框跟随 shell 的当前目录、关闭仍有命令运行的标签前先确认，
并在不可见时结束的 10 秒以上命令发出提醒。程序也可以通过
OSC 9 / OSC 777 发送提醒。

**图片。** 剪贴板里没有文字时粘贴图片，或把图片文件拖到终端上：TodeX 把图片
存到终端运行的机器上（后端所在机器，或 SSH 主机的 \`~/.cache/todex/paste\`），
再粘贴它的路径，Claude Code 和 Codex 会把它作为图片附加。粘贴的图片 7 天后
清理。Ctrl V 仍然发送给程序。

**重新连接。** 离开时终端照常运行。应用重连或重载后从断开处继续；若那段输出
已不再保留，后端会发送当前屏幕，vim、Claude Code 等全屏程序保持原样。

短暂按住修饰键，界面上会显示快捷键提示徽标。
`),
    },

    // ------------------------------------------------------------------- 移动端

    'desktop/settings': {
      slug: 'desktop/settings',
      title: "设置",
      description: "CLI 管理、后端之间的配置同步、本机历史缓存与 Computer Use 引擎。",
      body: body(`
设置页左侧是分组导航。本页介绍 2.4 中有变化的部分；后端相关的内容另有专页
（[本机 Backend](/docs/desktop/local-backend)、[容器](/docs/desktop/containers)）。

## CLI 管理

**设置 → CLI 管理**列出后端上的智能体 CLI（Codex、Claude Code、Pi、Grok Build、
omp 以及 ACP 配置）的已安装与最新版本。可以同时安装或升级多个 CLI，**全部更新**
会执行所有待升级项。随容器镜像提供的 CLI 显示为“随镜像更新”。

每个 CLI 有自己的页面，包含以下标签页：

| 标签页 | 内容 |
| --- | --- |
| 设置 | CLI 自身的设置和 Provider 配置 |
| MCP / Skill | 所选后端上的 MCP 服务器和 Skill |
| 账户 | Provider 账户与 API Key |
| 清理 | 该 CLI 在后端上的原生会话 |
| 插件 | omp 插件：安装、升级、删除、启用或停用 |

列表顶部的**共享 MCP / Skill**管理所有智能体都能看到的那部分。启用或删除 Provider
配置前会先确认，并说明 CLI 全局配置中会改变什么；Claude Code 的配置会在首次启用前
备份。Codex 账户表单可以从 Base URL 拉取模型列表，设置思考强度和上下文窗口预设——
清空某个字段即会从 \`config.toml\` 中删除对应的键。

## 配置同步

**设置 → 后端连接 → 配置同步**把两个后端并排实时显示：**源后端**（从这里读取）和
**目标后端**（写入这里）。选择要复制的内容：

- CLI 账户
- 设置
- MCP 服务器
- Skill
- SSH 连接

只写入新增和变化的项，不会删除目标上的任何内容。界面上的密钥会被遮蔽。使用密码
登录的 SSH 主机和私钥永远不会同步——请先把私钥放到目标机器上。

## 存储与历史缓存

**设置 → 通用 → 存储**中有**在本机缓存最近对话**（桌面端，默认开启）。最近看过的
对话会先从本机打开，再从后端补齐，断开连接时也能阅读。

- 只保存后端发来的加密内容，从不保存明文。
- 最多 100 个对话、每个最新 300 条事件、总计 200 MB；超出时先淘汰最久未用的。
- 删除对话会同时清掉它的缓存；吊销设备或移除后端会清掉整个缓存。
- **清空缓存**只删除本机的副本。

隐私对话永远不会被缓存。Web 客户端没有历史缓存。

## Computer Use 引擎

Computer Use 页面新增**引擎**选项：**内置**，或 **agent-desktop（实验）**——后者在
首次使用时由后端下载，状态显示为就绪、下载中、安装失败或未安装。

## 外观

**侧边栏布局**可在**分开**（工作区和对话各占一栏，默认）与**统一**（对话收在所属
工作区下）之间切换。终端的 Shell 集成也在这里设置。
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: "本机 Backend",
      description: "在桌面端部署本机的后端，并通过本地 IPC 连接。",
      body: body(`
桌面端可以在它所在的机器上运行 \`todex-agentd\`，并通过**本地 IPC** 与之通信——
Unix 套接字（Windows 上为命名管道），只有你的用户账户能打开。这条连接不需要网络
端口，也不需要设备验证。

## 部署并连接

打开**设置 → 本机 Backend**。**本机**卡片会运行与 TodeX Desktop 同版本的
\`todex-agentd\`：

1. **部署并连接**会下载后端、校验签名、启动它、为本应用配对并通过 IPC 连接。
2. 之后卡片提供**启动并连接**、**重启**、**停止**、**重新配对**和**查看日志**。

桌面端只安装 \`SHA256SUMS.sig\` 能用发布密钥验证的后端版本。较早的未签名版本（2.3.6
及之前）只有在恰好是本应用配对的版本时才会被接受。

启动选项有**登录时自动启动**和**退出 TodeX 时停止**（默认关闭，这样后端仍能为其他
设备服务）。监听部分可设置监听地址（默认 \`127.0.0.1\`）、端口和配对加密方式。

同一页面还可以编辑工作区根目录，显示远程访问用的配对二维码和传输密钥指纹，批准或
拒绝配对请求，吊销设备，以及重置后端。

## 把现有连接切换到 IPC

如果某个回环连接（\`http://127.0.0.1:7345\`）指向的后端同时提供 IPC，应用会提示
**切换到 IPC**。IPC 接管该守护进程后，对应的 TCP 配置会被停用，数据迁移到 IPC
配置。可以用**提醒切换到 IPC 连接**关闭这个提示。

## 关闭网络接口

如果只有本应用使用这个后端，可以关闭**网络接口**。只有在应用通过 IPC 连接时才能
关闭，关闭前会确认，重启后生效。之后后端只保留一个随机回环端口，供智能体工具和
\`/v2/version\` 使用。后端 TUI 里对应的开关是 \`b\`；\`config.toml\` 中是
\`network_enabled = false\`（见[配置](/docs/backend/configuration)）。

## 本地管理 API

后端只在 IPC 上提供 \`/v2/local-admin/*\`——状态、配置、配对请求、设备和重置——
且不需要设备签名，因为套接字本身已经证明调用方是同一用户。通过 TCP 访问这些路由会
返回 404。
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: "容器",
      description: "在 Docker 中运行后端、创建容器工作区，并让容器保持整洁。",
      body: body(`
TodeX 容器是预装了 \`todex-agentd\` 和各智能体 CLI 的 Docker 镜像。每个容器都是一个
独立的后端：智能体在容器里运行，项目目录挂载进去。

## 前提

运行 TodeX Desktop 的机器上需要 Docker 和 Compose v2。**设置 → TodeX Container**
会检查这两者，列出镜像标签和所有 TodeX 容器，并提供启动、停止、重启、升级、挂载、
日志和删除操作。删除时默认保留容器的 home 卷，除非勾选。该页面与命令行工具
\`todexc\` 共用 \`~/.config/todex-container/<name>/\` 目录结构。

## 容器工作区

**新建工作区**时可以选择**本地工作区**或**容器工作区**。对于容器工作区，TodeX 会
挂载目录——Linux 和 macOS 上挂到相同路径，Windows 上挂到 \`/workspace/<目录名>\`——
与容器内的后端配对、安装智能体 CLI，并提议把你的智能体配置同步进去（见
[配置同步](/docs/desktop/settings)）。

容器后端会报告 \`deployment: container\`：

- 配对时会显示批准本设备的 \`todexc\` / \`docker exec\` 命令。
- 镜像自带的 CLI 显示“随镜像更新”，请通过升级镜像来更新它们。
- 路径映射在主机路径和容器路径之间转换，因此**在本地选择**和**打开**对容器内的
  文件同样可用。

## 初始化命令

容器工作区可以运行一次初始化命令：以 \`todex\` 用户身份、在工作区路径下、通过
\`bash -c\` 执行，遇到第一个失败即停止。会为 pnpm、npm、yarn、uv、
\`requirements.txt\` 和 git 子模块推荐模板。耗时较长的初始化可以转到后台继续。

## 空闲冻结

**空闲时自动冻结**（默认关闭）会在容器空闲 15 分钟到 4 小时（可设置）后将其暂停
（\`docker pause\`）。发送消息、打开终端或打开它的工作区都会让它恢复；容器卡片上
也有**冻结**和**恢复**按钮。

## 自动清理

清理在启动一分钟后运行，此后每 6 小时一次：

- 删除旧镜像；
- 删除已停止 1、7 或 30 天的容器（或从不）；
- 卸载没有工作区使用的目录；
- 退出 TodeX 时停止容器。

home 卷永远不会被自动删除。

## 容器相关的后端设置

| 设置 | 作用 |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | 关闭自更新；\`update\` 不做任何改动并以 0 退出 |
| \`TODEX_AGENTD_ADVERTISE_URL\` | 后端向客户端公布的地址 |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | 由镜像管理的 CLI；安装它们会返回 409 |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | 主机 ↔ 容器路径映射（\`[[workspace.path_mappings]]\`） |

无界面的容器可以用 \`todex-agentd pair list|approve|reject\`、\`devices list|revoke\` 和
\`providers install <id>…\` 管理（见[安装与运行](/docs/backend/install)）。
`),
    },

    'mobile': {
      slug: 'mobile',
      title: '移动端',
      description: '原生 iPhone 与 iPad 客户端——即将推出。',
      body: body(`
> **即将推出。**移动端客户端正在积极开发中；本页用于追踪
> 规划中的功能，首个 beta 发布后将被完整文档取代。

Todex Mobile 是面向 iPhone 与 iPad 的原生 Swift + UIKit 应用，
与同一个 \`todex-agentd\` 后端配对——同样的工作区、对话、
审批与终端会话，尽在口袋之中。

## 规划功能

- **相机配对**——扫描后端二维码以填入其地址，然后按与桌面端相同的
  流程完成设备验证。
- **对话 + 控制台**——宽屏下为双栏布局：一侧是对话时间线，
  另一侧是包含终端、文件、浏览器预览与 Git 的工作台。
- **完整的轮次控制**——审批、计划模式反馈、模型与思考强度
  选择器、消息排队，以及你离开时对话完成后的本地通知。
- **相同的安全模型**——Ed25519 设备签名与 X25519 /
  ML-KEM-768 传输加密，令牌保存在 iOS Keychain 中。

## 现阶段

[Web 客户端](/docs/introduction/quick-start)已可在移动浏览器中
连接可访问的后端使用——工作台 UI 完全一致，只是没有原生外壳。
后端配对详情参见[安全与配对](/docs/backend/security)。
`),
    },
  },
};
