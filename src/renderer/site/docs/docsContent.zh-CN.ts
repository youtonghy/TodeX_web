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
\`todex-agentd\`——将你已经在使用的编程智能体（Codex、Claude Code、Pi、
Devin、OpenCode、Grok Build、Antigravity、DeepSeek Harness、omp，以及任何兼容 ACP 的智能体）
统一编排到一个带认证的 API 之后。桌面端、Web 端和移动端客户端通过加密通道连接上来。

没有任何流量会经过 TodeX 的基础设施中转：后端运行在你自己的机器或服务器上，
智能体使用你自己的账号与凭据执行任务，代码也绝不会离开你授权的工作区根目录。

## 组成部分

\`\`\`text
TodeX Desktop (Electron)          TodeX Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 设备签名 + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, dsh, agy, omp…)
\`\`\`

| 组件 | 说明 |
| --- | --- |
| **后端** | \`todex-agentd\`，负责管理对话、工作区、Provider 驱动、后端组与加密安全的守护进程。 |
| **桌面端** | Electron + React 19 客户端，提供可自定义首页、三栏工作台、本机 IPC 与容器集成。 |
| **Web 端** | 本站通过 HTTP 提供同款工作台——无需安装，支持直连或由自托管代理转发。 |
| **移动端** | 面向 iPhone 与 iPad 的原生 Swift + UIKit 客户端（积极开发中）。 |

## 核心特性

- **不绑定智能体。** 对话与 Provider 解耦；可以按线程切换智能体，也可以在同一工作区并行驱动多个智能体，甚至通过 \`todex_agents\` 让智能体互相调用。
- **后端组与端到端加密历史。** 多个后端与多台设备可组成去中心化的信任组——一次加入即可访问组内全部后端并自动获得加密历史权限；会话历史在磁盘上始终端到端加密（X-Wing），后端无私钥可读。
- **智能工作模式与计划审阅。** Claude Code 可配置双阶段工作流：先用计划模型调研并生成完整计划，批准后自动切换到执行模型并自动审批；执行中遇到需要重新规划的回合可自动切回计划阶段。
- **完整工作台。** 可自定义首页看板、带文件胶囊与思考点阵的时间线、输入框上方实时计划清单、Git Diff、内嵌 xterm.js 终端、Agent 浏览器（Chromium / Kitesurf）与 Computer Use 实时画面——桌面端与 Web 端体验一致。

## 接下来

| 目标 | 文档 |
| --- | --- |
| 查看 2.5 新功能，并观看工作台自动演示 | [2.5 新功能](/docs/introduction/whats-new) |
| 十分钟内跑起来 | [快速开始](/docs/introduction/quick-start) |
| 了解核心术语与架构设计 | [核心概念](/docs/introduction/concepts) |
| 安装与配置后端 | [后端概览](/docs/backend) |
| 使用工作台与桌面客户端 | [桌面端概览](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: '2.5 新功能',
      description: '后端组、智能工作模式、计划审阅与实时步骤清单、可自定义首页看板、Kitesurf 引擎与单窗口 Computer Use——每一项都附带可分步切换的工作台自动演示。',
      body: body(`
TodeX 2.5（2026 年 11 月）聚焦**多后端协同**与**代理工作流可控性**：把多台后端与设备放进同一个去中心化信任组，为 Claude Code 带来“先规划、批准后自动执行、按需再规划”的智能工作模式，同时全面升级了工作台的时间线、首页看板与桌面/浏览器自动化体验。

先看完整的自动操作演示——脚本会新建对话、输入任务、展示计划步骤与执行过程，并接收流式回复：

:::demo

## 后端组（Backend groups）

以前每台设备都要分别和每台后端做一次点对点配对，换了公网 IP 或加一台新手机时还要逐台重新配对、逐台授予历史加密权限。**后端组**（Mesh v1）把你的多个后端（节点）和多台客户端设备放进同一个去中心化信任组，无需任何中心服务器：

- **一次入组，全组互通。** 新设备通过扫描**邀请二维码**（\`邀请二维码\`）或粘贴邀请文本入组（邀请只携带后端地址，不含任何密钥）；组内**任意已有设备**核对验证码后点一下**批准**即可完成入组，后端不参与审批，且同一次批准会自动授予全组加密历史权限。
- **灵活添加后端。** 已经点对点配对过的后端可以直接就地加入组，保留原有对话与历史（历史密钥自动重封装给组密钥）；新后端只需填写地址和 24 小时一次性**加入码**（\`todex-agentd mesh join-code\`，未入组后端也会在启动日志中打印）。
- **本机 IPC 保持走本地、组链路作待命。** 当本机后端也加入组且当前正通过本地 IPC 连接时，所有数据与请求仍走低延迟的 IPC（列表标为**本机 · 数据走 IPC**），组网络连接保持待命以同步在线状态、组名单和审批入组请求；同一守护进程下的不同连接档案会自动互相授予历史访问权限。
- **在线状态、局域网信标与端到端加密中继。** 组内设备实时显示在线状态与最近在线时间；每个节点可配置**固定地址**，局域网内通过 UDP 21047 信标自动发现；当所有直连地址都不可达时，支持经组内其他节点用设备签名票据**中继转发**（界面标为**经 \`<节点>\` 中继**，内容依然端到端加密，直连恢复后自动切回）。
- **24 词组恢复密钥与点对点分离。** 创建组时生成一次性 24 词恢复密钥，全部设备丢失时仍可恢复组管理权与历史；点对点连接的后端留在**设置 → 后端连接**，组节点统一在**设置 → 后端组**管理。

:::demo mesh

详见[连接后端与后端组](/docs/desktop/connect)与[安全与配对](/docs/backend/security)。

## 智能工作模式与计划审阅

过去想用便宜或强推理模型先做只读调研、出计划，审阅通过后再换主力模型开自动审批执行，需要手动切工作模式、切模型、再切权限。**智能工作模式**（Smart work mode）把这套流程收进了 Claude Code 的一次连续工作流里：

- **两阶段配置（设置 → 智能工作模式）。** 按当前设备分别为**计划阶段**（模型、思考强度，以及每次规划时自动附带的**计划技能**，如 \`plan-gate\`）与**执行阶段**（模型与思考强度）做设定；执行阶段始终启用**自动审批**，无需逐条确认命令或改文件。
- **批准计划后轮次内无感交接（\`plan_handoff\`）。** 在输入框的工作模式菜单中选择**智能**。规划期间显示为**智能 · 计划中**；用户批准 \`ExitPlanMode\` 后，后端会在当前轮次内直接向活跃进程下发执行模型与自动审批模式，并在时间线插入一条轻量交接提示（\`已批准计划，已切换到 Opus · 自动审批执行\`），随即在**智能 · 执行中**继续完成编码。
- **执行中按需重新进入计划（\`plan_reentered\`）。** 如果 Claude 在执行过程中自主调用 \`EnterPlanMode\`，或者你在后续消息中主动附带了配置的计划技能，对话会自动切回计划阶段模型（\`Claude 重新进入计划，已切换到 … 规划\`），待新计划批准后再次交接回执行阶段。
- **独立计划行与「计划待批准」审阅卡片。** 过去 \`ExitPlanMode\` 只显示“允许调用 ExitPlanMode？”，计划正文藏在折叠的工具参数里；现在计划正文会作为独立的 Markdown **计划**行展示在时间线中，输入框上方弹出**计划待批准**审阅卡片，支持**批准计划**（智能模式下会注明即将切换到的执行模型）或填写反馈后点击**要求修改**，打回给 Claude 修订。

:::demo smart

:::demo smart-settings

## 计划步骤、执行摘要与后台任务

对话时间线与输入框上方状态栏在 2.5 中做了全栈对齐，重点减少信息噪声、让进度一眼看清：

- **输入框上方实时计划步骤栏（\`计划 1/3\`）。** 无论使用的是 Codex（\`turn/plan/updated\`）、Claude Code（\`TodoWrite\`）、Pi（\`@tintinweb/pi-tasks\` 的 \`TaskCreate\`/\`TaskUpdate\`/\`TaskList\`，且未完成任务跨轮次保留）还是任意 ACP 智能体，后端都会将计划规范化为统一的 \`plan.updated\` 快照，在输入框上方以可折叠清单展示每一步状态与说明。
- **Codex 告警、自动审查单行提示与 \`ultra\` 思考强度。** Codex 的配置、弃用与安全告警（\`provider_warning\`，同一轮次自动去重）以及 \`auto_review\` 审查结论各自以一行轻量提示呈现，详情与风险评估理由收进悬停提示中；Codex 思考强度选项新增 \`ultra\`。

:::demo plan-steps

- **动态思考点阵与按操作命名的执行过程。** 运行中的工具组开头显示 BoardUI 动态思考点阵与当前具体操作（如“正在读取 \`page.tsx\`”）；执行结束后自动汇总为操作计数标题（如“编辑 2 个文件 · 运行 1 条命令 · 读取 1 个文件”），展开每一步时以文件胶囊展示触及的文件，不再被原始工具名淹没。

:::demo execution-group

- **停止后台任务与可靠未读提醒。** Claude Code 回合结束但仍在等待后台命令或子代理时，输入框上方提供**停止后台任务**按钮（\`conversation.backgroundTasks.stop\`），后台任务在后续跟进回合中也会持续追踪；即便后台对话已释放内存中的时间线行，完成后仍保留未读红点，不会悄然消失。
- **权限与提问无硬超时限制、通知更清晰。** 所有交互式权限请求、\`AskUserQuestion\` 提问与计划审批取消 10 分钟强制过期限制，一直等待直到你响应或取消；系统通知会直接写出提问正文或等待授权的具体项目，并在处理后自动撤回。

:::demo background-tasks

## 首页看板、计划日历与侧边栏

- **可自定义布局的首页。** 客户端启动默认进入**首页**，集中呈现**正在运行**、**等待回复（等待授权）**、**今日对话**、**今日用量**、**分时用量**以及 Codex / Claude Code **套餐限额（5 小时 / 7 天窗口）**卡片。点击右上角**自定义布局**即可拖拽排序、拖动右下角调整尺寸、移除或重新添加卡片。

:::demo home

- **「计划」看板与日历视图。** 原侧边栏的“看板”升级为**计划**，除了看板视图外新增**日历**视图，按截止日期与定时计划排布任务。
- **侧边栏离线折叠与文件夹状态环。** 离线后端的工作区默认收起，翻到底部后可点击**显示未连接后端的工作区 (n)** 按原顺序展开；工作区分组文件夹图标会同步显示组内最紧急的状态环（正在运行 > 异常 > 未读）；打开首页、终端、计划或个人主页等独立页面时，不再错误高亮背后的工作区和对话。

:::demo offline-sidebar

## Agent 浏览器与 Computer Use

- **可选实时画面位置（设置 → Agent 桌面工具）。** 可以在**侧边栏**（默认，打开为右侧标签页）和**输入框上方**之间自由切换 Agent 浏览器与 Computer Use 的实时画面位置。
- **单窗口 / 跨桌面空间（Space）后台操控与 AI 光标。** Computer Use 观察单个应用或窗口时，通过 \`ScreenCaptureKit\` 只截取目标窗口自身（即使位于另一个 macOS 桌面空间或被其他窗口遮挡），操作只针对该窗口的控件元素，不抢占用户的鼠标指针；宿主机与实时画面上同步显示平滑移动的橙色 **AI 光标**标明最后操作位置；macOS 新增权限拖入引导浮窗、屏幕录制需重启后端提示、ad-hoc 签名失效检测以及宿主机控制胶囊的红色**停止**按钮。

:::demo computer-live

- **实验性 Kitesurf 引擎、无头 Chromium 与站点审核。** Agent 浏览器新增 Cloudflare 的无界面 **Kitesurf** 引擎（基于 \`workerd\`，按标签隔离上下文，无需桌面环境），无显示器的 Linux 服务器上 Chromium 也会自动改用 \`--headless\` 运行；打开本机以外的公网或局域网页面时弹出站点授权（允许本次 / 始终允许 / 拒绝），设置页可管理**已允许的站点**并切换**站点审核**模式（逐个审核 / 无需审核），同时持续拦截云元数据、链路本地地址与守护进程自身端口；页面崩溃或空白失败返回明确的 \`PAGE_FAILED\` 与控制台诊断。

:::demo agent-browser

## 符号链接技能与 Provider 更新

- **符号链接技能支持（\`链接\`）。** 技能目录顶层的符号链接（例如 \`~/.claude/skills/plan-gate -> ~/.codex/skills/plan-gate\`）会被识别并列入技能目录，带有只读**链接**徽标，可直接用于智能工作模式的计划技能或 \`@skill:\` 引用，防止误改源文件。

:::demo linked-skills

- **Antigravity 全面迁移至常驻 ACP 驱动。** 不再依赖打印模式与旧版 \`~/.gemini/config\` 全局钩子（后端会自动清理历史残留），每个对话运行常驻 \`agy acp\` 进程，原生走 ACP 权限审批、多模态图片与带超时的 TodeX MCP 工具。
- **Claude Code 动态模型目录与 512K 上下文预设。** Claude Code 模型列表与思考强度（含 \`ultracode\`）直接从 CLI 的 \`initialize\` 探测实时读取；自定义模型上下文预设新增精确的 **512K（\`524,288\` Token）** 选项。

## 2.4 核心基础回顾

2.5 构建在 2.4 奠定的能力之上：支持**隐私对话**（仅存后端内存，\`⌘⇧P\` / \`⌥⇧P\`）、**从任意回复分叉**、Codex **\`/goal\` 目标栏**、**本机 Backend（本地 IPC）**、**TodeX Docker 容器工作区**、**后端间配置同步**、**本机历史密文缓存**以及 \`SHA256SUMS.sig\` **签名发布校验**。
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: '快速开始',
      description: '安装后端、配对客户端或加入后端组，并在十分钟内发起第一个智能体对话。',
      body: body(`
你需要一台能够运行后端的机器，以及至少一个已完成登录认证的智能体 CLI
（\`codex\`、\`claude\`、\`pi\`、\`devin\`、\`opencode\`、\`dsh\`、\`omp\` 等）。如果你只需要在本机使用桌面客户端，也可以直接通过[本机 Backend](/docs/desktop/local-backend) 一键部署并走本地 IPC 连接。

## 1. 安装后端

在 macOS、Linux 或 WSL 上一行安装（无需 Rust 工具链）：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

脚本会自动校验 \`SHA256SUMS.sig\` 发布签名，将 \`todex-agentd\` 安装到 \`~/.local/bin\`，
并重启正在运行的受管守护进程。需要固定版本时使用 \`install.sh install --version 2.5.0\`，
或通过 \`cargo build --release\` 从源码构建。

## 2. 启动并核对设备配对

\`\`\`bash
todex-agentd tui
\`\`\`

TUI 会显示守护进程状态、实时日志、已配对设备与配对二维码。当客户端首次发起连接时，
按 \`d\` 打开设备面板，核对客户端显示的验证码与传输密钥指纹，然后按 \`a\` 批准（或按 \`r\` 拒绝）。
退出 TUI 时，守护进程仍会留在后台运行。

## 3. 连接客户端

- **桌面端**——从 GitHub Releases 下载安装包；连接本机后端可在**设置 → 本机 Backend** 一键部署并走 IPC，连接远程后端则在**设置 → 后端连接**输入后端地址并完成设备验证，验证过程会同时钉住后端的加密公钥。
- **Web 端**——打开托管站点或你自部署的 \`/app\`，按同样方式添加后端并完成设备验证。
- **多设备 / 多后端用户**——如果已有其他设备或后端，可在**设置 → 后端组**创建组并通过**邀请二维码**直接加入，无需每台新设备逐一在终端审批。详见[连接后端](/docs/desktop/connect)。

## 4. 添加工作区并开始对话

在已配置的工作区根目录（默认 \`~/projects\`）下添加项目目录，选择任意可用智能体（如 Codex、Claude Code、Pi）即可发送任务。提示词、工具审批、计划审阅、实时步骤清单、终端与 Git Diff 都会经由同一加密通道实时同步。

## 故障排查

| 现象 | 检查项 |
| --- | --- |
| 客户端连不上后端 | 运行 \`todex-agentd daemon status\`；默认端口为 \`7345\` |
| 所有请求都返回 \`401\` | 设备尚未批准或已被吊销——在 TUI \`d\` 面板重新核对批准，或在后端组检查名单状态 |
| REST 正常但 WebSocket 失败 | 加密状态或代理头不匹配——在设置页点击**重新配对** |
| 智能体显示不可用 | 后端主机未安装或未登录对应的 Provider CLI（可在**设置 → CLI 管理**查看状态） |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: '核心概念',
      description: '每个 TodeX 界面背后的关键概念：Provider、工作区、对话、设备与后端组、历史加密。',
      body: body(`
## Provider 与 Provider 驱动

*Provider* 是后端可以编排的智能体引擎——包括 **Codex**、**Claude Code**、**Pi**、**Grok Build**、**Devin**、**OpenCode**、**Antigravity**、**DeepSeek Harness（dsh）**、**omp（oh-my-pi）**，以及在 \`config.toml\` 中声明的任意 ACP 2.0 Profile。

每个 Provider 都通过原生驱动协议接入（Codex JSON-RPC app-server、Claude stream-json、Pi RPC、ACP stdio），因此模型目录、思考强度、斜杠命令、Skills 与 MCP 服务器都是从已安装 CLI 实时内省获得，而不是近似模拟。

*Provider 账户*允许你为同一智能体保存多套账户与网关配置。激活某个账户时，TodeX 会按提示备份并改写对应 CLI 自身的全局配置（或补丁层），因此你在 TodeX 之外直接启动该 CLI 时行为完全一致。

## 工作区

*工作区*是位于后端配置的*工作区根目录*（\`TODEX_AGENTD_WORKSPACE_ROOT\`，默认 \`~/projects\`）下的项目目录，也可以是运行在 Docker 中的[容器工作区](/docs/desktop/containers)。智能体、PTY 终端与 Git 操作均限定在已授权的工作区边界之内。

## 对话

每个持久化的对话都对应后端主机 \`$DATA_DIR/conversations/<uuid>/\` 下的一个文件夹（[隐私对话](/docs/backend/security#隐私对话)除外，它仅存在于守护进程内存中）：

| 文件 | 作用 |
| --- | --- |
| \`manifest.json\` | 会话元数据、当前 Provider 与 Profile、所属工作区、时间戳与密文标题 |
| \`events.jsonl\` | 只追加的事件日志（含 \`$enc\` 加密负载）——历史记录的唯一事实来源 |
| \`snapshot.json\` | 紧凑状态快照，加速重连与重启恢复 |
| \`provider-state.json\` | 用于恢复会话上下文的 Provider 原生状态 |

轮次受乐观并发控制保护：当一轮正在运行时再直接发变更请求会返回 \`409 Conflict\`，而用户在输入框发送的追问会进入后端队列并在本轮结束后自动续发。

## 设备、配对与后端组

TodeX 不使用账号密码登录：

- **点对点设备配对（Pairing v3）**：每台客户端设备生成一对 Ed25519 密钥并请求接入。经人工核对验证码后，客户端同时钉住设备密钥、传输协议与后端公钥，之后所有请求都携带设备签名。
- **后端组（Mesh v1）**：由客户端设备与多个后端节点通过签名名单链（\`todex.mesh.roster\`）构成的去中心化信任组。新设备经组内任意已有设备批准后，即可访问组内全部后端并自动获授历史访问权；离线设备或不受信节点无法越权访问。

## 传输加密与历史加密

TodeX 将“链路传输安全”与“磁盘静态历史机密性”分成两层保护：

| 层次 | 机制 | 说明 |
| --- | --- | --- |
| **传输加密** | \`ml-kem-768\`（默认）/ \`x25519\` / \`none\` | REST 经 \`POST /v2/sealed\` 加密封装，WebSocket 使用 \`tv=2\` 二进制加密帧；明文 \`none\` 仅允许在回环地址使用。 |
| **历史加密** | X-Wing 端到端加密（history v3） | 对话事件在落盘前就已针对各授权设备的历史公钥和 24 词恢复密钥加密，后端磁盘不保存任何可解密历史的私钥。 |

## 租户

所有工作区、对话、订阅与缓存均按 \`tenant_id\` 严格隔离，查询与事件流绝不会跨租户泄漏。
`),
    },

    // ------------------------------------------------------------------ 后端

    'backend': {
      slug: 'backend',
      title: '后端概览',
      description: 'todex-agentd——负责编排智能体、对话引擎、后端组与加密安全的 Rust 守护进程。',
      body: body(`
\`todex-agentd\` 是 TodeX 的核心引擎：一个基于 Tokio 与 Axum 构建的单一 Rust 二进制守护进程，对外提供认证 REST 接口（\`/v2/*\`）和一条多路复用的 WebSocket（\`/v2/ws\`），承载流式事件、交互式审批、PTY 终端与后端组通信。

启用 \`[api] enabled = true\` 后，它还会监听独立端口，为脚本、CI 和外部服务提供基于 API Key 的 REST + SSE 接口；详见[外部 API 与密钥](/docs/backend/external-api)。

## Provider 驱动

| Provider | 传输方式 | 说明 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | 支持 \`start\`、\`turn\`、\`status\`、\`stop\`、\`attach\`、\`replay\`、\`interrupt\`、任意回复分叉、\`/goal\`、\`provider_warning\` 与 \`auto_review\` |
| **Claude Code** | stream-json | 从 CLI \`initialize\` 实时发现模型目录；支持智能工作模式（\`afterPlan\` / \`replan\`）、独立计划审阅、后台任务停止与内置别名 |
| **Pi** | 原生 RPC | 命令与动态模型发现、交互式工具审批、\`/todex compact\`，以及 \`@tintinweb/pi-tasks\` 跨轮次计划追踪 |
| **Grok Build** | 常驻 ACP / 受管 CLI | 支持版本管理与一键更新、工具审批与提问转发 |
| **Antigravity** | 常驻 ACP（\`agy acp\`） | 每会话常驻进程，经 ACP 处理权限审批（自动模式在账号支持时使用 agy 自带 Auto 审核），接入 TodeX MCP 服务器并清理旧版全局钩子 |
| **DeepSeek Harness** | 常驻 ACP（\`dsh\`） | 支持全局补丁层管理、内置与第三方插件包开关、参数配置与自定义路由 |
| **ACP 2.0** | 常驻 / 按轮 stdio profile | 原生集成 Devin、OpenCode、omp（\`omp acp\`），以及 \`config.toml\` 中声明的自定义 ACP profile |

后端从不通过篡改 Provider 安装目录来适配界面：Skills、MCP 服务器、斜杠命令与模型目录均实时内省获取（遵循项目配置优先于用户配置），顶层符号链接技能（\`linked: true\`）以只读方式识别并通过 \`resourceId\` 引用注入。

## 对话引擎与统一计划流

- 所有轮次状态保存在对话文件夹的只追加日志（\`events.jsonl\`）与快照中，订阅通过 \`afterSequence\` 断点续传，客户端断线重连或守护进程重启后均可无损同步。
- **跨 Provider 计划规范化（\`plan.updated\`）**：无论 Codex（\`turn/plan/updated\`）、Claude Code（\`TodoWrite\`）、Pi（\`@tintinweb/pi-tasks\`）还是 ACP（\`session/update\` \`plan\`），后端都会在驱动边界统一转换为包含 \`steps: [{ text, status }]\` 与 \`explanation\` 的快照事件。
- **交互式审批无超时期限**：待处理的权限请求、提问卡片与计划审阅会持续等待直到用户处理、轮次取消或守护进程停止，避免用户离开一会儿回来请求已过期。

## 一条连接，多路复用

\`/v2/ws\` 在单条连接上复用对话订阅、提示词分发、权限裁决、后台任务停止、PTY 终端会话（支持断线后重连与屏幕快照恢复）、历史加密授权以及后端组（\`mesh.*\`）控制消息，并带有心跳检测与 UTF-8 帧长度限制。

## 管理守护进程

\`todex-agentd\` 自带交互式 TUI（\`todex-agentd tui\`），可实时查看状态、日志、批准设备配对、管理 API Key 与展示配对二维码；同时提供后台守护进程模式（\`daemon start|stop|restart|status\`）、登录自启动（\`daemon autostart enable\`）以及面向脚本和容器的无界面 CLI 子命令。详见[安装与运行](/docs/backend/install)。
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: '安装与运行',
      description: '安装脚本、源码构建、运行模式、无界面配对与后端组命令。',
      body: body(`
## 安装脚本（macOS / Linux / WSL）

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # 安装或更新到最新正式版本
install.sh update                  # 更新现有安装
install.sh install --version 2.5.0 # 固定安装指定版本
install.sh status                  # 查看已安装版本、最新版本与守护进程状态
install.sh uninstall               # 停止守护进程并移除二进制文件
install.sh uninstall --purge       # 同时删除 ~/.todex-agent 数据目录
\`\`\`

脚本将 \`todex-agentd\` 安装到 \`~/.local/bin\`（可通过 \`--prefix\` 或 \`TODEX_INSTALL_DIR\` 指定），校验 \`SHA256SUMS\` 及其 Ed25519 发布签名 \`SHA256SUMS.sig\`（使用已安装的 \`todex-agentd\` 或 OpenSSL 3），保留一份回滚副本，并平滑重启正在运行的受管守护进程。

若无法校验签名，安装器默认拒绝安装（除非显式传入 \`--allow-unverified\`）；2.3.6 及更早未签名版本会输出警告并退回摘要校验。后端自身的自动更新程序同样只安装签名验证通过的正式版本。预编译 Linux 二进制需要 glibc 2.28+；Alpine 等 musl 发行版需从源码构建。WSL 会被自动识别。

只有在设置了 \`TODEX_AUTO_UPDATE=0\` 时，固定的 \`--version\` 才不会被自动升级——否则 \`serve\`、\`tui\` 和 \`daemon start\` 会在启动时检查更新；运行中的守护进程会在连续 5 分钟没有任何智能体运行后自动重启进入新版本。

## 从源码构建

\`\`\`bash
cargo build --release
\`\`\`

需要 Rust 1.80+（MSRV）。产物为 \`todex-agentd\`。

## 运行模式

\`\`\`bash
# 交互式 TUI —— 状态、日志、设备批准、API Key 与配对二维码
todex-agentd tui

# 前台服务
todex-agentd serve --host 127.0.0.1 --port 7345

# 后台守护进程（PID 文件位于数据目录下）
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# 登录自启动（launchd / systemd user service / Windows 注册表 Run 键）
todex-agentd daemon autostart enable
\`\`\`

退出 TUI 时守护进程仍会在后台继续运行。TUI 中的配对二维码只包含服务器地址，当终端宽度放不下时可按 \`b\` 在浏览器中打开正方形 SVG；凭据弹窗会显示传输密钥指纹。

## 无界面管理与后端组命令

在容器或 SSH 等无交互界面的环境中，可以使用 CLI 子命令完成全部管理操作：

\`\`\`bash
# 点对点配对与设备管理
todex-agentd pair list
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>

# 后端组（Mesh v1）
todex-agentd mesh status                  # 查看节点 ID 与已加入的后端组
todex-agentd mesh join-code [--new]       # 查看或轮换 24 小时一次性加入码

# Provider CLI 与 Agent 浏览器组件
todex-agentd providers install codex claude --if-missing
todex-agentd browser install
\`\`\`

退出码 \`2\` 表示没有匹配的目标；退出码 \`3\` 表示当前执行命令的系统用户与运行守护进程的用户不一致。桌面客户端也可以直接部署并托管本机后端——详见[本机 Backend](/docs/desktop/local-backend)。
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '配置',
      description: 'config.toml、环境变量及其解析优先级。',
      body: body(`
## 优先级

1. 命令行参数
2. 环境变量
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`（默认 \`~/.todex-agent/config.toml\`）
4. 内置默认值

## 常用配置选项

| 选项 | CLI 参数 | 环境变量 | 默认值 |
| --- | --- | --- | --- |
| 监听主机 | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| 监听端口 | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| 数据目录 | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| 工作区根目录 | \`--workspace-root\`（可重复） | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| 默认智能体 | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex 二进制 | — | \`TODEX_AGENTD_CODEX_BIN\` | \`codex\` |
| Claude 二进制 | — | \`TODEX_AGENTD_CLAUDE_BIN\` | \`claude\` |
| Pi 二进制 | — | \`TODEX_AGENTD_PI_BIN\` | \`pi\` |
| omp 二进制 | — | \`[agent]\` 中的 \`omp_bin\` | \`omp\` |
| 常驻进程保活秒数 | — | \`TODEX_AGENTD_PROVIDER_KEEPALIVE_SECONDS\` | \`300\`（范围 \`30..=604800\`） |
| 设备认证 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| 配对加密 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |
| 外部 API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | 关闭 / \`7346\` |
| 网络监听器 | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| 本地 IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | 开启 / \`<data_dir>/agentd.sock\` |
| 允许的浏览器来源 | — | \`TODEX_AGENTD_CORS_ORIGINS\` | 无 |
| 受信任的代理 | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | 无 |
| 配对来源 | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | 无 |
| 后端组局域网信标 | — | \`TODEX_AGENTD_MESH_BEACON\` | \`true\`（UDP 21047） |
| 强制无头浏览器 | — | \`TODEX_AGENT_BROWSER_HEADLESS\` | 自动（无显示器时无头） |
| Kitesurf 目录 / workerd | — | \`TODEX_AGENT_BROWSER_KITESURF_DIR\` / \`TODEX_WORKERD_PATH\` | 自动下载 |

\`network_enabled = false\` 要求开启本地 IPC：此时后端只通过 IPC 套接字（Windows 上为命名管道）为本地客户端服务，仅保留一个随机回环端口供智能体工具和 \`/v2/version\` 使用。注意，后端组命令需要开启网络监听与设备认证（\`enable_auth = true\`）。容器部署的额外变量见[容器](/docs/desktop/containers)。

## 示例 \`config.toml\`

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]
# 仅通过本地 IPC 服务客户端（需要开启 [ipc]）
# network_enabled = false

[ipc]
enabled = true
# path = "~/.todex-agent/agentd.sock"

[agent]
default_agent = "codex"
codex_bin = "codex"
claude_bin = "claude"
pi_bin = "pi"
# 超过指定分钟数无输出时停止当前轮次（0 表示不限制）
provider_idle_timeout_minutes = 60

[agent.acp_profiles.default]
command = "mcp-server"
args = ["--stdio"]

[security]
enable_auth = true
enable_tls = false
# 除桌面端和回环页面外额外允许的浏览器 Origin
# cors_origins = ["https://todex.example.com"]
# 可信反向代理地址（用于识别真实转发来源）
# trusted_proxies = ["10.0.0.2"]

[api]
enabled = false
host = "127.0.0.1"
port = 7346
\`\`\`

> **注意：** 原生监听器有意禁止 \`enable_tls = true\`，以避免造成虚假的安全预期。远程访问请在可信的反向代理（如 Nginx、Caddy 或 Cloudflare Tunnel）上终止 TLS。
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: '安全与配对',
      description: '设备验证、后端组信任模型、端到端历史加密、浏览器站点守卫与隐私保护。',
      body: body(`
TodeX 采用 fail-closed 安全模型：未经显式批准的设备无法与后端通信，所有控制请求都经过密码学签名，磁盘上的对话历史始终保持端到端加密。

## 点对点设备验证（Pairing v3）

每台客户端设备会生成独立的 Ed25519 密钥对并发起配对注册，过程由人工核对确认：

1. 客户端只需填入后端地址，随机生成验证码并展示后端的传输密钥指纹（\`XXXX-XXXX-XXXX-XXXX\`）。
2. 在后端 TUI 按 \`d\` 打开设备面板，核对完整验证码与传输密钥指纹。
3. 按 \`a\` 批准或按 \`r\` 拒绝；已批准设备可在同一面板选中并按 \`x\` 立即吊销。

验证码的摘要绑定了传输协议与后端公钥，因此批准设备的同时也完成了对后端加密公钥的认证，客户端会一次性钉住设备密钥、协议与后端公钥。之后每次 HTTP 请求都必须携带设备签名，未授权或已吊销的设备会立即收到 \`401 Unauthorized\`（开放的 WebSocket 在 5 秒内以 \`4401\` 断开）。

## 后端组与中继安全（Mesh v1）

在**后端组**中，设备与后端节点不再依赖单机逐一配对，而是通过双链签名文档建立信任：

- **签名名单链（\`todex.mesh.roster\`）**：每次加入或移除设备/节点都会生成严格签名的新版本名单链（只有上一版名单中的成员设备或 24 词恢复签名密钥有权签署下一版），被移除的设备无法伪造后续名单，且在在线节点上立即失效、历史访问同步吊销。
- **组内设备审批**：新设备扫描**邀请二维码**（仅含节点地址，不含密钥）并连接到组内任一可达节点后，**在组内任意已加入设备上**核对验证码批准；后端节点本身从不把组申请暴露给本地 TUI 或写入 \`devices.json\`。
- **一次性加入码互证**：通过加入码添加新后端时，使用 80 位随机 RFC 4648 base32 加入码与双向 HMAC 证明（\`joinCodeProof\` / \`joinProof\`），有效防窃听与离线猜测，连续 5 次错误即作废。
- **端到端加密中继**：节点通过 \`/v2/mesh/relay/{node}/{ticket}/{path}\` 为组内不可直连的节点转发流量时，必须携带设备签名的中继票据（\`todex.mesh.v1/relay-ticket\`，单节点并发上限 64）；中继节点仅透传 \`health\`、\`version\`、\`transport-policy\`、\`sealed\` 与 \`tv=2\` WebSocket 的密文字节，既看不到明文内容，也无法伪造目标节点握手。

## 传输加密

| 模式 | 套件 | 适用场景 |
| --- | --- | --- |
| \`none\` | 明文 | 仅限本地回环（非回环地址拒绝明文） |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 常规远程访问 |
| \`ml-kem-768\` | NIST 后量子 ML-KEM | 配对默认 |

密钥只能通过设备配对或组节点签名的 \`node-info\` 下发，不支持手动粘贴导入。任何未经过配对验证保存公钥的连接档案在所有主机（含回环）都会被拒绝，直到重新配对。

## 端到端历史加密与同守护进程共享

- 对话事件与标题在落盘前即针对授权设备的 X-Wing 历史公钥和 24 词恢复密钥加密，后端磁盘上从不保存能解密历史的私钥。桌面端与移动端仅在本机缓存原样密文。
- 批准新设备加入**后端组**时，组内在线且持有历史密钥的设备会自动完成历史密钥授权，无需再次人工弹窗确认。
- 当本机的同一后端同时存在 IPC、TCP 与组节点等多个连接档案（钉住同一传输公钥）时，档案之间只需发起一次授权即可自动互授历史访问，切换为本机 IPC 连接后不会丢失此前查看的历史。

## 浏览器来源与代理边界

后端只响应来自桌面应用（\`todex-desktop://app\`）、回环页面以及 \`security.cors_origins\` 中精确列出的来源的跨域请求。携带 \`Forwarded\`、\`X-Forwarded-For\` 或 \`X-Real-IP\` 的请求即使来自回环地址也会被判定为远程请求，防止同机反向代理绕过回环权限检查；只有将代理加入 \`security.trusted_proxies\` 后才会采信其转发的客户端地址。

## Agent 浏览器站点守卫

- **顶层与子请求拦截**：Chromium 与 Kitesurf 的每次请求都会经过 \`Fetch\` 守卫校验。\`localhost\` / \`127.0.0.1\` / \`[::1]\` 直接放行；访问公网或局域网地址默认先发起 \`desktop_browser_host\` 授权（允许本次 / 始终允许 / 拒绝）。
- **DNS 解析防线**：即使在**设置 → Agent 桌面工具 → Agent 浏览器**中将**站点审核**设为**无需审核**，后端仍会在访问前解析域名，持续拦截链路本地地址（\`169.254.0.0/16\`、\`fe80::/10\`）、云元数据地址（如 \`fd00:ec2::254\`）、URL 内嵌用户名密码以及守护进程自身端口；向密码框输入始终需要单次确认（\`SENSITIVE_ACTION\`）。

## 本地 IPC 与签名发布

- **本地 IPC**：Unix 套接字（Windows 上为命名管道）只允许运行守护进程的同一系统用户连接。通过 IPC 连接的客户端无需设备签名即可使用 \`/v2/local-admin/*\`；开启 \`network_enabled = false\` 后 IPC 成为唯一入口。
- **签名发布**：所有版本发布均附带 Ed25519 签名的 \`SHA256SUMS.sig\`。\`install.sh\`、后端自更新、桌面端内置部署与客户端更新都会校验发布签名。

## 隐私对话

隐私对话仅驻留在守护进程内存中：不写 \`events.jsonl\`、不进入本机历史缓存、不生成密钥环记录，守护进程重启后即清除。Claude Code、Codex 与 Pi 完全不写会话文件；omp、OpenCode 与 DeepSeek Harness 将会话文件置于随对话删除的临时目录（依次尝试 \`$XDG_RUNTIME_DIR/todex-private\`、\`/dev/shm\` 与系统临时目录，仅限 Linux 和 macOS）。Grok Build、Devin、Antigravity 与通用 ACP 不支持隐私对话，且隐私对话不可分叉、定时、压缩或被 \`@chat:\` 引用。

## 隐私过滤器

输出过滤器会在返回给智能体的 \`todex_ssh\` 输出中遮盖机密信息（私钥块、凭据、银行卡、多国/地区证件号与代理节点凭据），并支持**激进选项**（URL Token、高熵串、UUID、邮箱、电话与公网 IP）以及最多 32 个自定义键名。在用户的 SSH 输出视图中，被过滤的值会盖在可刮开的保护层之下。

## 工作区边界与隔离

- \`workspace_roots\` 严格限制所有文件浏览与读写 API 的沙箱范围；移除工作区会取消其活跃轮次并保留历史对话。
- 所有数据按 \`tenant_id\` 隔离；智能体子进程运行在净化后的环境变量集合中；原生监听器禁止开启 \`enable_tls\`（请在可信反向代理终止 TLS）；[外部 API](/docs/backend/external-api) 密钥只能访问其自身会话与授权范围内的智能体和工作区。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API 参考',
      description: '/v2 REST 接口、多路复用 /v2/ws WebSocket 与 2.5 新增协议事件。',
      body: body(`
所有设备端点位于 \`/v2\` 下，携带 Ed25519 设备签名并以 JSON 通信（经过 \`POST /v2/sealed\` 传输加密隧道）。面向脚本和服务的 API Key 接口位于独立端口的 \`/api/v1\`，见[外部 API 与密钥](/docs/backend/external-api)。

## 系统与后端组

| 端点 | 用途 |
| --- | --- |
| \`GET /health\` | 存活探针 |
| \`GET /v2/version\` | 守护进程版本、工作区根目录、能力标志与 \`mesh: 1\` 支持声明 |
| \`ALL /v2/mesh/relay/{node}/{ticket}/{path}\` | 通过组内节点向不可直连的目标节点端到端透传公开路由与 \`tv=2\` WebSocket |

## 工作区

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/workspaces\` | 当前租户的缓存工作区列表 |
| \`PUT /v2/workspaces\` | 合并工作区缓存；返回规范化 ID |
| \`DELETE /v2/workspaces/{id}\` | 取消活跃轮次并移除工作区（保留对话） |
| \`GET /v2/workspace/entries?workspace=&query=\` | 为 \`@\` 选择器提供文件与目录建议 |
| \`GET /v2/workspace/directories?path=\` | 浏览工作区目录树 |
| \`GET /v2/workspace/file?path=\` | 读取沙箱根目录内的文件 |

## Provider 与 CLI 管理

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/providers\` | 可用 Provider、能力声明（含 \`supportsReplan\`、\`backgroundTaskStop\` 等） |
| \`GET /v2/providers/versions\` | 各智能体已安装版本与最新版本 |
| \`POST /v2/providers/{provider}/install\` | 安装缺失的受管 CLI |
| \`POST /v2/providers/{provider}/upgrade\` | 启动受管 CLI 升级（单并发，运行中智能体会阻塞升级） |
| \`GET /v2/providers/upgrades/{operationId}\` | 查询异步安装/升级进度 |
| \`GET /v2/providers/models?provider=&workspace=\` | 实时内省模型目录（含 Claude Code \`initialize\` 探测） |
| \`GET /v2/providers/commands?provider=&workspace=\` | 斜杠命令、Skills（含顶层符号链接 \`linked: true\`）与扩展 |

Provider 账户管理位于 \`/v2/agent-providers/{agent}\`，支持 \`GET .../export\` 与 \`POST .../import\` 在主机之间迁移账户配置。

## 对话与智能工作模式

| 端点 | 用途 |
| --- | --- |
| \`GET /v2/conversations\` | 当前租户的持久化对话列表 |
| \`POST /v2/conversations\` | 使用指定 Provider 创建对话（或隐私对话） |
| \`GET /v2/conversations/{id}\` | 读取对话清单与详情 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | 分页事件日志；\`beforeSequence=N\` 向前翻页惰性加载历史 |
| \`POST /v2/conversations/{id}/prompt\` | 发起轮次：支持 \`afterPlan\`（Claude 批准计划后切换执行设置）与 \`replan\`（执行中重入计划时切换计划模型） |
| \`POST /v2/conversations/{id}/cancel\` | 取消正在运行的轮次 |
| \`POST /v2/conversations/{id}/background-tasks/stop\` | 停止会话回合之间仍在等待的后台任务 |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | 回答审批、提问（\`user_input\`）、计划审阅（\`plan\`）或主机授权 |

轮次运行期间发起第二个冲突的变更请求会返回 \`409 Conflict\`；使用队列接口可安全排队追问。

## Agent 桌面工具（浏览器与 Computer Use）

| 端点 | 用途 |
| --- | --- |
| \`GET / PUT /v2/agent-desktop\` | 读写开关、引擎选择（\`browserEngine\`：\`chromium\` / \`kitesurf\`）、站点审核（\`browserHostApproval\`：\`ask\` / \`auto\`）及权限状态 |
| \`POST /v2/agent-browser/install\` | 下载所选浏览器引擎（Chromium 或 Kitesurf） |
| \`GET /v2/agent-browser/hosts\`、\`DELETE .../hosts/{host}\` | 查询与移除“始终允许”的外部站点 |
| \`GET /v2/agent-desktop/computer/apps\` | 获取可控制的应用列表（用于输入框 \`@app:\`） |
| \`POST /v2/agent-desktop/computer/permissions\` | 在 macOS 宿主机拉起系统设置与权限拖入引导浮窗 |

## WebSocket — \`/v2/ws\`

单条连接支持以下消息与事件流：

- \`conversation.subscribe\`：按 \`afterSequence\` 断线续传；规范化 \`plan.updated\` 事件统一承载 Codex、Claude、Pi 与 ACP 的计划步骤；\`provider.event\` 传递 \`plan_handoff\`、\`plan_reentered\`、\`provider_warning\`、\`auto_review\`、\`background_tasks_pending\` 与 \`background_tasks_ended\`。
- 提示词分发、取消、权限裁决与 \`conversation.backgroundTasks.stop\`。
- \`terminal.start\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.stop\` / \`terminal.attach\`：PTY 终端会话与重连屏幕恢复。
- \`agentBrowser.watch\` / \`agentBrowser.frame\` 与 \`desktop.computer.action\`（含 AI 光标归一化落点坐标）。
- \`mesh.node.get\`、\`mesh.presence.get\`、\`mesh.state.get\`、\`mesh.state.push\`、\`mesh.join.list\`、\`mesh.join.approve\`、\`mesh.join.reject\` 与广播事件 \`mesh.updated\`。

权威协议规范请查阅后端仓库中的 [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md) 与 [docs/mesh-v1.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/mesh-v1.md)。
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: '外部 API 与密钥',
      description: '使用后端管理的 API key，从脚本、CI 和其他服务通过 REST + SSE 调用智能体。',
      body: body(`
除了设备端口（\`7345\`），\`todex-agentd\` 还可以开启一个独立的 REST + SSE 端口，专门面向脚本、CI 流水线和自动化服务。它使用**后端签发的 API Key** 鉴权——不需要设备配对，也不走 transport v2——即可调用所有已接入的智能体，并且也可以直接在工作台的**设置 → Agent 调用**页面中可视化创建与管理密钥。

## 开启外部 API

外部 API **默认关闭**。你可以在 \`config.toml\` 中配置 \`[api] enabled = true\`，使用命令行参数 \`--enable-api\` / \`TODEX_AGENTD_API_ENABLED=true\`，或在工作台**设置 → Agent 调用**及后端 TUI 中直接切换开关并设置端口（修改后下次启动后端生效）。

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # 仅在可信 TLS 反向代理之后启用
\`\`\`

API 端口必须与主端口不同。由于 API Key 属于 bearer 凭据，非回环 \`api.host\` 默认拒绝启动（除非显式设置 \`allow_plaintext_remote = true\` 并前置 TLS 反向代理）。该端口不提供 CORS，浏览器无法跨域直连。

## 签发与管理密钥

密钥格式为 \`tdx_<id>_<secret>\`，完整密钥仅在创建时显示**一次**。后端仅在 \`<data_dir>/api-keys.json\`（权限 \`0600\`）保存 secret 哈希，因此文件本身既不能鉴权，也不能解密任何历史。

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

在 TUI 的 **API Keys** 面板（按 \`i\`）或客户端**设置 → Agent 调用**中也可以实时创建、编辑作用域和吊销密钥。吊销或过期的密钥会立即返回 \`401\`，其正在运行的轮次也会马上取消。

每把密钥支持精细作用域控制：

- **可调用的 Agent 与模型**：受全局**设置 → Agent 调用**范围及密钥自身白名单双重限制（默认允许全部）。
- **可用的工作区**：允许访问的绝对路径及子目录（默认全部工作区根目录）。
- **审批策略**：\`ask\`（默认，由调用方通过接口回答）、\`auto-approve\` 或 \`reject\`；限定给特定设备的请求绝不会代为批准。
- **有效期**：可选永久或指定天数后过期。

API 会话只使用智能体自身的工具，不会注入 TodeX 的 SSH、桌面与浏览器 MCP 工具，且轮次不能越权覆盖权限或沙箱模式。

## 接口列表

请求 \`http://127.0.0.1:7346\` 时附带 \`Authorization: Bearer <key>\`（或 \`X-API-Key\`）：

| 端点 | 用途 |
| --- | --- |
| \`GET /api/v1/health\` | 存活探测（无需密钥） |
| \`GET /api/v1/me\` | 返回当前密钥、授权范围与审批策略 |
| \`GET /api/v1/agents\` | 密钥可调用的智能体列表 |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | 智能体的实时模型目录 |
| \`GET /api/v1/workspaces\` | 密钥可访问的工作区 |
| \`POST /api/v1/conversations\` | 创建会话：\`{agent, workspace, title?}\` |
| \`GET /api/v1/conversations\` | 列出该密钥名下的会话 |
| \`GET / DELETE /api/v1/conversations/{id}\` | 查看或删除单个会话 |
| \`POST /api/v1/conversations/{id}/turns\` | 发起一轮：\`{text, model?, reasoningEffort?}\`；带 \`Accept: text/event-stream\` 时流式返回 |
| \`GET /api/v1/conversations/{id}/events?after=&limit=\` | 分页拉取事件（明文） |
| \`GET /api/v1/conversations/{id}/events/stream\` | SSE 实时订阅（支持 \`Last-Event-ID\` 续传） |
| \`POST /api/v1/conversations/{id}/cancel\` | 取消运行中的轮次 |
| \`POST /api/v1/conversations/{id}/permissions/{permissionId}\` | 回答权限请求 |
| \`POST /api/v1/runs\` | 一步调用：新建会话并运行一轮，支持阻塞等待或 SSE 流式返回 |

## 一次性调用示例

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

# 阻塞等待完成并返回结果
curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"总结 README"}' \\
  http://127.0.0.1:7346/api/v1/runs

# 以 SSE 流式输出事件
curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"列出 TODO","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

不带 \`stream\` 时接口等待轮次结束（\`timeoutSecs\` 默认 600 秒、上限 3600 秒，超时后取消轮次并返回 \`504\`）。

## 历史仍然端到端加密

外部 API 创建的会话同样在磁盘上加密落盘：每把密钥根据自身 secret 派生独立的历史接收方，后端仅在内存中解密并输出给对应密钥的请求，绝不保存派生密钥材料。数据目录泄露依然无法读取会话内容，单把密钥泄露也只会暴露该密钥自己的会话。
`),
    },

    // ------------------------------------------------------------------ 桌面端

    'desktop': {
      slug: 'desktop',
      title: '桌面端概览',
      description: 'Electron 原生客户端——集合可自定义首页、三栏工作台、本机 IPC 与容器集成。',
      body: body(`
TodeX 桌面端是 \`todex-agentd\` 的原生客户端，基于 Electron 44、React 19、Vite 7、Tailwind CSS v4 与 BoardUI 设计系统构建。它与 Web 客户端共享同一套 \`@todex/protocol\` 传输与会话引擎，因此核心工作台体验完全一致，并在此基础上提供本机部署、Docker 容器、本地历史缓存与局域网信标发现等原生能力。

## 首页与三栏工作台

- **首页看板**：打开客户端默认进入**首页**，集中查看正在运行的对话、等待回复与授权的会话、今日用量分布以及 Codex / Claude Code 套餐额度，并支持自定义卡片排序与缩放。
- **左侧边栏**：支持**分开**与**统一**两种布局、工作区标签分组、工作区分组文件夹状态环、离线后端工作区智能折叠，以及**计划（看板 / 日历）**、**终端（SSH / FTP / 本机）**、**个人主页**与**隐私对话**入口。
- **中间对话区**：流式 Markdown 时间线、动态思考点阵与按操作汇总的执行分组、独立计划审阅卡片与输入框上方实时计划步骤栏、智能工作模式（计划 → 自动审批执行 → 按需再规划）、\`@\` / \`/\` / \`#\` 上下文引用菜单，以及后台任务停止控制。
- **右侧工作台**：按对话或工作区共享的可拖拽多标签抽屉，包含**终端**（内嵌 xterm.js WebGL PTY，支持 Shell 集成、图片粘贴与断线快照恢复）、**文件**（工作区文件树与预览）、**Git Diff**（实时变更与提交/工作树操作）、**Agent 调用**（查看子对话互调），以及可置入侧栏或输入框上方的 **Agent 浏览器**与 **Computer Use** 实时画面。

## 桌面端独有集成

- **[本机 Backend](/docs/desktop/local-backend)**：直接在桌面端下载、校验签名并启动本机 \`todex-agentd\`，自动走本地 IPC 连接（无端口暴露），入组时自动保持 IPC 传数据、组连接作待命。
- **[容器](/docs/desktop/containers)**：基于 Docker 与 Compose v2 一键拉起预装智能体 CLI 的隔离容器后端，支持路径映射、初始化命令、空闲自动冻结与定期清理。
- **局域网信标监听（UDP 21047）**：在主进程自动监听同局域网内部组节点的广播，网络地址变动时自动重新发现节点。
- **本机加密历史缓存**：将最近浏览过的对话密文缓存在本机，重连前即可秒开阅读。
- **原生文件与目录选择器**：为本地工作区与容器挂载提供系统原生文件夹选择对话框。

## 获取安装包

官方预编译包通过 GitHub Releases 分发：Windows NSIS（x64 + ARM64）、macOS Apple Silicon DMG、Linux x64 AppImage，均附带 SHA-256 校验和与签名验证。需要从源码开发构建请参考[安装与构建](/docs/desktop/setup)。
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: '安装与构建',
      description: '本地开发前提、构建脚本、发布打包与脱敏诊断日志。',
      body: body(`
## 环境要求

- Node.js 22+、pnpm 11+
- 旁边检出 \`TodeX_protocol\` 仓库（客户端直接编译其 \`src\` 目录）
- 一个正在运行的 \`todex-agentd\` 后端（默认 \`http://127.0.0.1:7345\`），或使用 \`?demo\` 模式预览界面

## 安装与启动开发模式

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

如果下载 Electron 二进制时中断，可清理后重新安装：
\`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\`。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| \`pnpm run dev\` | 运行前置检查后启动 Vite 开发模式（1280×800 窗口） |
| \`pnpm run build\` | 构建 Electron main、preload 与 renderer |
| \`pnpm run package\` | 使用 electron-builder 打包各平台安装包 |
| \`pnpm run preview\` | 预览生产构建 |
| \`pnpm run typecheck\` | 同时对 main 与 renderer 做 TypeScript 类型检查 |
| \`pnpm run check:electron\` | 校验原生 Electron 二进制是否完好 |

## 打包发布

正式发行包由 **Release desktop packages** GitHub 工作流生成：输入语义化版本号（如 \`2.5.0\`）后，会自动构建并向 Release Tag 发布 Windows NSIS（x64 + ARM64）、macOS Apple Silicon DMG、Linux x64 AppImage 以及 \`SHA256SUMS\` 校验文件。本地开发构建版本号标记为 \`DEV0.0.0\`；macOS 签名与自动更新机制见桌面端仓库中的 \`docs/automatic-updates.md\`。

## 开发诊断日志

版本号为 \`DEV0.0.0\` 的构建会把详细运行日志写入 \`userData/logs/todex-desktop-debug.log\`（可通过环境变量 \`TODEX_DESKTOP_LOG_PATH\` 自定义路径）。日志覆盖窗口生命周期、IPC、HTTP、WebSocket 以及未捕获异常，其中所有令牌、Cookie、密钥与附件内容都会自动脱敏。
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: '连接后端',
      description: '同时连接多个独立后端或加入后端组，完成设备配对、跨端配置同步与故障排查。',
      body: body(`
TodeX 可以**同时保持连接多个后端**：每个后端独立管理自己的工作区、对话与能力目录，在侧边栏中用颜色圆点区分；如果有多台客户端设备与多个后端，推荐把它们加入同一个**后端组**（Mesh v1），避免逐台重复配对。

## 方式一：后端组（多设备 + 多后端推荐）

在**设置 → 后端组**中，你的手机、笔记本与多台服务器上的 \`todex-agentd\` 可以组成去中心化信任组，组内设备与后端互相信任，不需要中心服务器（也可以指定中心节点来加快发现与中继）：

1. **创建或加入组**：第一台设备点**创建组**（系统会提示保存一次性的 24 词**恢复密钥**）。其他设备进入**后端组 → 加入组**，直接扫描**邀请二维码**（\`邀请二维码\`）或粘贴邀请文本——邀请只含后端节点地址，不含密钥——然后在组内**任意已有设备**核对验证码并点**批准**，新设备立即可用组内所有后端并自动获得历史访问权。
2. **向组内添加后端**：已经点对点配对过的后端可在**添加后端 → 已配对的后端**中就地加入，保留所有既有对话与历史；未配对过的后端可通过**地址与加入码**（在后端运行 \`todex-agentd mesh join-code\` 或查看未入组后端的启动日志）输入 24 小时一次性加入码入组。
3. **本机 IPC 与组待命**：当本机后端也在组里且通过[本机 Backend](/docs/desktop/local-backend) 连接时，所有数据继续走本机 IPC（界面标为**本机 · 数据走 IPC**），组连接保持待命以同步在线状态、名单与入组审批；同一守护进程的多条连接档案还会自动互授历史访问权限。
4. **节点设置、局域网发现与加密中继**：在节点详情中可添加**固定地址**（公网 IP、域名或端口转发），桌面端还会自动监听 UDP 21047 局域网信标；当某个节点所有直连地址都不可达时，支持自动经组内其他节点用端到端加密**中继转发**（状态标为**经 \`<节点>\` 中继**，直连恢复后自动切回）。
5. **中心节点**：在有公网地址、长期在线的后端的节点设置中打开**中心节点**（成员列表标为**中心节点**，可以设多个）。其他后端会主动与它保持连接并互换最新地址，中心节点还会把它看到的公网地址告诉对方；设备也会先经中心节点中继连通，直连地址一可用就自动切到点对点直连。中心节点只转交签名过的名单与地址，看不到中继内容。

:::demo mesh

## 方式二：点对点设备配对

单独连接某台后端时，在**设置 → 后端连接**点击**添加后端**并只输入后端地址（如 \`http://192.168.1.20:7345\`）：

1. 客户端展示随机验证码和后端传输密钥指纹（\`XXXX-XXXX-XXXX-XXXX\`）。
2. 在后端 TUI 按 \`d\` 核对完整验证码和指纹，按 \`a\` 批准。
3. 客户端同时钉住设备密钥、传输加密协议（默认为后量子 \`ml-kem-768\`）与后端公钥并建立连接。

连接详情页会展示当前协议、公钥指纹与验证状态，支持随时**重新配对**；修改后端地址会自动清除旧的钉住公钥。组内节点统一在**后端组**中展示，**后端连接**列表只列出点对点直连的后端。

对于同一台电脑上的后端，桌面端可以直接跳过网络配对走本地 IPC（见[本机 Backend](/docs/desktop/local-backend)）；容器后端则提供快捷的 \`todexc\` / \`docker exec\` 批准命令（见[容器](/docs/desktop/containers)）。

## 后端间配置同步与 Provider 账户迁移

- **配置同步（设置 → 后端连接 → 配置同步）**：将两个已配对后端并排对比——左侧为**源后端**、右侧为**目标后端**——勾选需要同步的 **CLI 账户、设置、MCP 服务器、Skills 与 SSH 连接**。同步只写入新增和变更项，绝不删除目标后端已有配置，界面查看值时敏感密钥会自动遮蔽（使用密码登录的 SSH 主机与私钥不会通过配置同步复制，请先在目标机器放置私钥）。
- **Provider 账户导入/导出**：在**设置 → CLI 管理**各智能体的**账户**标签页中，可将账户配置文件导出为签名 JSON 迁移到另一台后端（文件包含明文密钥，请妥善保管）。

:::demo config-sync

## 连接诊断

| 状态 | 常见原因 | 处理方法 |
| --- | --- | --- |
| 后端不可达 | \`/v2/version\` 或 \`/health\` 请求失败 | 确认 \`todex-agentd\` 已启动且端口/防火墙已放行；组内可配置固定地址或启用中继 |
| 后端 URL 无效 | 地址格式无法解析 | 使用 \`http(s)://host:port\` 形式（浏览器 HTTPS 页面访问远程后端须使用 HTTPS） |
| 认证失败 | HTTP 401/403（设备未批准或被移出组） | 在后端 TUI 或组内已有设备上重新配对/入组 |
| 协议已弃用 | URL 路径包含旧版 \`/v1\` | 改为根地址（后端统一使用 \`/v2\`） |
| WebSocket 失败 | REST 正常但 \`/v2/ws\` 失败 | 检查反代 WebSocket 升级头或加密指纹是否变更，点击**重新配对** |
| 智能体不可用 | Provider 返回 \`available = false\` | 在**设置 → CLI 管理**安装或登录对应智能体 CLI |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: '工作台',
      description: '首页看板、侧边栏、智能工作模式与计划审阅、时间线执行过程、右侧面板与快捷键。',
      body: body(`
桌面端与 Web 端共享完全一致的工作台布局。下面先用自动演示浏览一次从新建对话、展示计划步骤、展开工作过程到流式回复的完整过程；后文每个板块下方都附带对应功能的自动演示，可暂停或点击步骤条切换到任意一步：

:::demo

## 首页（默认起始页）

打开 TodeX 默认进入**首页**，集中掌握所有后端的工作脉搏：实时显示**正在运行**、**等待回复**（含**等待授权**状态提示）、**今日对话**、**今日用量**、**分时用量**柱状图，以及 Codex / Claude Code 的**套餐限额**（5 小时与 7 天窗口）。

点击右上角**自定义布局**即可进入编辑模式：拖拽卡片重新排序、拖动卡片右下角调整大小、点击 \`×\` 隐藏不需要的卡片，或通过**添加卡片**随时恢复；点击**恢复默认**一键还原。

:::demo home

## 左侧边栏

侧边栏顶部为工作区，下方为对话列表——也可在**设置 → 外观 → 侧边栏布局**切换为**统一**，让每个工作区的对话直接收在它下面（每页 5 条）。对话行显示当前智能体徽标与状态圆点（等待后台任务时也会保持“正在工作”脉动）；右键支持新建、重命名、从最新回复分叉、置顶和删除。

- **离线后端工作区默认折叠**：未连接后端的工作区与“无工作区”行不会挤占列表（当前已打开的除外）；滑到列表底部分页最后一步时，可点击**显示未连接后端的工作区 (n)** 按原顺序展开，搜索功能始终检索全部工作区。
- **工作区分组与状态环**：工作区与分组均可编辑**标签**并开启**按标签分组**；工作区分组文件夹图标会自动同步显示组内最紧急的状态环（正在运行 > 异常 > 未读）。
- **独立页面与无工作区**：“无工作区”存放未归属任何工作区的对话（多后端时自动聚合）；点击进入**首页**、**计划**、**终端**或**个人主页**时，侧边栏不再高亮背后隐藏的工作区和对话。
- **隐私对话（⌘⇧P / Web 端 ⌥⇧P）**：选择支持隐私模式的智能体，创建仅保存在后端内存中的对话，带专属徽标与提示条。

:::demo offline-sidebar

## 定时对话与可选功能

- **定时对话**：从侧边栏或**计划**任务中创建并设定发送时间，期间输入的消息会按顺序暂存在后端内存中，到点自动顺序发出；输入框上方提供**立即发送**、**修改时间**与**取消定时**。
- **功能显示控制（设置 → 功能）**：**定时对话**、**终端**与**计划**可在侧边栏中独立设置为显示、收进“更多”，或完全关闭（对应快捷键与菜单同步隐藏），设置按当前设备保存。
- **连接预热**：后端仍在启动时，侧边栏提示“正在等待后端加载完成”并最长持续重试 2 分钟；当前打开对话的智能体会提前预热以加快首条消息响应。

## 智能工作模式与计划审阅

在 Claude Code 对话的输入框工作模式菜单中选择**智能**，即可启用由**设置 → 智能工作模式**驱动的双阶段工作流：

1. **计划阶段（智能 · 计划中）**：自动使用设定的计划模型、思考强度与计划技能只读调查代码并形成方案。
2. **计划审阅行与审阅卡片**：Claude 调用 \`ExitPlanMode\` 时，计划全文作为独立 Markdown **计划**行展示在时间线里，输入框上方弹出**计划待批准**卡片（注明批准后将切换到的执行模型）。点击**批准计划**立即进入执行；点击**要求修改**并输入反馈即可让 Claude 继续修订计划。
3. **自动交接与再规划**：批准后后端在轮次内切换至执行模型与**自动审批**（时间线记一条交接提示），状态切为**智能 · 执行中**；若执行中 Claude 自主调用 \`EnterPlanMode\` 或你附带了计划技能，会自动切回计划模型重新规划。

:::demo smart

## 中间——对话时间线与计划步骤

- **实时计划步骤栏（\`计划 1/3\`）**：输入框上方可折叠的清单实时呈现 Codex、Claude Code（\`TodoWrite\`）、Pi（\`pi-tasks\`，跨轮次保留）及 ACP 智能体的计划步骤与说明。
- **Codex 告警与自动审查提示**：Codex 的配置/弃用/安全警告与 \`auto_review\` 自动审查结果各自渲染为单行轻量提示，鼠标悬停可查看详情与风险评估理由；Codex 思考强度支持 \`ultra\`。

:::demo plan-steps

- **思考点阵、操作摘要与文件胶囊**：正在执行的工具组以动态思考点阵开头并写出当前动作（如“正在读取 \`page.tsx\`”）；完成后自动汇总为计数标题（如“编辑 2 个文件 · 运行 1 条命令”），展开后用文件胶囊展示触及的文件，步骤耗时与命令输出清晰可读。

:::demo execution-group

- **后台任务控制**：当 Claude Code 回合结束但仍在等待后台命令或子代理时，输入框与侧边栏保持运行指示，并在输入框上方提供**停止后台任务**按钮。

:::demo background-tasks

- **输入框与回复操作**：\`@\` 调出两级引用菜单（\`@file:\`、\`@folder:\`、\`@chat:\`、\`@skill:\`、\`@mcp:\`、\`@app:\` 与 SSH 终端）；\`/\` 调用斜杠命令；\`#\` 引用能力；支持拖拽与粘贴图片/文件；每条回复下方支持**从这条回复分叉**（Codex 与 Pi 可从任意回复分叉，其他智能体从最新回复分叉）。
- **目标与压缩**：Codex 支持 \`/goal <目标>\` 设定长期目标并在输入框上方展示进度栏；Pi 支持 \`/todex compact <指令>\`。

## 右侧——工作台标签页

| 标签页 | 内容 |
| --- | --- |
| 终端 | 内嵌 xterm.js PTY（WebGL），支持查找、链接点击、Shell 集成、图片粘贴与重连屏幕快照恢复 |
| 文件 | 浏览工作区目录树并预览文件内容 |
| Git Diff | 实时查看多仓库工作区变更、分支状态与 Git 操作 |
| Agent 调用 | 集中查看当前对话通过 \`todex_agents\` 派生的子对话状态、任务与结果 |
| Agent 浏览器 / Computer Use | 当智能体使用桌面或浏览器工具时，按**实时画面位置**设置自动以标签页打开（或置入输入框上方），Computer Use 画面上叠加橙色 **AI 光标** |

:::demo computer-live

## 键盘快捷键

| 按键 | 操作 |
| --- | --- |
| \`⌘B\` / \`Ctrl B\` | 切换左侧边栏 |
| \`⌘⌥B\` / \`Ctrl Alt B\` | 切换右侧工作台面板 |
| \`⇧⌘G\` / \`Ctrl Shift G\` | 打开 Git 操作 |
| \`⌘N\`（Web 端 \`⌥N\`） | 新建对话 |
| \`⇧⌘N\`（Web 端 \`⌥⇧N\`） | 添加工作区 |
| \`⇧⌘P\`（Web 端 \`⌥⇧P\`） | 新建隐私对话 |
| \`⌘L\` / \`Ctrl L\` | 快速搜索（对话与历史内容） |
| \`⌘1…⌘9\` / \`Ctrl 1…9\` | 切换右侧工作台标签页 |
| \`⇧⌘K\` / \`Ctrl Shift K\` | 打开「计划」面板（看板 / 日历） |
| \`⇧⌘T\`（Web 端 \`⌥⇧T\`） | 打开「终端」独立页（SSH 主机、密钥、远程文件、本机终端） |

> 由于浏览器保留了 \`⌘N\` / \`⇧⌘N\` / \`⇧⌘T\`，Web 端将这两项“新建”和终端页面快捷键改为 Option（\`⌥\`）修饰键，其余完全一致。短按修饰键会在界面上浮现快捷键提示徽标。

## 终端快捷键与 Shell 集成

在终端区域内（macOS 用 \`⌘\`，Linux / Windows 用 \`Ctrl Shift\`）：

| 按键 | 操作 |
| --- | --- |
| \`⌘C\` / \`Ctrl Shift C\` | 复制（选中文本时 \`Ctrl C\` 亦可直接复制） |
| \`⌘V\` / \`Ctrl Shift V\` | 粘贴 |
| \`⌘F\` / \`Ctrl Shift F\` | 页内查找 |
| \`⌘K\` / \`Ctrl Shift K\` | 清屏 |
| \`⌘↑ ⌘↓\` / \`Ctrl Shift ↑ ↓\` | 跳转到上一个 / 下一个提示符 |

**Shell 集成**（设置 → 外观 → 终端，默认开启）会为 bash、zsh 与 fish 标记命令提示符状态（失败显示红色）、自动同步路径栏、关闭仍在运行命令的标签前确认，并在切走期间超过 10 秒的命令结束时弹出通知。粘贴或拖入图片时会自动写入运行终端的主机临时目录（SSH 主机位于 \`~/.cache/todex/paste\`）并粘贴路径，7 天后自动清理。
`),
    },

    'desktop/settings': {
      slug: 'desktop/settings',
      title: '设置',
      description: '后端组、连接与配置同步、智能工作模式、Agent 桌面工具、CLI 管理与本机历史缓存。',
      body: body(`
设置弹窗采用左侧分组导航设计，本页按功能模块梳理所有核心设置项；[本机 Backend](/docs/desktop/local-backend) 与[容器](/docs/desktop/containers)另有专页说明。

## 后端组

**设置 → 后端组**用于管理去中心化的设备与节点信任组（Mesh v1）：

- **创建与加入**：新建组并备份一次性 24 词恢复密钥；通过扫描**邀请二维码**或粘贴邀请文本加入已有组；组内待审批设备会在列表顶部展示验证码供核对批准。
- **添加后端与节点设置**：支持直接添加已配对的后端或通过 24 小时**加入码**添加新后端；为单个节点配置**固定地址**、**作为中继**角色（优先 / 允许 / 禁止）以及是否**允许经中继访问**；查看组内设备的在线状态与最近在线时间，也可随时移除成员或离开组。

:::demo mesh

## 后端连接与配置同步

- **后端连接**：管理点对点直连的后端档案（名称、标签颜色、后端地址、传输加密指纹、重新配对与历史加密恢复密钥状态）；组节点会自动归入**后端组**，不在此重复列出。
- **配置同步（设置 → 后端连接 → 配置同步）**：将两个后端并排展示，实时比对 **CLI 账户、设置、MCP 服务器、Skill 与 SSH 连接**差异，勾选后只写入新增与改动项，绝不删除目标后端已有数据；敏感值自动隐藏。

:::demo config-sync

## 智能工作模式

**设置 → 智能工作模式**按当前设备配置 Claude Code 的两阶段工作流：

- **计划阶段**：选择规划用的**模型**、**思考强度**以及每次进入计划时自动附带的**计划技能**（如通过符号链接共享的 \`plan-gate\`）。
- **执行阶段**：选择实施用的**模型**与**思考强度**；权限固定为**自动审批**，计划通过后立即交接执行。

:::demo smart-settings

## Agent 桌面工具（Agent 浏览器 & Computer Use）

在**设置 → Agent 桌面工具**按所选后端开关控制权（两者均运行在后端所在主机上，所有连接的客户端均可实时观看）：

- **Agent 浏览器**：
  - **引擎选择**：可在 **Chromium** 与实验性 **Kitesurf**（基于 Cloudflare \`workerd\` 的无界面隔离引擎，无需桌面环境且自动安装校验）之间切换。
  - **站点审核与已允许的站点**：默认**逐个审核**打开本机以外的站点；可切换为**无需审核**（云元数据、链路本地与守护进程自身端口仍始终拦截），也可随时从**已允许的站点**列表移除已保存的域名。
  - **浏览器资料**：在使用 Chromium 时按工作区管理独立的 Cookie、存储与缓存资料；切到 Kitesurf 后按标签自动隔离。
- **Computer Use**：
  - **引擎与实时画面位置**：可选择**内置**引擎或下载实验性 **agent-desktop** 引擎；支持将实时画面固定在右侧**侧边栏**或**输入框上方**。
  - **macOS 权限引导**：未授予定位权限时显示可拖入系统设置隐私列表的引导状态与“屏幕录制需重启后端”提醒，且会自动提示 ad-hoc 签名无法持久保留系统授权。

:::demo agent-browser

## CLI 管理（符号链接技能、插件与 512K 预设）

**设置 → CLI 管理**列出所选后端上全部受管智能体 CLI（Codex、Claude Code、Pi、Grok Build、DeepSeek Harness、omp 及 ACP）的已安装与最新版本，支持多 CLI 并行安装升级与**全部更新**（容器镜像自带 CLI 标为“随镜像更新”）。列表顶部的**共享 MCP / Skill** 管理所有智能体共用的能力。

每个 CLI 页面包含以下标签页（按支持情况显示）：

| 标签页 | 内容 |
| --- | --- |
| 设置 | CLI 自身配置文件（常用表单、环境变量、原始文件）；支持 Pi 原生 **MCP** 与**插件**开关、**子代理模板**，以及 DeepSeek Harness（\`dsh\`）补丁层与插件管理 |
| MCP / Skill | 该后端上生效的 MCP 与技能；顶层符号链接技能（如 \`~/.claude/skills/plan-gate\`）带有只读**链接**徽标 |
| 账户 | Provider 账户与 API Key；支持导出/导入迁移，自定义模型上下文窗口预设新增精确的 **512K（\`524,288\`）** 选项 |
| 清理 | 清理该 CLI 保存在后端上的原生会话文件 |
| 插件 | omp 等 CLI 的插件安装、升级与启停控制 |

:::demo linked-skills

## Agent 调用、SSH、存储与外观

- **Agent 调用**：统一配置允许互调（\`todex_agents\` MCP）与外部调用（\`/api/v1\`）的智能体和模型白名单，启停外部 API 监听端口并管理各作用域的 API Key。
- **SSH 连接**：管理托管主机与 \`~/.ssh/config\` 主机的 Agent 访问权限、本机 \`Local\` 终端开关、隐私过滤（含激进选项与自定义键名），以及 **SSH 连接审批**粒度（**逐台**主机在对话内批准一次，或**逐条**命令单独审批）。
- **通用 → 存储**：管理 **TodeX 对话历史清理**与桌面端**在本机缓存最近对话**（默认开启，最多保留 100 个对话、每个最新 300 条事件、上限 200 MB；仅存后端发来的加密密文，绝不缓存隐私对话，吊销设备或清空缓存即销毁）。
- **外观与通知**：切换**侧边栏布局**（分开 / 统一）与终端 **Shell 集成**；系统通知会区分具体等待审批的操作与 \`AskUserQuestion\` 提问正文，响应后自动撤回。
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: '本机 Backend',
      description: '从桌面端一键部署、运行并托管本机后端，自动走本地 IPC 并无缝融入后端组。',
      body: body(`
桌面端可以在安装它的同一台电脑上直接部署和运行 \`todex-agentd\`，并通过**本地 IPC**（Unix 套接字，Windows 上为命名管道）与之通信——该套接字仅允许当前系统用户打开，无需占用公网或本地网络端口，也不需要手动核对设备验证码。

## 一键部署与生命周期管理

打开**设置 → 本机 Backend**，**本机**卡片会自动匹配并运行与当前 TodeX Desktop 版本一致的 \`todex-agentd\`：

1. 点击**部署并连接**：桌面端从官方 GitHub Release 下载对应平台二进制、校验 \`SHA256SUMS.sig\` 发布签名、启动守护进程、自动完成本机配对并通过 IPC 建立连接。
2. 部署完成后卡片提供**启动并连接**、**重启**、**停止**、**重新配对**与**查看日志**操作。桌面端只接受发布签名验证通过的版本（2.3.6 及更早无签名版本仅在版本完全一致时兼容）。

启动选项包括**登录时自动启动**与**退出 TodeX 时停止**（默认关闭，以便其他设备在桌面客户端关闭后仍能通过网络或后端组继续访问本机）。同一页面还可配置工作区根目录、网络监听地址（默认 \`127.0.0.1:7345\`）、配对加密方式，以及展示供手机或远程设备接入的配对二维码和密钥指纹。

## 自动复用现有回环连接与加入后端组

- **切换到 IPC**：如果客户端此前通过 \`http://127.0.0.1:7345\` 连接了本机守护进程，启用本机连接时会自动把该回环档案切到 IPC 套接字，避免重复配对成一台新设备；在发现支持 IPC 的回环连接时也会提示一键**切换到 IPC**（可在设置关闭此提示）。
- **本机后端加入后端组（本机 · 数据走 IPC）**：如果本机后端同时也加入了某个**后端组**，桌面端会保留两条协同连接——所有工作区、对话、订阅与读写请求继续走低延迟、免网络的 **IPC 档案**；组对应的网络档案则自动切为**待命连接**，只负责汇报本设备在线状态、同步组名单与接收新设备入组申请。由于同一守护进程的不同连接档案会自动互相授予历史加密访问权，你在本机切换连接方式时历史对话始终无缝衔接；当 IPC 档案停用时，组连接会自动接管数据流量。

## 关闭网络接口

如果这台电脑上的后端只供本机 TodeX Desktop 自己使用，可以在确认已通过 IPC 连接后关闭**网络接口**（需重启生效）。关闭后守护进程不再监听 TCP \`7345\`，只保留一个内部随机回环端口供智能体工具和 \`/v2/version\` 使用（在后端 TUI 中对应快捷键 \`b\`，在 \`config.toml\` 中为 \`network_enabled = false\`）。

> 若本机后端需要作为**后端组**节点供其他设备连接，请保持网络接口开启。

## 本地管理 API

仅通过本地 IPC 套接字访问时，后端会开放 \`/v2/local-admin/*\`（查询状态、修改配置、获取组加入码、审批/吊销设备及重置），无需设备签名（操作系统套接字权限已证明调用者是同一用户）；通过 TCP 访问这些管理路径一律返回 \`404\`。
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: '容器',
      description: '在 Docker 中运行隔离后端、创建容器工作区、执行初始化命令并自动冻结与清理。',
      body: body(`
TodeX 容器是预装了 \`todex-agentd\` 和常用智能体 CLI 的 Docker 镜像。每个容器都是一个完全独立的沙箱后端：智能体与命令行工具只在容器内部执行，宿主机的项目目录按需挂载进去。

## 前置要求与容器管理

运行 TodeX Desktop 的主机需要安装 Docker 与 Compose v2。打开**设置 → TodeX Container** 会自动检测环境状态，列出可用镜像标签与所有 TodeX 容器，并提供启动、停止、重启、升级、查看挂载路径、实时日志与删除操作（删除容器时默认保留其 home 卷以保存登录凭据与配置，除非主动勾选一并清除）。该界面与命令行工具 \`todexc\` 共用 \`~/.config/todex-container/<name>/\` 目录布局。

## 创建容器工作区

点击侧边栏**新建工作区**可选择**本地工作区**或**容器工作区**。选择容器工作区后，TodeX 会：

1. 将目标项目目录挂载进容器（Linux 与 macOS 上挂载到与宿主机一致的路径，Windows 上挂载到 \`/workspace/<目录名>\`）；
2. 自动与容器内后端完成设备配对（需要手动核对时界面会直接给出 \`todexc\` / \`docker exec\` 批准命令）；
3. 检查容器内智能体 CLI 状态，并主动提示通过[配置同步](/docs/desktop/settings#后端连接与配置同步)把宿主机或另一台后端的账户、MCP、Skill 与 SSH 连接一键复制到容器中。

容器后端会在能力报告中声明 \`deployment: container\`：镜像内置的 CLI 会显示“随镜像更新”（通过升级镜像更新而非单独自更新）；路径映射会自动在宿主机路径与容器路径之间转换，因此工作台里的**在本地选择**、**打开文件**等功能对容器工作区同样透明可用。

## 初始化命令

新建容器工作区时可配置一次性初始化命令：以 \`todex\` 用户身份、在容器工作区根目录下通过 \`bash -c\` 顺序执行，遇到第一个非零退出即停止。界面会自动为 \`pnpm\`、\`npm\`、\`yarn\`、\`uv\`、\`requirements.txt\` 与 \`git submodules\` 提供快捷模板；耗时较长的安装可转入后台继续运行而不阻塞对话创建。

## 空闲自动冻结

开启**空闲时自动冻结**（默认关闭）后，当容器超过设定空闲时间（支持 15 分钟至 4 小时）没有活跃任务或终端会话时，会自动执行 \`docker pause\` 挂起节省内存与 CPU。再次发送消息、打开容器终端或切到该容器下的工作区时，TodeX 会自动恢复容器；容器管理卡片上也提供手动**冻结**与**恢复**按钮。

## 定期自动清理

清理任务在客户端启动 1 分钟后运行，之后每 6 小时执行一次（可按需开关与配置天数）：

- 删除不再使用的旧版本容器镜像；
- 删除已停止超过 1 天、7 天或 30 天的容器（也可设为从不删除）；
- 清理已没有任何工作区引用的悬空挂载目录；
- 在退出 TodeX Desktop 时自动停止运行中的容器。

容器的 home 卷永远不会被自动删除。

## 容器后端环境变量

| 变量 | 作用 |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | 关闭自更新；执行 \`update\` 时不做改动并以 0 退出 |
| \`TODEX_AGENTD_ADVERTISE_URL\` | 后端向客户端与后端组通告的可达地址 |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | 标记由镜像管理的 CLI 目录；尝试在线安装时返回 \`409\` |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | 主机 ↔ 容器路径映射规则（\`[[workspace.path_mappings]]\`） |

无界面的容器后端也可通过 \`todex-agentd pair list|approve|reject\`、\`todex-agentd mesh join-code\`、\`devices list|revoke\` 与 \`providers install <id>…\` 管理（见[安装与运行](/docs/backend/install)）。
`),
    },

    'mobile': {
      slug: 'mobile',
      title: '移动端',
      description: '原生 iPhone 与 iPad 客户端（Todex Mobile）——积极开发中。',
      body: body(`
> **即将推出。** 原生移动端客户端正在积极开发中；本页用于追踪已确定并正在对齐的特性，首个 Beta 版本发布后将替换为完整使用文档。

Todex Mobile（\`TodeX_native\`）是面向 iPhone 与 iPad 的原生 Swift + UIKit 客户端，与桌面端和 Web 端连接同一套 \`todex-agentd\` 后端——把你的工作区、对话、计划审阅、审批与终端完整带进口袋。

## 正在对齐的能力

- **相机扫码加入后端组与配对**：扫描**后端组**邀请二维码或后端 TUI 二维码即可直接填入地址，按与桌面端完全一致的核对码流程完成入组或设备验证。
- **对话 + 控制台双栏**：在 iPad 等宽屏设备上提供双栏视图，一侧查看对话时间线与计划审阅卡片，另一侧实时操作终端、文件、浏览器画面与 Git 变更。
- **完整轮次与智能工作模式控制**：支持权限审批、提问卡片、计划修改意见反馈、模型与思考强度选择、消息队列，以及离线期间对话完成时的推送提醒。
- **一致的端到端安全与密文缓存**：Ed25519 设备签名与 X25519 / ML-KEM-768 传输加密，私钥保存在 iOS Keychain；同时采用与桌面端一致的端到端密文历史缓存机制，并在本机缓存已加密的会话清单（标题保持 \`titleEnc\` 密文、绝不缓存隐私对话）以支持离线列表浏览。

## 现阶段如何在手机使用

Web 工作台已经针对手机浏览器与平板视口做了完整响应式适配，你可以直接在移动浏览器访问自部署或托管的 \`/app\`，或者直接扫二维码加入**后端组**——界面与工作台能力完全一致。配对与安全详情见[安全与配对](/docs/backend/security)。
`),
    },
  },
};
