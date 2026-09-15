# TodeX Web

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/t-icon-dark-beige.png" />
    <source media="(prefers-color-scheme: light)" srcset="src/renderer/assets/brand/t-icon-light.png" />
    <img src="src/renderer/assets/brand/t-icon-dark-beige.png" alt="TodeX" width="160" height="160" />
  </picture>
</p>

根路径 `/` 为 TodeX 官网，原有无状态 Web 面板位于 `/app`。官网介绍产品并提供 Desktop 与 Backend 的官方版本下载，移动 App 暂缓发布。Node.js 只托管网页；面板中的每个浏览器通过 REST 和 WebSocket 直连各自的 `todex-agentd`。

## 环境要求

- Node.js 22 或更高版本
- pnpm 11.24.0
- 相邻目录存在 `TodeX_protocol`，构建时复用其中的 `src` 协议实现
- 浏览器可访问的 `todex-agentd`

## 开发与部署

```bash
export HEROUI_AUTH_TOKEN="<你的 HeroUI Pro 授权令牌>"
pnpm install
pnpm dev

TODEX_BUILD_VERSION=1.2.3 pnpm build
HOST=0.0.0.0 PORT=4173 pnpm start
```

CI 打包时应通过 `TODEX_BUILD_VERSION` 传入正式版本。开发构建显示
`DEV0.0.0`；`package.json` 保留格式合法的 `0.0.0` 占位版本。

渲染层沿用 TodeX Desktop 使用的 HeroUI Pro 布局，因此全新环境安装依赖时需要有效的 HeroUI Pro 授权令牌。

官网开发地址为 `http://127.0.0.1:5173`，面板地址为 `http://127.0.0.1:5173/app`。官网和面板独立加载，访问官网不会初始化面板或连接 Backend。同一 origin 下已有的 `todex.web.*` 浏览器数据继续可用，无需迁移；`/app/` 和 `/app/*` 子路径也支持直接访问和刷新。

生产服务提供网页、`GET /healthz` 和下载清单 `GET /api/releases`，不包含 Backend 代理、用户数据库或服务端会话。运行期只需 `HOST` 和 `PORT`；`GITHUB_TOKEN` 为可选项，仅用于提高 `/api/releases` 查询 GitHub API 的速率上限。

### Docker 部署

镜像发布在 `ghcr.io/youtonghy/todex_web`，按版本号打标签并附带 `latest`。容器监听 `4173`，以非特权 `node` 用户运行，并内置针对 `GET /healthz` 的健康检查。运行期只需 `HOST` 和 `PORT`，`GITHUB_TOKEN` 为可选项。

直接运行：

```bash
docker run -d --name todex-web --restart unless-stopped \
  -p 4173:4173 \
  ghcr.io/youtonghy/todex_web:latest
```

或使用仓库自带的 [`compose.yaml`](compose.yaml)：

```bash
cp .env.example .env   # 可选：修改 PORT 以更换宿主机端口
docker compose pull
docker compose up -d
docker compose logs -f web
```

用 `TODEX_WEB_TAG=1.2.3 docker compose up -d` 固定版本；升级时执行 `docker compose pull && docker compose up -d`。

```yaml
services:
  web:
    image: ghcr.io/youtonghy/todex_web:${TODEX_WEB_TAG:-latest}
    restart: unless-stopped
    ports:
      - "${PORT:-4173}:4173"
    environment:
      HOST: 0.0.0.0
      PORT: "4173"
```

请在容器前放置可信的反向代理（Caddy、nginx、Traefik）终止 TLS。HTTPS 页面连接非回环 Backend 时必须使用 HTTPS/WSS，且每个 Backend 都需要在 CORS（必要时还有浏览器 Private Network Access）中放行站点 origin。

#### 构建镜像

`docker` GitHub Actions 工作流需手动触发（**Actions → docker → Run workflow**）并填写版本号（如 `1.2.3`），会推送 `ghcr.io/youtonghy/todex_web:<version>`（默认同时打 `latest`）。仓库需配置 `HEROUI_KEY` secret（`hp_…` 密钥）供 `hpsetup` 拉取授权的 `@heroui-pro/react` 内容；`protocol_ref` 输入用于指定编译协议源码所用的 `youtonghy/TodeX_protocol` 分支或标签。

本地构建需要相邻目录的 `TodeX_protocol` 作为 `todexprotocol` 构建上下文，并在 shell 中导出 `HEROUI_KEY`。密钥通过 BuildKit secret 传入，不会写入镜像层。[`compose.build.yaml`](compose.build.yaml) 会为服务叠加 `build` 配置：

```bash
export HEROUI_KEY="hp_..."
docker compose -f compose.yaml -f compose.build.yaml up -d --build
# 可用 TODEX_PROTOCOL_DIR=/path/to/TodeX_protocol 和 TODEX_BUILD_VERSION=1.2.3 覆盖默认值
```

等价的 `docker buildx` 命令：

```bash
docker buildx build \
  --build-context todexprotocol=/path/to/TodeX_protocol \
  --secret id=HEROUI_KEY,env=HEROUI_KEY \
  --build-arg TODEX_BUILD_VERSION=1.2.3 \
  -t todex-web .
```

## 官网与下载清单

官网内容来自各项目 README。版本和平台选择由 Node 服务的 `GET /api/releases` 实时返回 GitHub Releases 数据（内存缓存 10 分钟；刷新失败时回退到最近一次成功的清单并标记 `stale`）。服务需要访问公开 GitHub API，可通过 `GITHUB_TOKEN` 提高速率上限，官网访客不会请求 GitHub API。

Desktop 和 Backend 的版本独立选择，下载链接直达 GitHub 官方文件，同时提供版本说明和 SHA256 校验文件。未发布的架构不显示下载入口，移动端仅显示暂缓发布状态。云空图片和生成提示词见[官网资源说明](docs/website-assets.md)。

公开部署应在可信反向代理终止 TLS。HTTPS 页面连接非 loopback Backend 时必须使用 HTTPS/WSS；Backend 还需允许站点来源的 CORS，并按网络位置配置浏览器 Private Network Access。

## 浏览器数据与凭据

连接配置、Backend token、工作区选择、布局偏好、事件 cursor 和有限缓存保存在浏览器 `localStorage` 的 `todex.web.*` 命名空间中。隔离边界是网站 origin 与浏览器配置文件，而不是 TodeX 账户。

同源脚本或具有页面权限的浏览器扩展可以读取这些凭据。部署时应使用经过审查且不可变的静态资源、保留项目提供的 CSP、不加载第三方脚本；共享设备使用后应在设置中执行“清除数据”。

## 验证

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 应用图标

桌面端与 Web 端使用同一套 T 图标，界面和文档按明暗主题展示。图标预览、文件用途与更新步骤见[图标资源说明](docs/app-icons.md)。
