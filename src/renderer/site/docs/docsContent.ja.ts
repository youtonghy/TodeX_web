// Japanese docs content pack. Structure mirrors docsContent.en.ts:
// same slugs, same section keys — only title/description/body are translated.
import type { DocsLocalePack } from './docsContent';

const body = (markdown: string) => `${markdown.trim()}\n`;

export const jaDocs: DocsLocalePack = {
  sections: {
    'section-introduction': 'はじめに',
    'section-backend': 'バックエンド',
    'section-desktop': 'デスクトップ',
    'section-mobile': 'モバイル',
  },
  pages: {

    // ------------------------------------------------------------- Introduction

    'introduction': {
      slug: 'introduction',
      title: '概要',
      description: 'TodeX とは何か、各要素がどう組み合わさるか、どこから始めるか。',
      body: body(`
TodeX は**セルフホスト可能なマルチエージェント・コーディングワークベンチ**です。
1 つの Rust 製バックエンド —— \`todex-agentd\` —— が、普段使っている
コーディングエージェント（Codex、Claude Code、Pi、Devin、OpenCode、
Grok Build、および任意の ACP 互換エージェント）を単一の認証済み API の
背後でオーケストレーションします。デスクトップ、Web、モバイルの各
クライアントは暗号化されたチャネルで接続します。

TodeX のインフラ経由でプロキシされるものは何もありません。バックエンドは
自分のマシンまたはサーバー上で動作し、エージェントは自分自身の
アカウントと認証情報で実行され、コードが許可したワークスペースルートの
外に出ることはありません。

## 構成要素

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

| コンポーネント | 概要 |
| --- | --- |
| **バックエンド** | 会話、ワークスペース、プロバイダードライバー、セキュリティを管理するデーモン \`todex-agentd\`。 |
| **デスクトップ** | 3 ペイン構成のワークベンチを備えた Electron + React 19 クライアント。 |
| **Web** | このサイトが同じワークベンチを HTTP 経由で提供します —— インストール不要。 |
| **モバイル** | iPhone / iPad 向けネイティブ Swift + UIKit クライアント（開発中）。 |

## 特長

- **エージェント非依存。** 会話はプロバイダー非依存です。スレッドごとに
  エージェントを切り替えたり、同じワークスペース上で複数を並行実行したり
  できます。
- **永続的な会話。** すべての会話はバックエンドホスト上のフォルダー ——
  マニフェスト、追記専用イベントジャーナル、スナップショット、ネイティブ
  プロバイダー状態 —— として保存されるため、クライアントの再接続や
  デーモンの再起動をまたいでターンを再開できます。
- **フェールクローズドなセキュリティ。** デバイスは検証コードで登録され、
  すべてのリクエストは Ed25519 署名され、トランスポートはポスト量子の
  ML-KEM-768 にアップグレードできます。
- **フル機能のワークベンチ。** 承認付きストリーミングチャット、組み込み
  ターミナル、Git ステータスと差分、スキル/MCP カタログ、タスクボード ——
  デスクトップと Web で同一です。

## 次のステップ

| 目的 | ドキュメント |
| --- | --- |
| 10 分で動かし始める | [クイックスタート](/docs/introduction/quick-start) |
| 用語を学ぶ | [コンセプト](/docs/introduction/concepts) |
| バックエンドを運用する | [バックエンド概要](/docs/backend) |
| デスクトップアプリを使う | [デスクトップ概要](/docs/desktop) |
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: 'クイックスタート',
      description: 'バックエンドをインストールし、クライアントをペアリングして、最初のエージェント会話を開始します。',
      body: body(`
バックエンドを実行できるマシンと、少なくとも 1 つの認証済みエージェント
CLI（\`codex\`、\`claude\`、\`pi\`、\`devin\`、\`opencode\` …）が必要です。

## 1. バックエンドのインストール

macOS、Linux、または WSL で —— Rust ツールチェーンは不要です：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

このスクリプトは \`todex-agentd\` を \`~/.local/bin\` にインストールし、
リリースのチェックサムを検証し、実行中の管理対象デーモンを再起動します。
\`install.sh install --version 2.0.2\` でリリースを固定できます。また
\`cargo build --release\` でソースからビルドすることもできます。

## 2. 起動してデバイスを承認する

\`\`\`bash
todex-agentd tui
\`\`\`

TUI にはデーモンのステータス、ライブログ、ペアリングツールが表示されます。
クライアントが初めてアクセスを要求したら、\`d\` を押して検証コードを表示し、
クライアント側と照合してから \`a\` で承認（または \`r\` で拒否）します。
TUI を終了しても、デーモンはバックグラウンドで動作し続けます。

## 3. クライアントを接続する

- **デスクトップ** —— リリースページからパッケージをインストールし、
  Settings を開いてバックエンド URL（デフォルト \`http://127.0.0.1:7345\`）
  を入力します。デバイス検証を完了し、ポスト量子暗号が有効な場合は
  QR コードまたはペアリング JSON で暗号化公開鍵をインポートします。
- **Web** —— ホストされた TodeX サイトの \`/app\`、または独自デプロイが
  配信するページを開き、同様にバックエンドを指定します。

## 4. ワークスペースと会話を作成する

設定済みのワークスペースルート内にプロジェクトディレクトリを追加して
信頼済みとしてマークし、利用可能な任意のプロバイダーで会話を開始します。
プロンプト、承認、ターミナル、Git の状態はすべて同じ接続上で
ストリーミングされます。

## トラブルシューティング

| 症状 | 確認事項 |
| --- | --- |
| クライアントがバックエンドに接続できない | \`todex-agentd daemon status\`。ポートはデフォルトで 7345 |
| すべてのリクエストで \`401\` | デバイスが未承認 —— TUI で検証をやり直してください |
| REST は動作するが WebSocket が失敗する | 暗号化の不一致 —— バックエンドの公開鍵をインポートしてください |
| エージェントが利用不可と表示される | プロバイダー CLI がホストにインストールされていないか、ログインされていません |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: 'コンセプト',
      description: 'すべての TodeX 画面の背後にある用語：プロバイダー、ワークスペース、会話、デバイス。',
      body: body(`
## プロバイダーとプロバイダードライバー

*プロバイダー*とは、バックエンドが駆動できるエージェントエンジンのことです
—— Codex、Claude Code、Pi、Grok Build、Devin、OpenCode、または
\`config.toml\` で宣言された任意の ACP 2.0 プロファイル。各プロバイダーには
ネイティブドライバー（JSON-RPC app-server、stream-json、RPC、ACP stdio）が
あり、スキル、スラッシュコマンド、モデルカタログなどの機能は推測ではなく
インストール済み CLI から直接取得されます。

*プロバイダーアカウント*（cc-switch モデル）を使うと、エージェントごとに
複数のアカウントプロファイルを保持できます。TodeX はエージェント自身の
グローバル設定を書き換えることで 1 つを有効化するため、TodeX 外で開始
されたセッションも同じように動作します。

## ワークスペースと信頼

*ワークスペース*とは、設定済みの*ワークスペースルート*
（\`TODEX_AGENTD_WORKSPACE_ROOT\`、デフォルト \`~/projects\`）配下の
プロジェクトディレクトリです。新しいワークスペースはデフォルトで未信頼
です。信頼することは明示的でオーナー単位の判断であり、そこでエージェントが
何を実行できるかを制御します。信頼を解除すると、そのワークスペースの
アクティブなターンはキャンセルされます。

## 会話

会話は \`$DATA_DIR/conversations/<uuid>/\` 配下のフォルダーです：

| ファイル | 内容 |
| --- | --- |
| \`manifest.json\` | メタデータ、アクティブなプロバイダープロファイル、ワークスペース、タイムスタンプ |
| \`events.jsonl\` | 追記専用イベントジャーナル —— 履歴の信頼できる唯一の情報源 |
| \`snapshot.json\` | 高速な再読み込みのためのコンパクトな状態スナップショット |
| \`provider-state.json\` | ターン再開のためのネイティブエンジン状態 |

ターンは楽観的排他制御で保護されています。ターン実行中に 2 つ目の変更を
行うと、暗黙にキューイングされるのではなく \`409 Conflict\` が返されます。

## デバイスとペアリング

クライアントはパスワードでログインしません。各クライアント*デバイス*は
Ed25519 キーを生成して登録を要求します。バックエンドの TUI でコードを
照合して一度だけ承認します。それ以降、すべての HTTP リクエストには
デバイス署名が付与され、デバイスは個別に失効させることができます。

## トランスポート暗号化

| モード | 意味 |
| --- | --- |
| \`none\` | 平文（ループバックのみの構成向け） |
| \`x25519\` | X25519 + ChaCha20-Poly1305 |
| \`ml-kem-768\` | NIST ポスト量子 ML-KEM-768（ペアリング時のデフォルト） |

暗号化鍵は、デバイス承認とは別に、ペアリング QR コードまたは JSON
ペイロードを通じて交換されます。

## テナント

すべてのデータは \`tenant_id\` で名前空間化されており、クエリ、ジャーナル、
サブスクリプションがテナントをまたぐことはありません。
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: 'バックエンド概要',
      description: 'todex-agentd —— エージェント、会話、セキュリティを統括する Rust 製デーモン。',
      body: body(`
\`todex-agentd\` は TodeX の中核です。Tokio と Axum 上に構築された単一の
Rust バイナリで、イベントストリーム、承認、ターミナルセッションのために
1 つの REST サーフェス（\`/v2/*\`）と 1 つの多重化 WebSocket（\`/v2/ws\`）を
公開します。

## プロバイダードライバー

| プロバイダー | トランスポート | 備考 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`、\`turn\`、\`status\`、\`stop\`、\`attach\`、\`replay\`、\`interrupt\` |
| **Claude Code** | stream-json | Claude CLI を駆動。ゲートウェイなしで組み込みモデルエイリアスを使用 |
| **Pi** | Native RPC | コマンド検出、動的モデル、対話的ツール承認 |
| **Grok Build** | Managed CLI | 他の管理対象 CLI と同様にバージョン管理され、自己更新可能 |
| **ACP 2.0** | stdio profiles | Devin（\`devin acp\`）、OpenCode（\`opencode acp\`）、カスタム \`config.toml\` プロファイル |

バックエンドは UI を提供するためにプロバイダーのインストールを変更する
ことはありません。機能カタログ（スキル、MCP サーバー、スラッシュコマンド、
モデル）はプロジェクト優先（ユーザーよりプロジェクト）でライブに
イントロスペクトされ、スキルはアップロードではなく \`resourceId\` で
プロンプトに注入されます。

## 会話エンジン

すべてのターン状態は会話フォルダー内に存在し、スナップショットと
ネイティブプロバイダー状態とともに追記専用イベントとしてジャーナル化
されます。サブスクリプションはシーケンス番号（\`afterSequence\`）から
リプレイされるため、クライアントは再接続後もメッセージを失わずに
再同期できます。

## 1 つのソケット、多数のチャネル

\`/v2/ws\` は、会話のサブスクリプション、プロンプトディスパッチ、権限判定、
PTY ターミナルセッション、エンジン制御を単一の接続上で多重化します。
ハートビート検出と UTF-8 フレーム強制を備えています。

## デーモンの管理

\`todex-agentd\` には、ステータス、ログ、デバイス承認、ペアリング QR コード
のための対話型 TUI（\`todex-agentd tui\`）に加え、PID ファイル方式の
デーモンモード（\`daemon start|stop|restart|status\`）とログイン時自動起動
（\`daemon autostart enable\`）が付属しています。
[インストールと実行](/docs/backend/install)を参照してください。
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: 'インストールと実行',
      description: 'インストールスクリプト、ソースからのビルド、実行モード、アップデート。',
      body: body(`
## インストールスクリプト（macOS / Linux / WSL）

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

このスクリプトは \`~/.local/bin\` にインストールし（\`--prefix\` または
\`TODEX_INSTALL_DIR\` で変更可能）、\`SHA256SUMS\` を検証し、ロールバック用の
コピーを 1 つ保持し、実行中の管理対象デーモンを再起動します。ビルド済み
Linux バイナリには glibc 2.28 以降が必要です。Alpine などの musl
ディストリビューションではソースからビルドしてください。WSL は自動的に
検出されます。

\`--version\` で固定したバージョンは \`TODEX_AUTO_UPDATE=0\` の場合にのみ
維持されます。そうでなければ \`serve\`、\`tui\`、\`daemon start\` は起動時に
自己更新し、実行中のデーモンはエージェントが 5 分間実行されていなければ
新しいリリースへ再起動します。

## ソースからビルド

\`\`\`bash
cargo build --release
\`\`\`

Rust 1.80 以降（MSRV）が必要です。生成されるバイナリは \`todex-agentd\` です。

## 実行モード

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

TUI を終了してもデーモンは動作し続けます。ペアリング QR コードは
ターミナルのベタ塗りセルで描画されます。コードがターミナルに収まらない
場合は、QR ポップアップで \`b\` を押すと正方形の SVG 版がブラウザーで
開きます。
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '設定',
      description: 'config.toml、環境変数、およびその解決順序。',
      body: body(`
## 優先順位

1. コマンドライン引数
2. 環境変数
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`（デフォルト \`~/.todex-agent/config.toml\`）
4. 組み込みデフォルト

## オプション

| オプション | CLI フラグ | 環境変数 | デフォルト |
| --- | --- | --- | --- |
| ホスト | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| ポート | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| データディレクトリ | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| ワークスペースルート | \`--workspace-root\`（繰り返し指定可） | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| デフォルトエージェント | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex バイナリ | — | \`TODEX_AGENTD_CODEX_BIN\` | \`codex\` |
| Claude バイナリ | — | \`TODEX_AGENTD_CLAUDE_BIN\` | \`claude\` |
| Pi バイナリ | — | \`TODEX_AGENTD_PI_BIN\` | \`pi\` |
| デバイス認証 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| ペアリング暗号化 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |

## \`config.toml\` の例

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

> **注意：** \`enable_tls = true\` は、誤ったセキュリティ前提を防ぐため、
> ネイティブリスナーでは意図的にブロックされています。リモートアクセスが
> 必要な場合は、Nginx、Caddy、Cloudflare Tunnel などの信頼できる
> リバースプロキシで TLS を終端してください。
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: 'セキュリティとペアリング',
      description: 'デバイス検証、リクエスト署名、ワークスペース境界、トランスポート暗号化。',
      body: body(`
TodeX はフェールクローズドです。デバイスが明示的に承認されるまで
バックエンドと通信するものはなく、すべてのリクエストは暗号的に
署名されます。

## デバイス検証

各クライアントデバイスは Ed25519 キーペアを生成して登録を要求します。
このフローは人間による検証を伴います：

1. クライアントがランダムな検証コードを表示して待機します。
2. バックエンドの TUI で \`d\` を押してデバイスパネルを開き、コード全体を
   照合します。
3. \`a\` で承認、\`r\` で拒否します。承認済みデバイスは同じパネルに表示され、
   \`x\` で選択中のデバイスを失効させます。

承認後、すべての HTTP リクエストにはデバイス署名が付与され、未承認の
リクエストは \`401 Unauthorized\` で拒否されます。デバイス承認と
トランスポート暗号化は別の仕組みです。暗号化公開鍵は引き続き QR コード
または手動でインポートする必要があります。

## トランスポート暗号化

| モード | 暗号スイート | 用途 |
| --- | --- | --- |
| \`none\` | 平文 | ループバックのみの構成 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 一般的なリモートアクセス |
| \`ml-kem-768\` | NIST ポスト量子 ML-KEM | ペアリング時のデフォルト |

鍵はペアリング QR コード（ターミナルのベタ塗りセルで描画される
マルチフレーム ML-KEM セグメント、または \`b\` キーでブラウザーに描画される
SVG を含む）を通じて、またはペアリング JSON ペイロードのインポートに
よって交換されます。

## ワークスペース境界

\`workspace_roots\` はすべてのファイル／ディレクトリ API を許可された
スコープに制限し、クライアントはその外側を読み取れません。ワークスペース
単位の信頼はオーナー単位で、新しいワークスペースは未信頼で開始し、信頼を
取り消すとアクティブなターンがキャンセルされ、会話を削除せずに
ワークスペースが切り離されます。

## 分離

- **テナント** —— すべてのクエリ、ジャーナル、サブスクリプションは
  \`tenant_id\` でスコープされます。
- **サブプロセス** —— エージェント CLI はサニタイズされた環境で実行される
  ため、管理用の変数がプロバイダーセッションに漏れません。
- **TLS** —— ネイティブリスナーは \`enable_tls\` を拒否します。迂回手段に
  頼るのではなく、リバースプロキシで TLS を終端してください。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API リファレンス',
      description: '/v2 REST サーフェスと多重化 /v2/ws WebSocket。',
      body: body(`
すべてのエンドポイントは \`/v2\` 配下にあります。すべてのリクエストには
登録済みデバイスの署名が必要で、ボディとレスポンスは JSON です。

## システム

| エンドポイント | 用途 |
| --- | --- |
| \`GET /health\` | 生存確認プローブ |
| \`GET /v2/version\` | デーモンのバージョン、ワークスペースルート、ケイパビリティ |

## ワークスペース

| エンドポイント | 用途 |
| --- | --- |
| \`GET /v2/workspaces\` | 現在のテナントのキャッシュ済みワークスペース |
| \`PUT /v2/workspaces\` | ワークスペースキャッシュをマージ。正規の ID を返し、ワークスペース境界内で信頼判定が未決定のディレクトリを自動的に信頼する |
| \`GET \\| PUT /v2/workspaces/{id}/trust\` | オーナー単位の実行信頼を読み取り／変更する（新しいワークスペースは未信頼） |
| \`DELETE /v2/workspaces/{id}\` | 信頼を取り消し、アクティブなターンをキャンセルし、ワークスペースを削除する（会話は保持される） |
| \`GET /v2/workspace/entries?workspace=&query=\` | \`@\` ピッカー向けのファイル／フォルダー候補 |
| \`GET /v2/workspace/directories?path=\` | ディレクトリツリーの探索 |
| \`GET /v2/workspace/file?path=\` | サンドボックスルート内のファイルを読み取る |
| \`GET /v2/browser/fetch?url=\` | Web リソースのフェッチをプロキシする |

## プロバイダー

| エンドポイント | 用途 |
| --- | --- |
| \`GET /v2/providers\` | プロバイダーとそのアクティブ状態 |
| \`GET /v2/providers/versions\` | 各エージェントのインストール済み CLI バージョンと最新バージョン |
| \`POST /v2/providers/{provider}/install\` | 不足している管理対象 CLI をインストールする（ベンダー公式スクリプト） |
| \`POST /v2/providers/{provider}/upgrade\` | シングルフライト方式の CLI アップグレードを開始。エージェントの作業中はブロックされる |
| \`GET /v2/providers/upgrades/{operationId}\` | 非同期インストール／アップグレードの進捗と検証済みバージョン |
| \`GET /v2/providers/models?provider=&workspace=\` | プロバイダーのモデルカタログ |
| \`GET /v2/providers/commands?provider=&workspace=\` | スラッシュコマンドと拡張 |

プロバイダーアカウントは \`/v2/agent-providers/{agent}\` 配下にあり、
\`GET .../export\` と \`POST .../import\` で署名付き JSON ファイルとして
ホスト間でプロファイルを移動できます。

## 会話

| エンドポイント | 用途 |
| --- | --- |
| \`GET /v2/conversations\` | テナントの永続化された会話 |
| \`POST /v2/conversations\` | プロバイダーを指定して会話フォルダーを作成する |
| \`GET /v2/conversations/{id}\` | マニフェストと詳細 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | ページネーション付きイベントジャーナル。\`beforeSequence=N\` で遅延履歴のために後方へページング |
| \`POST /v2/conversations/{id}/prompt\` | ターンをディスパッチ —— テキスト、型付きコンテンツ、モデル、推論エフォート、スキルリソース ID |
| \`POST /v2/conversations/{id}/cancel\` | 実行中のターンをキャンセルする |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | 対話的な承認を解決する |

ターン実行中の 2 つ目の変更は \`409 Conflict\` を返します。ターンは暗黙に
キューイングされません。

## WebSocket — \`/v2/ws\`

1 つの接続で以下を多重化します：

- \`conversation.subscribe\` —— シーケンスベースの再開を備えたライブ
  イベントジャーナル
- プロンプトのディスパッチとキャンセル
- 権限判定
- \`terminal.open\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.close\` —— PTY セッション
- ローカル Codex エンジンのプロセス制御

フレームは UTF-8 の長さ制限を強制し、ハートビートが切断された接続を
検出します。

正式な仕様はバックエンドリポジトリの [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
です。
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: 'デスクトップ概要',
      description: 'Electron クライアント —— macOS、Windows、Linux 向けの 3 ペインワークベンチ。',
      body: body(`
TodeX Desktop は、Electron 44、React 19、Vite 7、Tailwind CSS v4、
HeroUI Pro で構築された \`todex-agentd\` 向けネイティブクライアントです。
Web クライアントと \`@todex/protocol\` トランスポートライブラリを共有して
いるためワークベンチは同一で、デスクトップアプリはその上にネイティブ統合を
追加しています。

## 3 つのペイン

- **左サイドバー** —— ワークスペースエクスプローラー、エージェントバッジ
  付きの会話履歴、スレッドライフサイクル（New、Rename、Fork、Delete）、
  クイック設定。
- **中央のチャット** —— Shiki ハイライトと KaTeX 数式を備えたストリーミング
  Markdown タイムライン、対話式の承認カード（コマンド、差分、ツール
  呼び出し）、モデル＋推論エフォートピッカー、\`@\` ファイルメンション、
  \`/\` スラッシュコマンド、\`#\` スキル/MCP サジェスト、Codex Fast モードを
  備えたプロンプトボックス。
- **右ワークベンチ** —— Slash Commands リファレンス、ライブ Git Diff、
  組み込み xterm.js PTY ターミナル、Skills/MCP Capabilities カタログ、
  Experiments を備えたタブ付きドロワー。

## デスクトップ専用機能

- ループバックワークスペース向けのネイティブファイル／ディレクトリ
  ピッカー。
- **ドラッグ＆ドロップペアリング** —— QR スクリーンショットをウィンドウに
  ドロップしてローカルでデコード（jsQR）するか、ペアリング JSON／分割
  された ML-KEM ペイロードを貼り付けます。
- Electron \`userData\` 永続化、\`contextBridge\` による安全な IPC
  （\`nodeIntegration: false\`）、ビルドごとの診断ログ。
- 到達不能なバックエンド、不正な URL、認証失敗、非推奨の \`/v1\`
  エンドポイント、WebSocket の不一致を区別する接続診断。

## リリース

ビルド済みパッケージは GitHub Releases から配布されます。Windows NSIS
（x64 + ARM64）、macOS Apple Silicon DMG、Linux x64 AppImage、SHA-256
チェックサム付き。開発ビルドについては[セットアップとビルド](/docs/desktop/setup)
を参照してください。
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: 'セットアップとビルド',
      description: '前提条件、開発モード、リリースパッケージング。',
      body: body(`
## 要件

- Node.js 22+、pnpm 11+
- 実行中の \`todex-agentd\` バックエンド（デフォルト \`http://127.0.0.1:7345\`）
- パッケージインストール用の HeroUI Pro ライセンストークン

## インストール

\`@heroui-pro/react\` はインストール時に認証を行うため、先にトークンを
エクスポートしてください：

\`\`\`bash
export HEROUI_AUTH_TOKEN="your_heroui_key"   # or: export HEROUI_AUTH_TOKEN="$HEROUI_KEY"
pnpm install
pnpm run dev
\`\`\`

> **警告：** トークンをリポジトリにコミットしないでください。

Electron バイナリのダウンロードが途中で失敗した場合は、
\`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\`
で修復してください。

## スクリプト

| コマンド | 説明 |
| --- | --- |
| \`pnpm run dev\` | predev チェックの後、Vite 開発モードでアプリを起動（1280×800 ウィンドウ） |
| \`pnpm run build\` | main、preload、renderer をビルド |
| \`pnpm run package\` | electron-builder でパッケージング |
| \`pnpm run preview\` | 本番ビルドをプレビュー |
| \`pnpm run typecheck\` | main + renderer ターゲットを型チェック |
| \`pnpm run check:electron\` | ネイティブ Electron バイナリを検証 |

## リリース

パッケージは **Release desktop packages** という GitHub ワークフローで
生成されます。\`1.2.3\` のような semver を入力すると、Windows NSIS
（x64 + ARM64）、macOS Apple Silicon DMG、Linux x64 AppImage、SHA-256
サムがリリースタグに公開されます。開発ビルドは \`DEV0.0.0\` と報告されます。
このワークフローには \`HEROUI_AUTH_TOKEN\` と、プロトコルリポジトリが
非公開の間は \`PROTOCOL_REPO_TOKEN\` という Actions シークレットが必要
です。macOS リリースには署名が必要です。デスクトップリポジトリの
\`docs/automatic-updates.md\` を参照してください。

## 開発ログ

\`DEV0.0.0\` とスタンプされたビルドは
\`userData/logs/todex-desktop-debug.log\` に診断情報を書き込みます
（\`TODEX_DESKTOP_LOG_PATH\` で上書き可能）。ログにはウィンドウ、IPC、
HTTP、WebSocket、未捕捉のエラーが含まれ、トークン、Cookie、鍵、
添付ファイルはマスクされます。
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: 'バックエンドへの接続',
      description: 'ペアリングフロー、デバイス検証、接続診断。',
      body: body(`
デスクトップアプリは REST + WebSocket で一度に 1 つのバックエンドと
通信し、すべてのリクエストはデバイスの登録済みキーで署名されます。

## ペアリング方法

| 方法 | 手順 |
| --- | --- |
| **デバイス検証** | ホスト／ポートで接続。アプリにコードが表示されるので、バックエンドの TUI で承認（\`d\` の後 \`a\`）すると、トークンが保存されます。 |
| **ドラッグ＆ドロップ QR** | QR スクリーンショットまたは画像ファイルをウィンドウにドロップ。jsQR でローカルにデコードされます。マルチフレーム ML-KEM セグメントに対応。 |
| **ペアリング JSON の貼り付け** | 分割された QR テキストを含む完全なペアリングペイロードを貼り付けます。 |
| **手動** | バックエンド URL を入力し、暗号化公開鍵を手動でインポートします。 |

デバイス承認と暗号化は別のステップです。ペアリング暗号化が \`x25519\` または
\`ml-kem-768\` の場合、デバイス承認後もクライアントにはバックエンドの
公開鍵（QR または手動インポート）が必要です。

## クライアントからのプロバイダー管理

ペアリングパネルには、バックエンドの Codex、Pi、Claude Code、Grok Build、
ACP CLI の一覧がインストール済みバージョンと最新バージョンとともに表示
され、不足している CLI をワンクリックでインストールし、管理対象
アップグレードを開始できます。プロバイダーアカウントは JSON ファイルと
してエクスポート／インポートでき、ホスト間でエージェント認証情報を同期
できます。このファイルには平文のキーが含まれるため、シークレットとして
扱ってください。

## 診断

| 状態 | 原因 | 対処 |
| --- | --- | --- |
| バックエンドに到達できない | \`/v2/version\` または \`/health\` が失敗 | \`todex-agentd\` を起動。ポートを確認 |
| 無効なバックエンド URL | URL を解析できない | \`http://127.0.0.1:7345\` 形式で指定 |
| 認証失敗 | HTTP 401/403 | デバイス検証をやり直す |
| 非推奨プロトコル | URL パスに \`/v1\` が含まれる | \`/v2\` に切り替える |
| WebSocket 失敗 | REST は動作するが \`/v2/ws\` が失敗 | ファイアウォール、トークン、暗号の不一致 —— 鍵を再インポート |
| エージェント利用不可 | プロバイダーが \`available = false\` を表示 | バックエンドホストでエージェント CLI をインストール／認証 |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: 'ワークベンチ',
      description: 'サイドバー、チャットパネル、ワークベンチタブ、キーボードショートカット。',
      body: body(`
ワークベンチはデスクトップと Web で同一です。このページではデスクトップの
用語を使用し、Web で異なる点は注記しています。

## 左サイドバー

上部にワークスペース、その下に会話が並びます。会話の行にはアクティブな
エージェントバッジと実行状態が表示されます。右クリックの操作には New、
Rename、Fork、Delete があります。ワークスペースは設定済みワークスペース
ルート配下の任意のディレクトリから追加でき、明示的に信頼されます。

## 中央 —— チャット

- Shiki コードハイライトと KaTeX 数式を備えたストリーミング Markdown。
- コマンド、ファイル差分、ツール呼び出しの承認カード —— ターン実行中に
  インラインで解決できます。
- プロンプトボックス：\`@\` でワークスペースファイルをメンション、\`@chat:\` で
  ワークスペース内の別の会話を Markdown ファイルとして添付、\`/\` で
  プロバイダーのスラッシュコマンドを実行、\`#\` でスキルや MCP
  ケイパビリティを参照。モデルピッカーは大文字小文字を区別せずに名前を
  マッチし、ドラッグ可能な推論エフォートコントロールと、プロバイダーが
  対応する場合は Codex Fast モードを備えています。
- 推論とツールの詳細は展開時に遅延マウントされ、最終回答はコンテキストや
  実行ノイズから分離されたまま保たれます。

## 右側 —— ワークベンチタブ

| タブ | 内容 |
| --- | --- |
| Slash Commands | プロバイダーのコマンドリファレンス |
| Git Diff | 作業ディレクトリの変更をライブ表示 |
| Terminal | 直接キーボード入力と自動リサイズを備えた組み込み xterm.js PTY |
| Capabilities | アクティブな Skills と MCP サーバーの読み取り専用カタログ |
| Experiments | 機能トグルと開発者向け診断 |

## キーボードショートカット

| キー | 操作 |
| --- | --- |
| ⌘B / Ctrl B | 左サイドバーの切り替え |
| ⌘⌥B / Ctrl Alt B | ワークベンチのアサイドパネルの切り替え |
| ⇧⌘G / Ctrl Shift G | Git 操作 |
| ⌘N（Web では ⌥N） | 新しい会話 |
| ⇧⌘N（Web では ⌥⇧N） | ワークスペースを追加 |
| ⇧⌘K / Ctrl Shift K | カンバンタスクボード |

> ブラウザーは ⌘N / ⇧⌘N を予約しているため、Web クライアントでは 2 つの
> 「新規」操作に Option 修飾キーを使います。その他はすべて同一です。

修飾キーをしばらく押し続けると、UI にショートカットのヒントバッジが
表示されます。
`),
    },

    // ------------------------------------------------------------------- Mobile

    'mobile': {
      slug: 'mobile',
      title: 'モバイル',
      description: 'ネイティブ iPhone / iPad クライアント —— 近日公開。',
      body: body(`
> **近日公開。** モバイルクライアントは現在開発中です。このページでは
> 計画されている内容を掲載しており、最初のベータ版のリリース時に完全な
> ドキュメントに置き換えられます。

Todex Mobile は iPhone / iPad 向けのネイティブ Swift + UIKit アプリで、
同じ \`todex-agentd\` バックエンドとペアリングします。同じワークスペース、
会話、承認、ターミナルセッションをポケットの中に。

## 予定されている機能

- **カメラペアリング** —— マルチフレーム ML-KEM セグメントを含む
  バックエンドの QR コードをスキャンするか、ペアリング JSON をインポート。
  デバイス検証はデスクトップと同じフローで動作します。
- **チャット + コンソール** —— 広い画面では 2 ペインレイアウト。片側に会話
  タイムライン、もう片側にターミナル、ファイル、ブラウザープレビュー、
  Git を備えたワークベンチ。
- **完全なターン制御** —— 承認、プランモードのフィードバック、モデルと推論
  ピッカー、メッセージキューイング、離席中に会話が終了したときのローカル
  通知。
- **同一のセキュリティモデル** —— Ed25519 デバイス署名と X25519 /
  ML-KEM-768 トランスポート暗号化。トークンは iOS Keychain に保存
  されます。

## リリースまでの間は

[Web クライアント](/docs/introduction/quick-start)は、到達可能な
バックエンドに対してモバイルブラウザーですでに動作します。同じ
ワークベンチ UI で、ネイティブシェルではないだけです。バックエンドの
ペアリングの詳細は[セキュリティとペアリング](/docs/backend/security)を
参照してください。
`),
    },
  },
};
