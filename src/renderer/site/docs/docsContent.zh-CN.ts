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
Claude Code、Pi、Devin、OpenCode、Grok Build，以及任何兼容 ACP 的智能体）
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
| 十分钟内跑起来 | [快速开始](/docs/introduction/quick-start) |
| 了解术语 | [核心概念](/docs/introduction/concepts) |
| 运行后端 | [后端概览](/docs/backend) |
| 使用桌面应用 | [桌面端概览](/docs/desktop) |
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

- **桌面端**——从发布页安装软件包，打开设置，填入后端地址
  （默认 \`http://127.0.0.1:7345\`）。完成设备验证后，如果启用了
  后量子加密，再通过二维码或配对 JSON 导入加密公钥。
- **Web 端**——在托管的 TodeX 站点上打开 \`/app\`，或打开你自己部署
  提供的页面，用同样的方式指向你的后端。

## 4. 创建工作区和对话

在已配置的工作区根目录下添加一个项目目录，将其标记为信任，
然后选择任意可用 Provider 开始对话。提示词、审批、终端和 Git 状态
都经由同一条连接实时传输。

## 故障排查

| 现象 | 检查 |
| --- | --- |
| 客户端连不上后端 | \`todex-agentd daemon status\`；默认端口为 7345 |
| 每个请求都返回 \`401\` | 设备未批准——在 TUI 中重新完成验证 |
| REST 正常但 WebSocket 失败 | 加密配置不匹配——导入后端的公钥 |
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
Pi、Grok Build、Devin、OpenCode，或在 \`config.toml\` 中声明的
任意 ACP 2.0 profile。每个 Provider 都有原生驱动
（JSON-RPC app-server、stream-json、RPC 或 ACP stdio），因此
Skills、斜杠命令和模型目录等能力直接来自已安装的 CLI，
而不是近似模拟。

*Provider 账户*（cc-switch 模式）允许你为每个智能体保存多套
账号配置——TodeX 通过改写智能体自身的全局配置来激活其中一个，
因此在 TodeX 之外启动的会话行为完全一致。

## 工作区与信任

*工作区*是位于已配置的*工作区根目录*
（\`TODEX_AGENTD_WORKSPACE_ROOT\`，默认 \`~/projects\`）下的一个项目目录。
新工作区默认不受信任：信任它是一个显式的、按所有者维度的决定，
用于控制智能体可以在其中执行什么。撤销信任会取消该工作区
正在运行的轮次。

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

加密密钥通过配对二维码或 JSON 配对内容交换——与设备批准相互独立。

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

## Provider 驱动

| Provider | 传输方式 | 说明 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`、\`turn\`、\`status\`、\`stop\`、\`attach\`、\`replay\`、\`interrupt\` |
| **Claude Code** | stream-json | 驱动 Claude CLI；内置模型别名，无需网关 |
| **Pi** | 原生 RPC | 命令发现、动态模型、交互式工具审批 |
| **Grok Build** | 受管 CLI | 带版本管理，与其他受管 CLI 一样可自更新 |
| **ACP 2.0** | stdio profile | Devin（\`devin acp\`）、OpenCode（\`opencode acp\`）、自定义 \`config.toml\` profile |

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
\`TODEX_INSTALL_DIR\` 覆盖），校验 \`SHA256SUMS\`，保留一份回滚副本，
并重启正在运行的受管守护进程。预编译的 Linux 二进制需要 glibc
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

退出 TUI 后守护进程仍会继续运行。配对二维码以实心终端单元格渲染；
当二维码超出终端宽度时，可在二维码弹窗中按 \`b\`，在浏览器里打开
一个正方形 SVG 版本。
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

## 示例 \`config.toml\`

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]

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

1. 客户端显示一个随机验证码并等待。
2. 在后端 TUI 中按 \`d\` 打开设备面板，核对完整验证码。
3. 按 \`a\` 批准或按 \`r\` 拒绝。已批准的设备会显示在同一面板中；
   按 \`x\` 吊销选中的设备。

批准后，每个 HTTP 请求都会携带设备签名——未授权的请求会被以
\`401 Unauthorized\` 拒绝。设备批准与传输加密相互独立：
加密公钥仍需通过二维码或手动方式导入。

## 传输加密

| 模式 | 套件 | 适用场景 |
| --- | --- | --- |
| \`none\` | 明文 | 仅限回环部署 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 常规远程访问 |
| \`ml-kem-768\` | NIST 后量子 ML-KEM | 配对默认 |

密钥通过配对二维码交换（包括以实心终端单元格渲染的多帧 ML-KEM
分段，或按 \`b\` 键在浏览器中渲染的 SVG），也可以通过导入
配对 JSON 内容完成。

## 工作区边界

\`workspace_roots\` 将所有文件与目录 API 限制在授权范围内——
客户端无法读取范围之外的内容。工作区信任按所有者维度生效，
新工作区默认不受信任；撤销信任会取消正在运行的轮次并移除
该工作区，但不会删除它的对话。

## 隔离

- **租户**——所有查询、日志和订阅都按 \`tenant_id\` 限定作用域。
- **子进程**——智能体 CLI 在经过净化的环境中运行，
  管理类环境变量不会泄漏到 Provider 会话中。
- **TLS**——原生监听器拒绝 \`enable_tls\`；请在反向代理上
  终止 TLS，而不是依赖绕过手段。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API 参考',
      description: '/v2 REST 接口与复用的 /v2/ws WebSocket。',
      body: body(`
所有端点都位于 \`/v2\` 之下。每个请求都必须携带已注册的
设备签名；请求体与响应均为 JSON。

## 系统

| 端点 | 用途 |
| --- | --- |
| \`GET /health\` | 存活探针 |
| \`GET /v2/version\` | 守护进程版本、工作区根目录、能力列表 |

## 工作区

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/workspaces\` | 当前租户的缓存工作区列表 |
| \`PUT /v2/workspaces\` | 合并工作区缓存；返回规范化 ID，并自动信任工作区边界内尚未决定的目录 |
| \`GET \\| PUT /v2/workspaces/{id}/trust\` | 读取或修改按所有者维度的执行信任（新工作区默认不受信任） |
| \`DELETE /v2/workspaces/{id}\` | 撤销信任、取消运行中的轮次并移除工作区（对话会被保留） |
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
- \`terminal.open\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.close\` ——PTY 会话
- 本地 Codex 引擎进程控制

帧强制 UTF-8 长度限制；心跳用于检测死连接。

权威契约以后端仓库中的 [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
为准。
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
  以及支持模型与思考强度选择器、\`@\` 文件提及、\`/\` 斜杠命令、
  \`#\` Skill/MCP 建议和 Codex Fast 模式的输入框。
- **右侧工作台**——标签页抽屉：斜杠命令参考、实时 Git Diff、
  内嵌的 xterm.js PTY 终端、Skills/MCP 能力目录和实验功能。

## 桌面端独有功能

- 面向回环工作区的原生文件与目录选择器。
- **拖拽配对**——把二维码截图拖到窗口上即可在本地解码（jsQR），
  也可以粘贴配对 JSON 或分段 ML-KEM 内容。
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
| **设备验证** | 使用主机/端口连接；应用会显示验证码——在后端 TUI 中批准（按 \`d\`，再按 \`a\`）后令牌即被保存。 |
| **拖拽二维码** | 把二维码截图或图片文件拖到窗口上；使用 jsQR 在本地解码。支持多帧 ML-KEM 分段。 |
| **粘贴配对 JSON** | 粘贴完整的配对内容，包括分段二维码文本。 |
| **手动** | 手动输入后端地址并导入加密公钥。 |

设备批准与加密是两个独立步骤——当配对加密为 \`x25519\` 或
\`ml-kem-768\` 时，设备获批后客户端仍需导入后端公钥
（二维码或手动导入）。

## 从客户端管理 Provider

配对面板会列出后端上 Codex、Pi、Claude Code、Grok Build 与
ACP 的 CLI 清单及已安装/最新版本，可一键安装缺失的 CLI 并启动
受管升级。Provider 账户可导出/导入为 JSON 文件，用于在主机之间
同步智能体凭据——文件内含明文密钥，请像对待机密一样保管。

## 诊断

| 状态 | 原因 | 处理 |
| --- | --- | --- |
| 后端不可达 | \`/v2/version\` 或 \`/health\` 失败 | 启动 \`todex-agentd\`；检查端口 |
| 后端 URL 无效 | URL 无法解析 | 使用 \`http://127.0.0.1:7345\` 形式 |
| 认证失败 | HTTP 401/403 | 重新进行设备验证 |
| 协议已弃用 | URL 路径包含 \`/v1\` | 切换到 \`/v2\` |
| WebSocket 失败 | REST 正常但 \`/v2/ws\` 失败 | 防火墙、令牌或加密不匹配——重新导入密钥 |
| 智能体不可用 | Provider 显示 \`available = false\` | 在后端主机上安装/登录该智能体 CLI |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: '工作台',
      description: '侧边栏、对话面板、工作台标签页与键盘快捷键。',
      body: body(`
工作台在桌面端与 Web 端完全一致。本页使用桌面端术语；
Web 端有差异之处会单独注明。

## 左侧边栏

上方是工作区，下方是对话。对话行会显示当前智能体徽标和运行状态；
右键操作包括新建、重命名、分叉和删除。工作区可从已配置工作区
根目录下的任意目录添加，并需要显式信任。

## 中间——对话

- 流式 Markdown，Shiki 代码高亮与 KaTeX 数学渲染。
- 针对命令、文件 diff 和工具调用的审批卡片——在轮次运行期间
  就地处理。
- 输入框：\`@\` 提及工作区文件，\`@chat:\` 将工作区内其他对话导出为
  Markdown 文件附加，\`/\` 运行 Provider 斜杠命令，
  \`#\` 引用 Skill 或 MCP 能力。模型选择器按名称大小写不敏感匹配，
  并带有可拖动的思考强度控件；Provider 支持时还可开启
  Codex Fast 模式。
- 推理过程与工具详情在展开时才懒加载挂载；最终回答与上下文和
  执行噪声保持隔离。

## 右侧——工作台标签页

| 标签页 | 内容 |
| --- | --- |
| 斜杠命令 | Provider 命令参考 |
| Git Diff | 实时工作目录变更 |
| 终端 | 内嵌 xterm.js PTY，支持直接键盘输入与自动尺寸调整 |
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
| ⇧⌘K / Ctrl Shift K | 看板任务面板 |

> 浏览器保留了 ⌘N / ⇧⌘N，因此 Web 端这两个“新建”操作
> 改用 Option 键。其余快捷键完全一致。

短暂按住修饰键，界面上会显示快捷键提示徽标。
`),
    },

    // ------------------------------------------------------------------- 移动端

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

- **相机配对**——扫描后端二维码（包括多帧 ML-KEM 分段），
  或导入配对 JSON；设备验证流程与桌面端一致。
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
