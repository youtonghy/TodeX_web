# TodeX 应用图标

Web 与桌面端共用两张 1024 × 1024 透明 PNG，保留原始设计和色彩。

| 深色米金 | 浅色 |
| --- | --- |
| ![TodeX 深色图标](../src/renderer/assets/brand/t-icon-dark-beige.png) | ![TodeX 浅色图标](../src/renderer/assets/brand/t-icon-light.png) |

侧栏、加载页和关于页通过 `AppIcon` 组件跟随应用明暗主题。README 和浏览器 favicon 按阅读环境的明暗主题选择版本；不支持主题选择的环境使用深色米金版。

## 资源用途

| 文件 | 用途 |
| --- | --- |
| `src/renderer/assets/brand/t-icon-dark-beige.png` | 深色源图及界面、文档展示 |
| `src/renderer/assets/brand/t-icon-light.png` | 浅色源图及界面、文档展示 |
| `src/renderer/assets/brand/favicon-dark.png` | 32 × 32 深色浏览器图标 |
| `src/renderer/assets/brand/favicon-light.png` | 32 × 32 浅色浏览器图标 |
| `src/renderer/assets/brand/apple-touch-icon.png` | 180 × 180 触屏书签图标 |
| `public/favicon.ico` | 包含 16–256 像素图层的浏览器兼容图标 |

HTML 和 React 中的 PNG 引用由 Vite 打包为带内容哈希的资源，`public/favicon.ico` 随静态网站复制到根目录。

## 更新与双端同步

1. 将同一套源 PNG 放入桌面端和 Web 端的 `src/renderer/assets/brand/`。
2. 在 macOS 的 `TodeX_desktop` 目录运行 `pnpm icons:generate`，生成各平台原生图标及浏览器派生图标。
3. 将桌面端的 `favicon-dark.png`、`favicon-light.png`、`apple-touch-icon.png` 同步到本项目同名目录，并将 `src/renderer/public/favicon.ico` 复制到本项目的 `public/favicon.ico`。
4. 同步 `AppIcon` 及其使用位置，在两端运行 `pnpm typecheck` 和 `pnpm build`。

Web 构建直接使用已生成的资源，不需要 macOS 图标工具。
