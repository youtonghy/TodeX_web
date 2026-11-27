# TodeX Web

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/t-icon-dark-beige.png" />
    <source media="(prefers-color-scheme: light)" srcset="src/renderer/assets/brand/t-icon-light.png" />
    <img src="src/renderer/assets/brand/t-icon-dark-beige.png" alt="TodeX" width="120" height="120" />
  </picture>
</p>

<p align="center">
  <strong>TodeX 官网，以及完整的浏览器版 TodeX 工作台：在任何电脑上，通过你自己的后端运行并跟进 Codex、Claude Code、Pi 等编程 Agent。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a>
</p>

![TodeX Web 工作台](docs/screenshots/home-zh.png)

TodeX Web 在同一个站点上提供两样东西：

- **官网**（`/`）：介绍 TodeX、可实时操作的工作台演示、使用文档，以及桌面端安装包和后端安装脚本的下载。
- **工作台**（`/app`）：与 [TodeX 桌面端](https://github.com/youtonghy/TodeX_desktop) 相同的工作区，在浏览器里使用。它连接你自己的 TodeX 后端（`todex-agentd`），由后端在所在机器上运行各个 Agent CLI。

支持浅色与深色主题，界面语言有 English、简体中文、日本語、한국어，并可用 Docker 自行部署。

## 目录

- [官网](#官网)
- [首页总览](#首页总览)
- [对话](#对话)
- [模型、思考强度与工作模式](#模型思考强度与工作模式)
- [计划与任务看板](#计划与任务看板)
- [隐私对话](#隐私对话)
- [终端与 SSH](#终端与-ssh)
- [Agent 桌面工具](#agent-桌面工具)
- [后端连接、后端组与配置同步](#后端连接后端组与配置同步)
- [Agent CLI 管理与 Agent 调用](#agent-cli-管理与-agent-调用)
- [个人主页](#个人主页)
- [安全与浏览器数据](#安全与浏览器数据)
- [部署](#部署)
- [开发](#开发)

## 官网

官网首页介绍 TodeX，并内嵌一个实时演示：真实的工作台用示例数据回放一段简短的操作流程，不会连接任何后端。首页的隐私承诺（`/#privacy`）说明自托管时工作内容发往哪里，以及组内中继和云端模型服务商分别能看到什么。**下载** 页按版本和平台列出桌面端安装包，附发布说明和校验和，并提供一行命令安装后端。**文档** 包含工作区、Agent 和计划的使用指南，每个功能都配有可交互的演示场景。

![TodeX 官网](docs/screenshots/site-zh.png)

## 首页总览

首页集中展示眼下需要你处理的事：运行中的对话、等待你回复或授权的对话、今日对话数与 Token 用量，以及各 Agent 的套餐限额和重置时间。点 **自定义布局** 可以增删、重排卡片。

| 浅色 | 深色 |
| :---: | :---: |
| ![首页（浅色）](docs/screenshots/home-zh.png) | ![首页（深色）](docs/screenshots/home-dark-zh.png) |

## 对话

侧边栏把工作区按文件夹分组，列出各自的对话和实时状态。在对话里可以跟进 Agent 的流式回答，展开每轮执行的命令、文件 diff 和工具调用，并对授权请求做出允许一次或整个对话内允许的决定。标题栏显示 Agent、Git 分支、工作树和改动规模。

输入框支持图片和文件，并有 `@`（文件、文件夹、其他对话、Skill、MCP 服务器、SSH 主机、应用）、`/`（Agent 的斜杠命令）和 `#`（Skill 与 MCP 服务器）三个菜单。Agent 忙时发送的消息会进入队列；关掉标签页对话也会继续运行，因为它由后端执行。

| 浅色 | 深色 |
| :---: | :---: |
| ![对话（浅色）](docs/screenshots/conversation-zh.png) | ![对话（深色）](docs/screenshots/conversation-dark-zh.png) |

运行中的计划和 Agent 的目标固定在输入框上方：

| 计划步骤 | Agent 目标 |
| :---: | :---: |
| ![计划步骤](docs/screenshots/plan-steps-zh.png) | ![目标](docs/screenshots/goal-zh.png) |

## 模型、思考强度与工作模式

搜索模型、拖动调整思考强度，并选择工作模式：**实现**、**计划**，或 Claude Code 的 **智能** 模式（先用一个模型规划，批准后由执行模型以自动审批方式执行）。

| 模型与思考强度 | 工作模式 |
| :---: | :---: |
| ![模型选择](docs/screenshots/model-card-zh.png) | ![工作模式](docs/screenshots/work-mode-zh.png) |

## 计划与任务看板

按工作区划分的任务看板：任务有优先级、截止日期和状态，可固定到处理它的对话上，另有日历视图。

| 看板 | 日历 |
| :---: | :---: |
| ![任务看板](docs/screenshots/task-board-zh.png) | ![计划日历](docs/screenshots/plan-calendar-zh.png) |

## 隐私对话

在发送按钮上右键或长按可以选择发送方式，再点发送生效：作为隐私对话发送（只保存在后端内存里，不写入历史记录，后端重启后即消失），或在你选定的时间按该对话的 Agent、模型和设置定时发送。

![隐私对话](docs/screenshots/private-conversation-zh.png)

## 终端与 SSH

在后端机器上打开终端，管理它的 SSH 主机、密钥、FTP 站点和端口转发，通过 SFTP/FTP 浏览远程文件，并为指定主机开放 Agent 访问，可按对话或逐条命令审批。

![终端主机](docs/screenshots/terminal-hosts-zh.png)

## Agent 桌面工具

打开 Agent 桌面工具后，Agent 可以在后端所在的电脑上操作浏览器和应用。你可以实时观看并随时停止；每个对话首次使用都需要批准。

| Computer Use 实时画面 | 设置 |
| :---: | :---: |
| ![Computer Use 实时画面](docs/screenshots/computer-live-zh.png) | ![Agent 桌面工具](docs/screenshots/settings-agent-desktop-zh.png) |

## 后端连接、后端组与配置同步

可以添加任意多个后端，每个后端各自保持连接、提供自己的工作区。配对只需后端地址，再核对一次验证码并批准。**后端组** 用二维码邀请和加密中转把设备与后端组成一组；**配置同步** 把 Agent 账号、设置、MCP 服务器和 Skill 从一个后端复制到另一个后端。

| 后端连接 | 后端组 |
| :---: | :---: |
| ![后端连接](docs/screenshots/settings-backends-zh.png) | ![后端组](docs/screenshots/settings-mesh-zh.png) |

![配置同步](docs/screenshots/config-sync-zh.png)

## Agent CLI 管理与 Agent 调用

查看每个 Agent CLI 的已装版本和最新版本，一键升级或安装，切换服务商账号，并可导出、导入为文件。**Agent 调用** 让 Agent 把任务交给其他 Agent 和模型，也可以为通过后端外部 API 调用 Agent 的脚本创建 API Key。

| CLI 管理 | Agent 调用 |
| :---: | :---: |
| ![CLI 管理](docs/screenshots/settings-cli-zh.png) | ![Agent 调用](docs/screenshots/settings-agent-calling-zh.png) |

## 个人主页

按 Agent 和模型统计 Token 用量、缓存命中率、活跃热力图和每月活跃对话。

![个人主页](docs/screenshots/profile-zh.png)

## 安全与浏览器数据

- **设备验证**：每个浏览器与后端配对时，需要和后端控制台（或 `todex-agentd pair approve`）核对验证码。批准后会固定后端密钥并登记本浏览器的签名密钥，无需粘贴任何密钥。详见 [设备验证](docs/device-verification.md)。
- **传输加密**：配对后，所有请求和实时连接都加密，本机回环也不例外。未配对时只能连接本机后端；后端密钥变化时会要求重新配对。
- **端到端加密的历史记录**：历史记录始终由你的设备持有的密钥加密；在设置恢复密钥之前，应用会一直提醒。
- **浏览器数据**：连接设置和偏好保存在当前浏览器配置的本地存储中，设备密钥封存在 IndexedDB 里，只有在 HTTPS 或 `localhost` 下才能保存。在共用电脑上，请使用 **设置 › 后端连接 › 清除数据**。任何能在本站源上执行脚本的东西（包括有特权的浏览器扩展）都能使用这些凭据，因此请部署经过审查的资源，并保留自带的内容安全策略（CSP）。

## 部署

官方镜像为 `ghcr.io/youtonghy/todex_web`（`linux/amd64` 和 `linux/arm64`，标签为各发行版本和 `latest`）。容器监听 `4173` 端口，以非特权用户、只读文件系统运行，健康检查地址为 `/healthz`，没有用户数据库。

```bash
docker run -d --name todex-web --restart unless-stopped --read-only \
  -p 4173:4173 ghcr.io/youtonghy/todex_web:latest
```

或使用仓库自带的 [`compose.yaml`](compose.yaml)：

```bash
cp .env.example .env   # 设置 TODEX_BACKENDS，可选设置 PORT
docker compose pull
docker compose up -d
```

用 `TODEX_WEB_TAG=1.2.3` 固定版本；升级执行 `docker compose pull && docker compose up -d`。

**固定后端的自主部署。** 把 `TODEX_BACKENDS` 设为逗号分隔的 `名称=URL` 列表，例如 `Home=http://192.168.1.20:7345,Office=https://office.lan:7345`。此时浏览器只与本站通信，所有请求（包括配对）都由服务器转发给这些后端，后端地址不会暴露给浏览器；工作台只显示这些后端，`/` 会跳转到 `/app`。每个浏览器仍需在每个后端上通过设备验证，且这些后端必须开启传输加密。详见 [自主部署](docs/self-hosting.md)。

不设置 `TODEX_BACKENDS` 时，每个浏览器直接连接自己的后端。请在前面放一个反向代理（Caddy、nginx、Traefik）负责 TLS 和 WebSocket 升级；HTTPS 页面要求后端使用 HTTPS/WSS，且每个后端都要在 `security.cors_origins`（或 `TODEX_AGENTD_CORS_ORIGINS`）中允许本站的源。

`GITHUB_TOKEN` 可选，只用于提高下载列表所用 GitHub API 的速率上限；服务器从 GitHub Releases 获取版本信息并缓存 10 分钟。

## 开发

需要 Node.js 22+、pnpm 11，并在本目录旁检出 [TodeX_protocol](https://github.com/youtonghy/TodeX_protocol)。在全新检出中安装依赖时，需要在 `HEROUI_AUTH_TOKEN` 中提供授权的界面组件包令牌。

```bash
pnpm install
pnpm dev     # 官网 http://127.0.0.1:5173，工作台 /app，演示 /demo
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
TODEX_BUILD_VERSION=1.2.3 pnpm build
HOST=0.0.0.0 PORT=4173 pnpm start
```

自行构建 Docker 镜像和发布流程见 [docs/self-hosting.md](docs/self-hosting.md) 与 [`compose.build.yaml`](compose.build.yaml)。官网素材见 [docs/website-assets.md](docs/website-assets.md)，应用图标见 [docs/app-icons.md](docs/app-icons.md)。

## 相关仓库

- [TodeX Desktop](https://github.com/youtonghy/TodeX_desktop)：桌面端应用
- [TodeX Backend](https://github.com/youtonghy/TodeX_backend)：运行 Agent 的后端 `todex-agentd`
- [TodeX Native](https://github.com/youtonghy/TodeX_native)：移动端应用
- [TodeX Container](https://github.com/youtonghy/TodeX_container)：内置后端和 Agent CLI 的 Docker 镜像
- [TodeX Protocol](https://github.com/youtonghy/TodeX_protocol)：桌面端和 Web 端共用的客户端库

## 许可证

MIT，见 [LICENSE](LICENSE)。
