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
Grok Build、Antigravity、omp、および任意の ACP 互換エージェント）を単一の認証済み API の
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
| 2.4 の変更点をライブのウォークスルーで見る | [2.4 の新機能](/docs/introduction/whats-new) |
| 10 分で動かし始める | [クイックスタート](/docs/introduction/quick-start) |
| 用語を学ぶ | [コンセプト](/docs/introduction/concepts) |
| バックエンドを運用する | [バックエンド概要](/docs/backend) |
| デスクトップアプリを使う | [デスクトップ概要](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: "2.4 の新機能",
      description: "プライベート会話、任意の返信からの分岐、ローカルとコンテナのバックエンド、署名付きリリース —— ライブのウォークスルー付き。",
      body: body(`
TodeX 2.4.0（2026 年 11 月）では、デスクトップアプリ、バックエンド、Web
ワークベンチを同時にリリースします。以下のウォークスルーはデモデータ上で
動く本物のワークベンチです。スクリプトが会話を開いてタスクを送信し、
エージェントがファイルを読み、編集し、テストする間の作業プロセスを
開きます。どのステップでも一時停止して見て回れますし、最初から再生し
直すこともできます。

:::demo

## 会話

- **プライベート会話** —— サイドバーから開始します（⌘⇧P / Ctrl Shift P、
  Web では ⌥⇧P）。内容はバックエンドのメモリ上にだけ存在し、ジャーナルも
  履歴キャッシュもなく、デーモンを再起動すると何も残りません。Claude Code、
  Codex、Pi はセッションファイルを一切書き込みません。omp、OpenCode、
  DeepSeek Harness は会話とともに削除される一時フォルダーにセッション
  ファイルを置きます（Linux と macOS）。
- **以前の返信から分岐** —— すべての返信に分岐ボタンがあります。新しい
  会話にはその返信までの履歴が引き継がれ、ワークスペースのファイルは
  そのまま残ります。Codex と Pi は任意の返信から、その他のエージェントは
  最新の返信から分岐できます。
- **ゴール** —— \`/goal <objective>\` で Codex にネイティブのゴールを渡します。
  プロンプトボックスの上のバーに状態、トークン数、経過時間が表示され、
  一時停止、再開、クリアができます。
- **コンパクション指示** —— Pi は \`/todex compact <instructions>\` を受け付けます。
- **編集を自動承認** —— Claude Code 向けの権限モードで、ファイル編集は
  承認し、コマンドは引き続き確認します。
- **バックグラウンド作業** —— エージェントがバックグラウンドタスクを
  待っている間も、プロンプトボックスとサイドバーの行は作業中のまま
  表示されます。

## サイドバーとプロフィール

- **統合レイアウト**（設定 → 外観 → サイドバーのレイアウト）では、各
  ワークスペースの会話がその下に入れ子で表示されます。
- ワークスペースとグループに**タグ**を付けられ、**タグでグループ化**で
  一覧をタグごとのセクションに分けられます。
- 「None」は**ワークスペースなし**になりました。
- **プロフィール**ページが使用量とクォータのダイアログに代わります ——
  サイドバー下部の ID カードを押してください。

## 設定

- **CLI 管理**は設定内に移り、エージェント CLI ごとに 1 ページとなり、
  **すべて更新**も備えています。
- **設定の同期**は、CLI アカウント、設定、MCP、Skill、SSH 接続を
  あるバックエンドから別のバックエンドへ、2 つを並べてコピーします。
- **履歴キャッシュ**（デスクトップ）は、最近表示した会話をまずこの
  デバイスから開きます。保存するのは暗号化されたコンテンツだけです。
- **Computer Use エンジン** —— 内蔵、または試験的な agent-desktop。

[設定](/docs/desktop/settings)を参照してください。

## バックエンドとコンテナ

- **ローカルバックエンド** —— デスクトップアプリがこのマシンの
  \`todex-agentd\` をデプロイ・実行し、ネットワークポートを使わずにローカル
  IPC で通信します。[ローカルバックエンド](/docs/desktop/local-backend)を
  参照してください。
- **TodeX コンテナ** —— Docker 内でバックエンドを実行し、コンテナ
  ワークスペースを作成できます。アイドル時の自動凍結と初期化コマンドにも
  対応しています。[コンテナ](/docs/desktop/containers)を参照してください。
- **omp（oh-my-pi）**が対応エージェントに加わりました。

## セキュリティ

- インストールスクリプト、バックエンドのアップデーター、デスクトップの
  アップデートは、\`SHA256SUMS.sig\` がリリース鍵で検証できたリリースだけを
  インストールします。
- バックエンドはデスクトップアプリ、ループバックのページ、指定したオリジン
  からのクロスオリジンリクエストにだけ応答し、プロキシ経由のリクエストは
  リモートとして扱います。[セキュリティとペアリング](/docs/backend/security)を
  参照してください。
- プライバシーフィルターは多くの国の ID 番号と電話番号を認識し、積極的な
  オプションも備えています。表示される SSH 出力では、フィルターされた値が
  スクラッチカード状のカバーの下に隠されます。
- ターミナルのホスト一覧に、\`ssh localhost\` を開く **Local** ホストが
  加わりました。
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
  だけを入力します。デバイス検証を完了すると、バックエンドの暗号化鍵も
  同時にピン留めされます。
- **Web** —— ホストされた TodeX サイトの \`/app\`、または独自デプロイが
  配信するページを開き、同様にバックエンドを指定します。

## 4. ワークスペースと会話を作成する

設定済みのワークスペースルート内にプロジェクトディレクトリを追加し、
利用可能な任意のプロバイダーで会話を開始します。
プロンプト、承認、ターミナル、Git の状態はすべて同じ接続上で
ストリーミングされます。

## トラブルシューティング

| 症状 | 確認事項 |
| --- | --- |
| クライアントがバックエンドに接続できない | \`todex-agentd daemon status\`。ポートはデフォルトで 7345 |
| すべてのリクエストで \`401\` | デバイスが未承認 —— TUI で検証をやり直してください |
| REST は動作するが WebSocket が失敗する | 暗号化の不一致 —— Settings でデバイスを再ペアリングしてください |
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
—— Codex、Claude Code、Pi、Grok Build、Devin、OpenCode、Antigravity、または
\`config.toml\` で宣言された任意の ACP 2.0 プロファイル。各プロバイダーには
ネイティブドライバー（JSON-RPC app-server、stream-json、RPC、ACP stdio）が
あり、スキル、スラッシュコマンド、モデルカタログなどの機能は推測ではなく
インストール済み CLI から直接取得されます。

*プロバイダーアカウント*（cc-switch モデル）を使うと、エージェントごとに
複数のアカウントプロファイルを保持できます。TodeX はエージェント自身の
グローバル設定を書き換えることで 1 つを有効化するため、TodeX 外で開始
されたセッションも同じように動作します。

## ワークスペース

*ワークスペース*とは、設定済みの*ワークスペースルート*
（\`TODEX_AGENTD_WORKSPACE_ROOT\`、デフォルト \`~/projects\`）配下の
プロジェクトディレクトリです。設定済みルート内のどのワークスペースでも、
エージェント、ターミナル、Git を実行できます。

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

バックエンドの暗号化鍵はデバイスのペアリング中に配布・検証されます。
検証コードはこの鍵を含めて計算されるため、コードを照合すれば鍵も
認証されます。

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

\`[api] enabled = true\` にすると、スクリプトやサービス向けに API キー認証の
REST + SSE API も提供します。[外部 API とキー](/docs/backend/external-api) を参照してください。

## プロバイダードライバー

| プロバイダー | トランスポート | 備考 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`、\`turn\`、\`status\`、\`stop\`、\`attach\`、\`replay\`、\`interrupt\` |
| **Claude Code** | stream-json | Claude CLI を駆動。ゲートウェイなしで組み込みモデルエイリアスを使用 |
| **Pi** | Native RPC | コマンド検出、動的モデル、対話的ツール承認 |
| **Grok Build** | Managed CLI | 他の管理対象 CLI と同様にバージョン管理され、自己更新可能 |
| **Antigravity** | stream-json | \`agy\` の print モードを駆動。\`~/.gemini/config\` に置く TodeX の PreToolUse フックがツールごとに承認（確認 / フルアクセス）。自動モードはアカウントで利用可能なら agy 自身の Auto 審査を使い（不可なら確認として動作）、TodeX の MCP ツールも提供 |
| **ACP 2.0** | stdio profiles | Devin（\`devin acp\`）、OpenCode（\`opencode acp\`）、omp（\`omp acp\`）、カスタム \`config.toml\` プロファイル |

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
\`TODEX_INSTALL_DIR\` で変更可能）、\`SHA256SUMS\` とその署名
\`SHA256SUMS.sig\` を検証し（インストール済みの \`todex-agentd\` または
OpenSSL 3 を使用）、ロールバック用のコピーを 1 つ保持し、実行中の管理対象
デーモンを再起動します。署名を検証できない場合は、\`--allow-unverified\` を
指定しない限りインストールを拒否します。2.3.6 までのリリースは署名がない
ため、警告を表示してチェックサムのみを確認します。バックエンド自身の
アップデーターも同様に、リリース鍵で署名されたリリースだけをインストール
します。ビルド済み
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
サーバーアドレスだけを含み、ターミナルのベタ塗りセルで描画されます。
コードがターミナルに収まらない場合は、QR ポップアップで \`b\` を押すと
正方形の SVG 版がブラウザーで開きます。認証情報ポップアップには
トランスポート鍵のフィンガープリントが表示されます。

## ヘッドレス管理

TUI を使えない環境 —— コンテナ内や SSH 越し —— では、同じ作業を
コマンドで行えます：

\`\`\`bash
todex-agentd pair list                    # pending pairing requests
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>
todex-agentd providers install codex claude --if-missing
\`\`\`

終了コード 2 は一致するものがなかったこと、3 はデーモンとは別のユーザーで
コマンドが実行されたことを意味します。デスクトップアプリは自分のマシン上の
バックエンドをデプロイ・管理することもできます ——
[ローカルバックエンド](/docs/desktop/local-backend)を参照してください。
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
| 外部 API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | 無効 / \`7346\` |
| ネットワーク待ち受け | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| ローカル IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | 有効 / \`<data_dir>/agentd.sock\` |
| 許可するブラウザーオリジン | — | \`TODEX_AGENTD_CORS_ORIGINS\` | なし |
| 信頼するプロキシ | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | なし |
| ペアリングのオリジン | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | なし |
| omp バイナリ | — | \`[agent]\` の \`omp_bin\` | \`omp\` |

\`network_enabled = false\` には IPC の有効化が必要です。このときバックエンドは
IPC ソケット（Windows では名前付きパイプ）経由でのみクライアントに応答し、
エージェントツールと \`/v2/version\` 用にランダムなループバックポートを
保持します。コンテナでのデプロイには独自の変数が加わります ——
[コンテナ](/docs/desktop/containers)を参照してください。

## \`config.toml\` の例

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

1. バックエンド URL だけを入力します。クライアントがランダムな検証コードと
   トランスポート鍵のフィンガープリント（\`XXXX-XXXX-XXXX-XXXX\`）を
   表示して待機します。
2. バックエンドの TUI で \`d\` を押してデバイスパネルを開き、コード全体を
   照合します。フィンガープリントはコードの横に表示されます。
3. \`a\` で承認、\`r\` で拒否します。承認済みデバイスは同じパネルに表示され、
   \`x\` で選択中のデバイスを失効させます。

承認後、すべての HTTP リクエストにはデバイス署名が付与され、未承認の
リクエストは \`401 Unauthorized\` で拒否されます。検証コードは
トランスポートプロトコルと公開鍵を含むトランスクリプトから計算されるため、
承認によってバックエンドの暗号化鍵も認証されます。クライアントは
デバイス鍵、暗号化プロトコル、公開鍵を一度にピン留めして接続します。

## トランスポート暗号化

| モード | 暗号スイート | 用途 |
| --- | --- | --- |
| \`none\` | 平文 | ループバックのみの構成 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 一般的なリモートアクセス |
| \`ml-kem-768\` | NIST ポスト量子 ML-KEM | ペアリング時のデフォルト |

鍵はデバイスのペアリングを通じてのみ配布され、鍵を個別にインポートする
方法はありません。Settings にはピン留めされたプロトコル、鍵の
フィンガープリント、検証状態が表示されます。ペアリング検証を経ずに
保存された鍵を持つプロファイルは、ループバックを含むすべてのホストで
再ペアリングするまで拒否されます。平文 \`none\` はループバック専用です。

## ブラウザーオリジンとプロキシ

バックエンドがクロスオリジンリクエストに応答するのは、デスクトップアプリ
（\`todex-desktop://app\`）、ループバックのページ、\`security.cors_origins\` に
列挙した完全一致のオリジンからのものだけです。\`Forwarded\`、
\`X-Forwarded-For\`、\`X-Real-IP\` を含むリクエストは、ループバックで届いても
リモートとして扱われるため、同じホスト上のリバースプロキシからループバック
専用のパスには到達できません。プロキシが転送するクライアントアドレスを
使うには、そのプロキシを \`security.trusted_proxies\` に列挙してください。
ペアリング要求には送信元のオリジンが表示されます。

## ローカル IPC

IPC ソケット（Windows では名前付きパイプ）は、デーモンを実行している
ユーザーだけを受け付けます。この経路ではクライアントにデバイス署名は不要で、
ローカル管理 API を使えます。\`network_enabled = false\` の場合、IPC が唯一の
入り口になります。[ローカルバックエンド](/docs/desktop/local-backend)を
参照してください。

## 署名付きリリース

すべてのリリースは、チェックサムに対する Ed25519 署名
\`SHA256SUMS.sig\` を公開します。\`install.sh\`、バックエンドのアップデーター、
デスクトップアプリのバックエンドデプロイ、デスクトップのアップデートは、
署名を検証できないリリースをすべて拒否します。

## プライベート会話

プライベート会話はデーモンのメモリ上にだけ保持されます。ジャーナルも
キーリングのエントリもなく、履歴ストレージにも計上されず、再起動すると
消えます。Claude Code、Codex、Pi はセッションファイルを書き込みません。
omp、OpenCode、DeepSeek Harness は一時フォルダー
（\`$XDG_RUNTIME_DIR/todex-private\`、次に \`/dev/shm\`、次にシステムの一時
フォルダー）にセッションファイルを書き込み、会話とともに削除されます
（Linux と macOS のみ）。Grok Build、Devin、Antigravity、ACP プロファイルは
プライベート会話を受け付けません。プライベート会話は分岐、予約、
コンパクション、別の会話からの参照ができません。それでもメモリの内容が
スワップやコアダンプに書き出される可能性はあり、エージェントのプロバイダーは
自身のポリシーに従ってリクエストを処理し、ワークスペースのファイルへの
編集は通常どおり保持されます。

## プライバシーフィルター

出力フィルターは、エージェントが見る内容からシークレットを隠します。
ID 番号（中国、香港、台湾、米国 SSN、英国、シンガポール、韓国、スペイン、
ブラジルはチェックディジットまたは形式で、パスポートなどその他は名称を
表す語の隣にある場合に）と電話番号（国際形式と複数の国の国内形式）を
認識します。既定でオフの**積極的なオプション**は、URL トークン、
高エントロピー文字列、UUID、メールアドレス、電話番号、パブリック IP も
対象にし、独自のキー名を最大 32 個追加できます。Agent SSH の出力ビューでは、
フィルターされた値はスクラッチカード状のカバーの下にあり、こすって
表示できます。

## ワークスペース境界

\`workspace_roots\` はすべてのファイル／ディレクトリ API を許可された
スコープに制限し、クライアントはその外側を読み取れません。ワークスペース
を削除するとアクティブなターンがキャンセルされ、会話を削除せずに
ワークスペースが切り離されます。

## 分離

- **テナント** —— すべてのクエリ、ジャーナル、サブスクリプションは
  \`tenant_id\` でスコープされます。
- **サブプロセス** —— エージェント CLI はサニタイズされた環境で実行される
  ため、管理用の変数がプロバイダーセッションに漏れません。
- **TLS** —— ネイティブリスナーは \`enable_tls\` を拒否します。迂回手段に
  頼るのではなく、リバースプロキシで TLS を終端してください。
- **API キー** —— [外部 API](/docs/backend/external-api) の各キーは自分の会話と、
  スコープ内のエージェントとワークスペースにしかアクセスできません。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API リファレンス',
      description: '/v2 REST サーフェスと多重化 /v2/ws WebSocket。',
      body: body(`
すべてのエンドポイントは \`/v2\` 配下にあります。すべてのリクエストには
登録済みデバイスの署名が必要で、ボディとレスポンスは JSON です。

スクリプトやサービス向けの API キー呼び出しは別のポートと \`/api/v1\` を使います。
[外部 API とキー](/docs/backend/external-api) を参照してください。

## システム

| エンドポイント | 用途 |
| --- | --- |
| \`GET /health\` | 生存確認プローブ |
| \`GET /v2/version\` | デーモンのバージョン、ワークスペースルート、ケイパビリティ |

## ワークスペース

| エンドポイント | 用途 |
| --- | --- |
| \`GET /v2/workspaces\` | 現在のテナントのキャッシュ済みワークスペース |
| \`PUT /v2/workspaces\` | ワークスペースキャッシュをマージ。正規の ID を返す |
| \`DELETE /v2/workspaces/{id}\` | アクティブなターンをキャンセルし、ワークスペースを削除する（会話は保持される） |
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
- \`terminal.start\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.stop\` —— PTY セッション。\`terminal.attach\` で実行中のターミナルに再接続し、直近の出力を再生
- ローカル Codex エンジンのプロセス制御

フレームは UTF-8 の長さ制限を強制し、ハートビートが切断された接続を
検出します。

正式な仕様はバックエンドリポジトリの [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
です。
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: '外部 API とキー',
      description: 'バックエンドが管理する API キーで、スクリプトやサービスから REST + SSE でエージェントを呼び出します。',
      body: body(`
デバイス用ポート（7345）に加えて、\`todex-agentd\` は別のポートで
スクリプト、CI ジョブ、その他のサービス向けの REST + SSE API を提供できます。
認証には**バックエンドが発行する API キー**を使い、デバイスのペアリングも
transport v2 も不要で、TodeX が扱うすべてのエージェントを実行できます。
daemon の会話エンジンを共有しますが、各キーは自分の会話しか参照できません。

## 有効化

このリスナーは**デフォルトで無効**です。\`config.toml\` の
\`[api] enabled = true\`、\`--enable-api\`、または
\`TODEX_AGENTD_API_ENABLED=true\` で有効にします。TUI の設定からも切り替えと
ポート変更ができます（次回起動時に反映）。

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # TLS 終端プロキシの背後でのみ
\`\`\`

API ポートはメインポートと別にする必要があります。キーは bearer 資格情報なので、
\`api.host\` がループバック以外の場合は \`allow_plaintext_remote = true\` が
ないと起動を拒否します。リモートで使うときは前段に TLS リバースプロキシを
置いてください。CORS はないため、ブラウザからのクロスオリジン呼び出しは
できません。

## キーの発行と管理

キーは \`tdx_<id>_<secret>\` の形式で、作成時に**一度だけ**表示されます。
バックエンドは \`<data_dir>/api-keys.json\`（0600）に secret のハッシュだけを
保存するため、このファイルだけでは認証も復号もできません。

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

TUI には **API Keys** パネルがあります（\`i\`：\`n\` 新規、\`a\` 承認ポリシー
切り替え、\`x\` を 2 回で失効）。ペアリング済みデバイスは
\`GET/POST /v2/api-keys\`、\`PATCH/DELETE /v2/api-keys/{id}\` も使えます。
変更は daemon を再起動せずに反映され、失効または期限切れのキーには即座に
\`401\` が返り、実行中のターンはキャンセルされます。

各キーには次の設定があります。

- **エージェント** — 使用できるエージェント（既定はすべて）。
- **ワークスペース** — 使用できる絶対パス（サブディレクトリを含む、既定は
  すべてのワークスペースルート）。
- **承認** — 権限リクエストの扱い：\`ask\`（既定、呼び出し側が回答）、
  \`auto-approve\`、\`reject\`。特定デバイスに紐づくリクエストがキーの代わりに
  承認されることはありません。
- **有効期限** — 任意。

API の会話ではエージェント自身のツールのみを使い、TodeX の SSH・デスクトップ・
ブラウザツールは注入されません。ターンで権限モードやサンドボックスモードを
上書きすることもできず、キーの承認ポリシーが適用されます。

## エンドポイント

\`http://127.0.0.1:7346\` に \`Authorization: Bearer <key>\`
（または \`X-API-Key\`）を付けて送信します。

| エンドポイント | 用途 |
| --- | --- |
| \`GET /api/v1/health\` | 死活確認（キー不要） |
| \`GET /api/v1/me\` | 呼び出し元のキーとスコープ、承認ポリシー |
| \`GET /api/v1/agents\` | キーが使えるエージェント |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | ライブのモデル一覧 |
| \`GET /api/v1/workspaces\` | キーが使えるワークスペース |
| \`POST /api/v1/conversations\` | 会話を作成：\`{agent, workspace, title?}\` |
| \`GET /api/v1/conversations\` | キーの会話一覧 |
| \`GET / DELETE /api/v1/conversations/{id}\` | 会話の取得・削除 |
| \`POST /api/v1/conversations/{id}/turns\` | ターン開始：\`{text, model?, reasoningEffort?}\`。\`Accept: text/event-stream\` でストリーム |
| \`GET /api/v1/conversations/{id}/events?after=&limit=\` | イベントのページ（平文） |
| \`GET /api/v1/conversations/{id}/events/stream\` | SSE：履歴の後にライブイベント。\`Last-Event-ID\` で再開 |
| \`POST /api/v1/conversations/{id}/cancel\` | 実行中のターンをキャンセル |
| \`POST /api/v1/conversations/{id}/permissions/{permissionId}\` | 権限リクエストに回答 |
| \`POST /api/v1/runs\` | 1 回の呼び出しで新しい会話と 1 ターンを実行（ストリームまたは完了待ち） |

SSE イベントは \`id: <sequence>\`、\`event: <type>\` と、\`data\` にイベント JSON を
持ちます。15 秒ごとに \`: \` の keepalive が送られます。エラーは \`/v2\` と同じ
\`{"code", "message"}\` 形式です。

## ワンショット実行

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"README を要約して"}' \\
  http://127.0.0.1:7346/api/v1/runs
# {"conversationId":"…","turnId":"…","status":"completed","output":"…","error":null}

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"TODO を一覧にして","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

\`stream\` を指定しない場合はターンの完了を待ちます（\`timeoutSecs\` 既定 600、
最大 3600。タイムアウトするとターンをキャンセルして \`504\` を返します）。

## 履歴は暗号化されたまま

会話履歴はディスク上で常にエンドツーエンド暗号化されています。各キーは
secret から専用の履歴受信者を導出し、そのキー自身の会話だけがそれ向けに
ラップされます。そのキーでのリクエストを処理する間、バックエンドはメモリ上で
イベントを復号して平文で返し、キーから導出したものは何も保存しません。
データディレクトリが盗まれても履歴は読めず、キーが漏れても露出するのは
そのキーの会話だけです。

正式な仕様はバックエンドリポジトリの
[docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
にある「外部 API（API Key）」の章です。
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
  呼び出し）、モデル＋推論エフォートピッカー、\`@\` 参照メニュー（ファイル・フォルダー・会話・スキル・MCP）、
  \`/\` スラッシュコマンド、\`#\` スキル/MCP サジェスト、Codex Fast モードを
  備えたプロンプトボックス。
- **右ワークベンチ** —— Slash Commands リファレンス、ライブ Git Diff、
  組み込み xterm.js PTY ターミナル、Skills/MCP Capabilities カタログ、
  Experiments を備えたタブ付きドロワー。

## デスクトップ専用機能

- [ローカルバックエンド](/docs/desktop/local-backend)：このマシンの
  バックエンドをデプロイ・実行し、IPC で接続します。
- [コンテナ](/docs/desktop/containers)：Docker でバックエンドを実行し、
  コンテナワークスペースを作成します。
- 最近表示した会話のための、デバイス上の履歴キャッシュ。
- ループバックワークスペース向けのネイティブファイル／ディレクトリ
  ピッカー。
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
| **デバイス検証** | バックエンド URL を入力。アプリにコードとトランスポート鍵のフィンガープリントが表示されるので、バックエンドの TUI で承認（\`d\` の後 \`a\`）すると、暗号化鍵がピン留めされて接続します。 |

Settings にはピン留めされたプロトコル、鍵のフィンガープリント、検証状態が
表示されます。**再ペアリング** で検証をやり直せます。バックエンドの
アドレスを変更すると、ピン留めされた鍵はクリアされます。

同じマシン上のバックエンドであれば、デスクトップアプリはこれらをすべて
省略してローカル IPC で接続できます ——
[ローカルバックエンド](/docs/desktop/local-backend)を参照してください。
コンテナのバックエンドでは、デバイスを承認する \`todexc\` / \`docker exec\`
コマンドが表示されます —— [コンテナ](/docs/desktop/containers)を参照して
ください。

## クライアントからのプロバイダー管理

**設定 → CLI 管理**には、バックエンドのエージェント CLI がインストール済み
バージョンと最新バージョンとともに一覧表示され、不足している CLI の
インストールや、複数のアップグレードの同時実行ができます
（[設定](/docs/desktop/settings)を参照）。**設定の同期**は、アカウント、設定、
MCP、Skill、SSH 接続を 2 つのバックエンド間でコピーします。プロバイダーアカウントは JSON ファイルと
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
| WebSocket 失敗 | REST は動作するが \`/v2/ws\` が失敗 | ファイアウォール、トークン、暗号の不一致 —— デバイスを再ペアリング |
| エージェント利用不可 | プロバイダーが \`available = false\` を表示 | バックエンドホストでエージェント CLI をインストール／認証 |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: 'ワークベンチ',
      description: 'サイドバー、チャットパネル、ワークベンチタブ、キーボードショートカット。',
      body: body(`
ワークベンチはデスクトップと Web で同一です。このページではデスクトップの
用語を使用し、Web で異なる点は注記しています。まずは動いている様子を
見てください —— このウォークスルーはデモデータ上の本物の UI を
スクリプトで操作したものです：

:::demo

## 左サイドバー

上部にワークスペース、その下に会話が並びます。**サイドバーのレイアウト →
統合**（設定 → 外観）にすると、各ワークスペースの下にその会話が 1 ページ
5 件ずつ入れ子で表示されます。会話の行にはアクティブなエージェントバッジと
実行状態が表示され、エージェントがバックグラウンドタスクを待っている間も
作業中として表示されたままになります。右クリックの操作には New、Rename、
Fork、Delete があります。ワークスペースは設定済みワークスペースルート配下の
任意のディレクトリ、または[コンテナ](/docs/desktop/containers)内から
追加できます。

- **タグ** —— ワークスペースでは**タグを編集**、グループでは**グループの
  タグを編集**を使います。ワークスペースのヘッダーにあるタグボタンで
  **タグでグループ化**がオンになり、タグごとに 1 セクション、最後に
  **タグなし**が表示されます。
- **ワークスペースなし**（旧「None」）には、ワークスペースのない会話が
  入ります。複数のバックエンドがある場合は、1 つの組み込みグループに
  まとめられます。
- **プライベート会話** —— **プライベート会話を新規作成**（⌘⇧P / Ctrl Shift
  P）でエージェントを選び、バックエンドのメモリ上にだけ存在する会話を
  開始します。バッジと通知が表示されます。
  [セキュリティとペアリング](/docs/backend/security)を参照してください。
- **プロフィール** —— 下部の ID カードを押すとプロフィールページが開き、
  使用量、プランのクォータ、アクティビティを確認できます。

## 予約会話とオプション機能

- **予約会話** — サイドバー（またはカンバンのタスク）から時刻を選んで作成します。
  会話はすぐに作成され、そこで送信した内容はバックエンドのキューに保持され、
  指定時刻に順番どおり送信されます。サイドバーの行にはカウントダウンアイコンが
  表示され、入力欄の上のバーから「今すぐ送信」「時刻を変更」「キャンセル」が
  行えます。
- **機能**（設定 → 機能）— 予約会話・ターミナル・カンバンボードは、サイドバーに
  表示、「その他」にまとめる、またはオフにできます（ショートカットとメニュー項目も
  削除されます）。デバイスごとに保存されます。
- **接続** — バックエンドの読み込み中はサイドバーに「バックエンドの読み込み完了を
  待っています」と表示し、失敗にせず最大 2 分間再試行します。アクティブな会話の
  エージェントは事前に起動され、最初のメッセージが速く始まります。

## 中央 —— チャット

- Shiki コードハイライトと KaTeX 数式を備えたストリーミング Markdown。
- コマンド、ファイル差分、ツール呼び出しの承認カード —— ターン実行中に
  インラインで解決できます。
- プロンプトボックス：\`@\` で参照メニューを開き、種類を選んでから検索
  （\`@file:\`、\`@folder:\`、ワークスペース内の別の会話を Markdown ファイルとして添付する
  \`@chat:\`、\`@skill:\`、\`@mcp:\`）、\`/\` で
  プロバイダーのスラッシュコマンドを実行、\`#\` でスキルや MCP
  ケイパビリティを参照。モデルピッカーは大文字小文字を区別せずに名前を
  マッチし、ドラッグ可能な推論エフォートコントロールと、プロバイダーが
  対応する場合は Codex Fast モードを備えています。
- 推論とツールの詳細は展開時に遅延マウントされ、最終回答はコンテキストや
  実行ノイズから分離されたまま保たれます。
- 返信の下の**この返信から分岐**は、そこまでの履歴を持つ新しい会話を
  開始します（ワークスペースのファイルは巻き戻されません）。Codex と Pi は
  任意の返信から、その他のエージェントは最新の返信からのみ分岐できます。
- **\`/goal <objective>\`**（Codex）はネイティブのゴールを設定します。
  プロンプトボックスの上のゴールバーに状態と使用量が表示され、一時停止、
  再開、クリアができます。Pi は \`/todex compact <instructions>\` を
  受け付けます。
- 権限ピッカーには Claude Code 向けの**編集を自動承認**があります。
  ファイル編集は承認され、コマンドは引き続き確認されます。

## 右側 —— ワークベンチタブ

| タブ | 内容 |
| --- | --- |
| Slash Commands | プロバイダーのコマンドリファレンス |
| Git Diff | 作業ディレクトリの変更をライブ表示 |
| Terminal | 再接続・再読み込み後も出力が戻る組み込み xterm.js PTY（WebGL）。検索、リンク、シェル統合、コマンド終了通知に対応 |
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
| ⇧⌘P（Web では ⌥⇧P） | プライベート会話を新規作成 |
| ⌘L / Ctrl L | クイック検索（会話とその内容） |
| ⌘1…⌘9 / Ctrl 1…9 | ワークベンチのタブを選択 |
| ⇧⌘K / Ctrl Shift K | カンバンタスクボード |
| ⇧⌘T（Web では ⌥⇧T） | ターミナルビュー（SSH ホスト・鍵・リモートファイル） |

> ブラウザーは ⌘N / ⇧⌘N / ⇧⌘T を予約しているため、Web クライアントでは 2 つの
> 「新規」操作とターミナルビューに Option 修飾キーを使います。その他はすべて同一です。

## ターミナル

ターミナル内（macOS は ⌘、Linux と Windows は Ctrl Shift）：

| キー | 操作 |
| --- | --- |
| ⌘C / Ctrl Shift C | コピー（テキスト選択中は Ctrl C でもコピー） |
| ⌘V / Ctrl Shift V | 貼り付け |
| ⌘F / Ctrl Shift F | 検索 |
| ⌘K / Ctrl Shift K | クリア |
| ⌘↑ ⌘↓ / Ctrl Shift ↑ ↓ | 前 / 次のプロンプト |

右クリックでも同じ操作ができます。Ctrl/⌘ クリックでリンクや、
ワークスペース内ファイルへの \`パス:行\` 参照を開きます。bracketed paste を
使わないプログラムに複数行を貼り付けるときは確認が表示されます。

**シェル統合**（設定 → 外観 → ターミナル、既定でオン）は、新しい bash・
zsh・fish ターミナルに小さなスクリプトを読み込みます。各プロンプトに印を
付け（失敗したコマンドは赤）、パス欄をシェルのディレクトリに追従させ、
コマンド実行中のタブを閉じる前に確認し、見えていない間に終わった
10 秒以上のコマンドを通知します。プログラムも OSC 9 / OSC 777 で
通知を送れます。

**画像。** クリップボードにテキストがないときに画像を貼り付けるか、画像ファイルを
ターミナルにドロップすると、TodeX はターミナルが動いているマシン（バックエンドの
マシン、または SSH ホストの \`~/.cache/todex/paste\`）に保存してそのパスを貼り付け、
Claude Code と Codex が画像として添付します。貼り付けた画像は 7 日後に削除されます。
Ctrl V は引き続きプログラムに送られます。

**再接続。** 離れている間もターミナルは動き続けます。アプリが再接続・再読み込み
すると続きから表示し、その出力がもう保持されていない場合はバックエンドが現在の
画面を送るため、vim や Claude Code などの全画面プログラムもそのまま戻ります。

修飾キーをしばらく押し続けると、UI にショートカットのヒントバッジが
表示されます。
`),
    },

    // ------------------------------------------------------------------- Mobile

    'desktop/settings': {
      slug: 'desktop/settings',
      title: "設定",
      description: "CLI 管理、バックエンド間の設定の同期、履歴キャッシュ、Computer Use エンジン。",
      body: body(`
設定は左側のレールにグループ分けされています。このページでは 2.4 で
変わった部分を扱います。バックエンド関連のページ（[ローカルバックエンド](/docs/desktop/local-backend)、
[コンテナ](/docs/desktop/containers)）には専用のドキュメントがあります。

## CLI 管理

**設定 → CLI 管理**には、バックエンドのエージェント CLI（Codex、Claude
Code、Pi、Grok Build、omp、ACP プロファイル）がインストール済みバージョンと
最新バージョンとともに一覧表示されます。複数の CLI を同時にインストール・
アップグレードでき、**すべて更新**は保留中のアップグレードをすべて実行します。
コンテナイメージに同梱された CLI には代わりに「イメージと一緒に更新」と
表示されます。

各 CLI はタブ付きの専用ページを開きます：

| タブ | 内容 |
| --- | --- |
| 設定 | CLI 自体の設定とプロバイダープロファイル |
| MCP / Skill | 選択したバックエンドの MCP サーバーと Skill |
| アカウント | プロバイダーアカウントと API キー |
| クリーンアップ | バックエンド上の CLI のネイティブセッション |
| プラグイン | omp プラグイン：インストール、アップグレード、削除、オン／オフ |

一覧上部の**共有 MCP / Skill** では、すべてのエージェントが参照するものを
管理します。プロバイダープロファイルの有効化や削除の前には確認があり、
CLI のグローバル設定で何が変わるかが示されます。Claude Code の設定は最初の
有効化の前にバックアップされます。Codex のアカウントフォームはベース URL
からモデル一覧を取得でき、推論エフォートとコンテキストウィンドウの
プリセットを設定します —— フィールドを空にすると、そのキーが
\`config.toml\` から削除されます。

## 設定の同期

**設定 → Backend 接続 → 設定の同期**では、2 つのバックエンドを並べて
表示します。読み取り元の**同期元 Backend** と書き込み先の**同期先 Backend**
で、どちらもライブで表示されます。コピーする対象を選びます：

- CLI アカウント
- 設定
- MCP サーバー
- Skill
- SSH 接続

書き込まれるのは新規と変更された項目だけで、同期先のものは何も削除され
ません。シークレットは画面上でマスクされます。パスワードでログインする
SSH ホストと秘密鍵は同期されません —— 先に同期先へ鍵を置いてください。

## ストレージと履歴キャッシュ

**設定 → 一般 → ストレージ**に**最近の会話をこのデバイスにキャッシュ**
（デスクトップ、既定でオン）があります。最近表示した会話はまずこの
デバイスから開き、バックエンドから追いつき、切断中も読むことができます。

- 保存するのはバックエンドが送った暗号化コンテンツだけで、平文は保存
  しません。
- 最大 100 件の会話について最新 300 イベント、合計 200 MB までで、
  最も長く使われていないものから削除されます。
- 会話を削除するとその会話のキャッシュが、デバイスが失効するかバックエンドが
  削除されるとキャッシュ全体が破棄されます。
- **キャッシュを消去**は、このデバイスのコピーだけを削除します。

プライベート会話はキャッシュされません。Web クライアントは履歴キャッシュを
持ちません。

## Computer Use エンジン

Computer Use のページには**エンジン**の選択肢があります。**内蔵**、または
**agent-desktop（試験的）**で、後者はバックエンドが初回使用時にダウンロード
し、準備完了、ダウンロード中、インストールに失敗しました、未インストールの
いずれかの状態を表示します。

## 外観

**サイドバーのレイアウト**は、**分割**（ワークスペースと会話を別々の
一覧に表示、既定）と**統合**（会話をそのワークスペースの下に入れ子で
表示）を切り替えます。ターミナルのシェル統合もここにあります。
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: "ローカルバックエンド",
      description: "デスクトップアプリからこのマシンのバックエンドをデプロイし、ローカル IPC で接続します。",
      body: body(`
デスクトップアプリは、インストールされているマシン上で \`todex-agentd\` を
実行し、**ローカル IPC** —— Unix ソケット、Windows では名前付きパイプ ——
で通信できます。この経路は自分のユーザーアカウントだけが開けるため、
ネットワークポートもデバイス検証も必要ありません。

## デプロイと接続

**設定 → ローカルバックエンド**を開きます。**このマシン**カードは、
TodeX Desktop と同じバージョンの \`todex-agentd\` を実行します：

1. **デプロイして接続**は、バックエンドをダウンロードして署名を検証し、
   起動し、このアプリをペアリングして IPC で接続します。
2. その後、カードには**起動して接続**、**再起動**、**停止**、
   **再ペアリング**、**ログを表示**が表示されます。

デスクトップアプリは、\`SHA256SUMS.sig\` がリリース鍵で検証できた
バックエンドリリースだけをインストールします。署名のない古いリリース
（2.3.6 まで）は、このアプリがペアリングするバージョンと完全に一致する
場合にのみ受け付けます。

起動オプションは**ログイン時に起動**と **TodeX 終了時に停止**です（後者は
既定でオフで、バックエンドは他のデバイスへのサービスを続けます）。
待ち受けのセクションでは、待ち受けアドレス（既定 \`127.0.0.1\`）、ポート、
ペアリング暗号化を設定します。

同じページで、ワークスペースルートの編集、リモートアクセス用のペアリング
QR コードとトランスポート鍵のフィンガープリントの表示、ペアリング要求の
承認・拒否、デバイスの失効、バックエンドのリセットができます。

## 既存の接続を IPC に切り替える

ループバック接続（\`http://127.0.0.1:7345\`）の接続先バックエンドが IPC にも
対応している場合、アプリは **IPC に切り替え**を提案します。IPC でその
デーモンに接続すると、対応する TCP プロファイルはオフになり、データは
IPC プロファイルに移ります。この提案は **IPC 接続への切り替えを提案**で
オフにできます。

## ネットワーク待ち受けをオフにする

バックエンドをこのアプリだけが使う場合は、**ネットワーク待ち受け**を
オフにします。オフにできるのはアプリが IPC で接続している間だけで、確認の
うえ、再起動後に反映されます。その後バックエンドは、エージェントツールと
\`/v2/version\` 用のランダムなループバックポートだけを保持します。
バックエンドの TUI では同じ切り替えが \`b\` キー、\`config.toml\` では
\`network_enabled = false\` です（[バックエンドの設定](/docs/backend/configuration)を参照）。

## ローカル管理 API

IPC 経由でのみ、バックエンドは \`/v2/local-admin/*\` —— ステータス、設定、
ペアリング要求、デバイス、リセット —— をデバイス署名なしで提供します。
ソケット自体が呼び出し元が同じユーザーであることを証明するためです。
TCP 経由では、これらのルートは 404 を返します。
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: "コンテナ",
      description: "Docker でバックエンドを実行し、コンテナワークスペースを作成し、コンテナを整理された状態に保ちます。",
      body: body(`
TodeX コンテナは、\`todex-agentd\` とエージェント CLI がプリインストール
された Docker イメージです。各コンテナはそれぞれ独立したバックエンドで、
エージェントはその中で動作し、プロジェクトフォルダーがマウントされます。

## 要件

TodeX Desktop を実行するマシンに Docker と Compose v2 が必要です。
**設定 → TodeX Container** は両方を確認し、イメージタグとすべての TodeX
コンテナを一覧表示して、起動、停止、再起動、アップグレード、マウント、
ログ、削除を提供します。削除してもコンテナの home ボリュームは、チェックを
入れない限り残ります。このページは \`~/.config/todex-container/<name>/\` の
レイアウトをコマンドラインツール \`todexc\` と共有しています。

## コンテナワークスペース

**ワークスペースを作成**では、**ローカルワークスペース**か**コンテナ
ワークスペース**を選べます。コンテナワークスペースでは、TodeX がフォルダーを
マウントし（Linux と macOS では同じパス、Windows では \`/workspace/<folder>\`）、
コンテナのバックエンドとペアリングし、エージェント CLI をインストールして、
エージェント設定をコンテナへ同期するかを尋ねます
（[設定の同期](/docs/desktop/settings)を参照）。

コンテナのバックエンドは \`deployment: container\` を報告します：

- ペアリング時に、このデバイスを承認する \`todexc\` / \`docker exec\` コマンドが
  表示されます。
- イメージに組み込まれた CLI には「イメージと一緒に更新」と表示されます。
  代わりにイメージをアップグレードしてください。
- パスマッピングがホストとコンテナのパスを相互に変換するため、
  **ローカルで選択**や**開く**がコンテナ内のファイルでも動作します。

## 初期化コマンド

コンテナワークスペースでは、初期化コマンドを一度だけ、\`todex\` ユーザーで、
ワークスペースのパスにおいて \`bash -c\` 経由で実行でき、最初の失敗で
停止します。pnpm、npm、yarn、uv、\`requirements.txt\`、git サブモジュール
向けのテンプレートが提案されます。時間のかかる初期化はバックグラウンドで
続行できます。

## アイドル状態のコンテナを凍結する

**アイドル時に自動凍結**（既定でオフ）は、15 分から 4 時間の間で指定した
アイドル時間の後にコンテナを一時停止します（\`docker pause\`）。メッセージの
送信、ターミナルを開く、そのワークスペースのいずれかを開くと再開します。
コンテナカードにも**凍結**と**再開**が表示されます。

## 自動クリーンアップ

クリーンアップは起動の 1 分後に実行され、その後は 6 時間ごとに実行されます：

- 古いイメージを削除する。
- 1 日、7 日、30 日以上停止しているコンテナを削除する（または削除しない）。
- どのワークスペースも使っていないフォルダーをアンマウントする。
- TodeX 終了時にコンテナを停止する。

home ボリュームが自動で削除されることはありません。

## コンテナ向けのバックエンド設定

| 設定 | 効果 |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | 自己更新はオフ。\`update\` は変更なしで 0 を返して終了 |
| \`TODEX_AGENTD_ADVERTISE_URL\` | バックエンドがクライアントに通知するアドレス |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | イメージが管理する CLI。これらのインストールは 409 を返す |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | ホスト ↔ コンテナのパスマッピング（\`[[workspace.path_mappings]]\`） |

ヘッドレスのコンテナは
\`todex-agentd pair list|approve|reject\`、\`devices list|revoke\`、
\`providers install <id>…\` で管理します（[インストールと実行](/docs/backend/install)を参照）。
`),
    },

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

- **カメラペアリング** —— バックエンドの QR コードをスキャンして
  アドレスを入力し、デスクトップと同じフローでデバイス検証を行います。
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
