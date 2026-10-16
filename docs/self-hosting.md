# 自主部署（固定后端）

用发布的镜像即可自主部署，不需要自己构建。启动时用 `TODEX_BACKENDS` 指定这台 Web 服务的后端，可以有多个：

```bash
docker run -d --name todex-web --restart unless-stopped --read-only \
  -p 4173:4173 \
  -e TODEX_BACKENDS="家里=http://192.168.1.20:7345,公司=https://office.lan:7345" \
  ghcr.io/youtonghy/todex_web:latest
```

或在 `compose.yaml` 旁的 `.env` 中设置 `TODEX_BACKENDS`（见 `.env.example`），然后执行 `docker compose up -d`。

## 配置格式

- 各项用逗号（或换行）分隔，每项写 `名称=URL`，也可以只写 `URL`（此时名称是 `主机:端口`）。
- URL 可以是 `http`、`https`、`ws` 或 `wss`，可以带路径前缀（后端本身位于另一层反向代理之后），但不能带用户名密码、查询参数或片段。
- 每个后端的 id 由名称生成（小写字母、数字和 `-`，重名时依次加 `-2`、`-3`），作为代理路径 `/backend/<id>/`。改名会改变 id，浏览器需要重新配对该后端。
- 配置有误时容器启动失败，日志会说明是哪一项。启动成功后日志会列出每个后端的 id 与目标地址。

## 行为

设置了 `TODEX_BACKENDS` 时：

- 浏览器只访问本站。REST、`/v2/sealed` 隧道、WebSocket 和设备配对请求都发往 `/backend/<id>/…`，由服务端去掉前缀后转发给对应后端。后端地址不会下发给浏览器（`GET /api/config` 只返回 id 和名称）。
- `/app` 的后端列表固定为配置中的后端，顺序一致：不能添加、删除，也不能修改地址。名称、标签颜色、租户、连接/断开、设备验证与重新配对照常可用。浏览器此前在本站保存的其他后端会被清除；同一 id、同一地址的后端保留已配对的设备密钥。
- 访问 `/` 时跳转到 `/app`，`/docs` 仍然可用。
- CSP 的 `connect-src` 限制为 `'self'`，页面只能连本站。

不设置时与官网一致：用户自行添加后端，浏览器直接连接。

## 设备授权

代理不会绕过任何授权：

- 传输是端到端加密的（transport v2，公钥在设备验证时固定），代理只转发密文。
- 每台浏览器设备都要在每个后端的 TUI 里完成[设备验证](device-verification.md)才能使用。
- 代理把每个请求的 `Origin` 都改写为固定的非本机值，并去掉 `Cookie` 与 `X-Forwarded-*`。所以即使后端与 Web 服务在同一台机器上、用匿名模式只监听回环地址，经代理的请求也拿不到匿名访问。
- 客户端拒绝非本机地址的明文后端，所以**被代理的后端必须开启传输加密**（x25519 或 ml-kem-768），否则配对会被拒绝。

后端看到的请求来源是 Web 服务的地址：TUI 中配对申请的来源都显示为它，后端按来源 IP 的配对限流（每分钟 24 次创建）也由所有用户共享。核对设备时以验证码为准。

## HTTPS

在容器前放一个可信的反向代理（Caddy、nginx、Traefik）终止 TLS，并转发 WebSocket upgrade。因为浏览器只连本站，后端本身不需要 HTTPS、CORS 或 Private Network Access 设置，只需要能被 Web 容器访问到（例如在同一个 Docker 网络中，或使用局域网地址）。在 Docker 中访问宿主机上的后端时，请用 `host.docker.internal`（加上 `--add-host=host.docker.internal:host-gateway`）或宿主机的局域网地址，不要用容器内的 `127.0.0.1`。

## 开发

`TODEX_BACKENDS=… pnpm dev` 让 Vite 开发服务器提供相同的 `/api/config` 与 `/backend/<id>/` 代理。
