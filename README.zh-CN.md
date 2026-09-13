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
- 相邻目录存在 `TodeX_app`，构建时复用其中的 `src/lib` 协议实现
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

生产服务提供网页和 `GET /healthz`，不包含 Backend 代理、用户数据库、服务端会话或密钥配置。

## 官网与下载清单

官网内容来自各项目 README。版本和平台选择使用 `src/renderer/site/releases.json` 中已发布的稳定版本及真实文件地址；准备发布官网时执行 `pnpm releases:refresh` 刷新。该命令只需访问公开 GitHub API，无需 token，官网访客不会请求 GitHub API。

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
