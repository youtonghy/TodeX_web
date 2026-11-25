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
      description: 'TodeX とは何か、各構成要素がどう連携するか、どこから始めるか。',
      body: body(`
TodeX は**セルフホスト可能なマルチエージェント・コーディングワークベンチ**です。
1 つの Rust 製バックエンド —— \`todex-agentd\` —— が、普段利用しているコーディングエージェント（Codex、Claude Code、Pi、Devin、OpenCode、Grok Build、Antigravity、DeepSeek Harness、omp、および任意の ACP 互換エージェント）を単一の認証済み API の背後でオーケストレーションします。デスクトップ、Web、モバイルの各クライアントは暗号化されたチャネルで接続します。

TodeX のインフラ経由でコードや通信がプロキシされることはありません。バックエンドは自分のマシンやサーバー上で動き、エージェントは自身のアカウントと認証情報で動作し、コードが許可されたワークスペース外へ出ることはありません。

## 全体構成

\`\`\`text
TodeX Desktop (Electron)          TodeX Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 端末認証 + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, dsh, agy, omp…)
\`\`\`

| コンポーネント | 役割 |
| --- | --- |
| **バックエンド** | \`todex-agentd\`。会話、ワークスペース、Provider ドライバ、バックエンドグループ、セキュリティを担うデーモン。 |
| **デスクトップ** | Electron + React 19 クライアント。カスタマイズ可能なホーム、3 ペインワークベンチ、ローカル IPC、コンテナ統合を提供。 |
| **Web** | 本サイトから HTTP 経由で同じワークベンチを利用可能（インストール不要・直接接続またはリバースプロキシ対応）。 |
| **モバイル** | iPhone / iPad 向けのネイティブ Swift + UIKit クライアント（鋭意開発中）。 |

## 主な特徴

- **エージェント非依存。** 会話は特定の Provider に縛られません。スレッドごとにエージェントを切り替え、同一ワークスペースで並列実行し、\`todex_agents\` 経由でエージェント同士を連携させることもできます。
- **バックエンドグループと E2E 暗号化履歴。** 分散型トラストグループに一度参加するだけでグループ内の全バックエンドへアクセスでき、X-Wing でディスク上に暗号化保存された履歴権限も自動付与されます。
- **スマート作業モードと計画レビュー。** Claude Code で「計画用モデルで調査・設計 → インラインで計画を承認 → 自動承認付きの実行用モデルへターン中に切り替え → 必要時に自動で計画段階へ戻る」2 段階ワークフローを構築できます。
- **充実したワークベンチ。** カスタマイズ可能なホームボード、操作集計とファイルチップ付きタイムライン、入力欄上のリアルタイム計画ステップ、Git Diff、埋め込み xterm.js ターミナル、Agent ブラウザ（Chromium / Kitesurf）、Computer Use ライブ画面をデスクトップと Web の両方で同一に提供します。

## 次のステップ

| 目的 | ページ |
| --- | --- |
| 2.5 の新機能をワークベンチの自動デモで見る | [2.5 の新機能](/docs/introduction/whats-new) |
| 10 分で使い始める | [クイックスタート](/docs/introduction/quick-start) |
| 用語と設計思想を把握する | [基本概念](/docs/introduction/concepts) |
| バックエンドを運用する | [バックエンド概要](/docs/backend) |
| デスクトップアプリを使う | [デスクトップ概要](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: '2.5 の新機能',
      description: 'バックエンドグループ、スマート作業モード、計画レビューとリアルタイム計画ステップ、ホームボード、Kitesurf エンジン、単一ウィンドウ Computer Use —— それぞれステップ切り替え可能なワークベンチの自動デモ付き。',
      body: body(`
TodeX 2.5（2026 年 11 月）では、**複数バックエンド間の分散型トラスト**と**エージェント作業フローの制御性**を大幅に強化しました。中央サーバーなしでマシンと端末をグループ化し、Claude Code 向けのスマート作業モードを追加し、タイムライン・ホーム・ライブ画面の体験を一新しています。

まずは会話作成から計画ステップ・作業プロセスの展開、ストリーミング返信までの一連の流れをご覧ください：

:::demo

## バックエンドグループ

従来は端末ごとに各バックエンドと 1 対 1 でペアリングする必要がありました。**バックエンドグループ**（Mesh v1）は、複数のバックエンド（ノード）とクライアント端末を中央サーバーなしのトラストグループにまとめます：

- **一度の参加で全ノードを利用可能に。** 新しい端末は**招待 QR コード**を読み取るか招待テキストを貼り付けます（招待にはノードのアドレスのみが含まれ、秘密鍵は含まれません）。バックエンド側ではなく**グループ内の既存端末のどれか 1 台**で確認コードを照合して**承認**するだけで、グループ内の全バックエンドと E2E 暗号化履歴へ即座にアクセスできます。
- **柔軟なバックエンド追加。** すでに 1 対 1 でペアリング済みのバックエンドは既存の会話・履歴を保持したままグループへ編入でき、未ペアリングのバックエンドはアドレスと 24 時間有効なワンタイム**参加コード**（\`todex-agentd mesh join-code\`）で追加できます。
- **ローカル IPC とスタンバイ維持。** このコンピューター上のバックエンドがグループに属しかつ IPC 接続されている場合、データ通信は低遅延な IPC を使い（**このコンピューター · データは IPC 経由**）、グループのネットワーク接続はプレゼンスや名簿同期、参加承認のスタンバイとして維持されます。同一デーモンを指すプロファイル間では履歴アクセスが自動付与されます。
- **オンライン状態、LAN ビーコン、E2E 暗号化リレー。** メンバー端末のオンライン／最終接続時刻を表示し、ノードごとの**固定アドレス**やデスクトップの UDP 21047 LAN ビーコンに対応。すべての直結アドレスに到達できない場合でも、グループ内の別ノード経由の**暗号化リレー**（\`<ノード>\` **経由**、端末署名付きチケットで中身は一切復号不可）で接続し、直結が復旧すると自動で戻ります。
- **24 語リカバリーキーと明確な分離。** グループ作成時に 1 回限り表示される 24 語リカバリーキーで全端末紛失時も復旧可能。1 対 1 接続は**設定 → Backend 接続**、グループノードは**設定 → バックエンドグループ**で管理します。

:::demo mesh

詳しくは[バックエンドへの接続](/docs/desktop/connect)および[セキュリティとペアリング](/docs/backend/security)をご覧ください。

## スマート作業モードと計画レビュー

**スマート作業モード**は、異なるモデルを使った調査・設計と自動承認実装を 1 つの連続した Claude Code ワークフローにまとめます：

- **2 段階設定（設定 → スマート作業モード）。** 端末ごとに**計画段階**（モデル、推論強度、計画時に自動添付する**計画スキル** 例：\`plan-gate\`）と**実行段階**（モデル、推論強度、常に**自動承認**）を設定します。
- **ターン中の自動引き継ぎ（\`plan_handoff\`）。** 入力欄の作業モードメニューで**スマート**を選びます。計画中（**スマート · 計画中**）に Claude が \`ExitPlanMode\` で計画を提出し、ユーザーが承認すると、バックエンドが実行中の Claude プロセスへターン途中で実行モデルと自動承認を適用して引き継ぎ通知を記録し、そのまま実装（**スマート · 実行中**）へ進みます。
- **必要時の再計画（\`plan_reentered\`）。** 実行中に Claude 自身が \`EnterPlanMode\` を呼び出すか、後続メッセージに計画スキルを添付すると、自動的に計画モデルへ戻り、新計画の承認後に再び実行段階へ引き継ぎます。
- **独立した計画行と承認カード。** \`ExitPlanMode\` の計画本文はタイムライン上に独立した Markdown の**計画**行として表示され、入力欄上に**計画の承認待ち**カード（スマート時は移行先モデル名も表示）が現れて、そのまま**承認**またはフィードバック付きで**修正を依頼**できます。

:::demo smart

:::demo smart-settings

## 計画ステップ、操作名付き実行、バックグラウンドタスク

- **入力欄上の計画ステップ（\`計画 1/3\`）。** Codex（\`turn/plan/updated\`）、Claude Code（\`TodoWrite\`）、Pi（\`@tintinweb/pi-tasks\` の \`TaskCreate\`/\`TaskUpdate\`/\`TaskList\`、ターンをまたいで保持）、ACP エージェントの進捗を \`plan.updated\` に正規化し、折りたたみ可能なチェックリストで表示します。
- **Codex 警告・自動レビュー通知と \`ultra\` 推論強度。** Codex の \`provider_warning\`（同一ターン内重複排除）と \`auto_review\` 結果を 1 行の控えめな通知として表示し、詳細や根拠をツールチップで確認できます。Codex 推論強度に \`ultra\` が加わりました。

:::demo plan-steps

- **思考ドット、操作名付き見出し、ファイルチップ。** 実行中のツールグループは BoardUI の思考ドットとともに現在操作（例：「\`page.tsx\` を読み込み中」）を表示し、完了後は「2 ファイルを編集 · 1 コマンドを実行」のように集計見出しへ切り替わり、触れたファイルをチップで一覧します。

:::demo execution-group

- **バックグラウンドタスクの停止と確実な未読表示。** Claude Code がターン終了後もバックグラウンド処理やサブエージェントを待っている間、入力欄上に**バックグラウンドタスクを停止**ボタンが表示され、後続ターンでも追跡が継続します。メモリ上のタイムライン解放後もバックグラウンド完了時の未読バッジが消えません。
- **承認タイムアウト撤廃と通知改善。** 権限確認・質問・計画レビューの 10 分固定タイムアウトを廃止し、ユーザーが応答またはキャンセルするまで待機します。システム通知には質問文や具体的な承認対象が表示され、応答後に自動消去されます。

:::demo background-tasks

## ホームボード、計画カレンダー、サイドバー

- **レイアウト自由なホーム画面。** 起動時は**ホーム**が開き、**実行中**・**返信待ち（承認待ち）**・**今日の会話**・**今日の使用量**・**時間帯別使用量**・**プラン上限**（5 時間／7 日ウィンドウ）を一覧表示。**レイアウトをカスタマイズ**からドラッグ並べ替え・角ドラッグでリサイズ・非表示・再追加が行えます。

:::demo home

- **「計画」ボード＆カレンダー。** タスク管理は**計画**へ刷新され、カンバン**ボード**と**カレンダー**ビューの両方を備えます。
- **オフラインワークスペースの折りたたみと状態リング。** 切断中バックエンドのワークスペースは一覧末尾の**オフラインのバックエンドのワークスペースを表示 (n)** まで折りたたまれ、フォルダアイコンには配下で最も緊急度の高い状態リング（\`working > issue > unread\`）を反映。ホーム・ターミナル・計画・プロフィール表示中は背後のワークスペース／会話の強調を解除します。

:::demo offline-sidebar

## Agent ブラウザと Computer Use

- **ライブ画面の配置選択。** Agent ブラウザと Computer Use のライブ画面を**サイドパネル**（既定）または**入力欄の上**から選べます。
- **単一ウィンドウ Computer Use と AI カーソル。** アプリまたはウィンドウを指定すると \`ScreenCaptureKit\` で対象ウィンドウだけ（別スペースや背面にあっても）を捕捉し、ユーザーのマウスカーソルを奪わずにバックグラウンド操作します。ホストとライブ画面の双方にオレンジ色の **AI カーソル**が直前操作地点を示し、macOS ではドラッグ＆ドロップ権限ガイド、画面収録の再起動案内、ad-hoc 署名警告、ホスト操作ピルの赤い**停止**ボタンを備えます。

:::demo computer-live

- **実験的 Kitesurf エンジン、ヘッドレス Chromium、サイト承認。** Cloudflare のヘッドレス **Kitesurf**（\`workerd\` ベース、タブごとに独立コンテキスト、デスクトップ環境不要）を選択可能になり、ディスプレイのない Linux でも Chromium が自動で \`--headless\` 動作します。ローカルホスト以外を開く際は**サイト承認**（今回のみ許可／常に許可／拒否）を求め、設定から**常に許可するサイト**の管理や**サイトごとに確認／承認不要**の切り替えが可能（DNS 解決でリンクローカル・クラウドメタデータ・デーモン自身のポートは常に遮断）。クラッシュや白紙ページは \`PAGE_FAILED\` としてコンソールエラー付きで通知します。

:::demo agent-browser

## リンク済みスキルと Provider 更新

- **シンボリックリンクのスキル（\`リンク\`）。** スキルルート直下のシンボリックリンク（例：\`~/.claude/skills/plan-gate -> ~/.codex/skills/plan-gate\`）を読み取り専用の**リンク**タグ付きで一覧し、スマート作業モードや \`@skill:\` でそのまま利用できます。

:::demo linked-skills

- **Antigravity の ACP 常駐化。** 会話ごとに常駐 \`agy acp\` プロセスを起動し、ACP 権限確認とタイムアウト付き TodeX MCP ツールをネイティブ利用（旧 \`~/.gemini/config\` のフック残留も自動削除）。
- **Claude Code モデル動的取得と 512K プリセット。** Claude Code は \`initialize\` 応答から最新モデル・推論強度（\`ultracode\` 含む）を直接取得し、カスタムモデル設定には **512K（\`524,288\` トークン）** プリセットを追加しました。

## 2.4 からの基盤機能

**プライベート会話**（メモリ限定、\`⌘⇧P\` / \`⌥⇧P\`）、**任意の返信からのフォーク**、Codex **\`/goal\`**、**ローカル IPC バックエンド**、**TodeX コンテナ**、**設定同期**、**端末内暗号化履歴キャッシュ**、\`SHA256SUMS.sig\` **署名付きリリース検証**を引き続き備えています。
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: 'クイックスタート',
      description: 'バックエンドのインストール、クライアントのペアリングまたはグループ参加、最初の会話開始まで。',
      body: body(`
バックエンドを動かすマシンと、ログイン済みのエージェント CLI（\`codex\`、\`claude\`、\`pi\`、\`devin\`、\`opencode\`、\`dsh\`、\`omp\` など）が少なくとも 1 つ必要です。自分のマシンだけで使う場合は、デスクトップアプリの[ローカルバックエンド](/docs/desktop/local-backend)からワンクリックで展開・IPC 接続できます。

## 1. バックエンドをインストール

macOS、Linux、WSL 向け（Rust ツールチェーン不要）：

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`SHA256SUMS.sig\` の署名を検証して \`~/.local/bin\` に \`todex-agentd\` を配置し、起動中の管理デーモンを再起動します。バージョン指定は \`install.sh install --version 2.5.0\`、ソースビルドは \`cargo build --release\` を使用します。

## 2. 起動して端末を承認

\`\`\`bash
todex-agentd tui
\`\`\`

TUI にデーモン状態、ログ、デバイス一覧、ペアリング QR コードが表示されます。初回接続時は \`d\` で確認コードと鍵フィンガープリントを照合し、\`a\` で承認（\`r\` で拒否）します。TUI を終了してもデーモンはバックグラウンドで稼働し続けます。

## 3. クライアントを接続

- **デスクトップ**：GitHub Releases からパッケージを導入。ローカル専用なら**設定 → ローカルバックエンド**でワンクリック展開、リモート接続なら**設定 → Backend 接続**に URL（既定 \`http://127.0.0.1:7345\`）だけ入力して端末検証を完了します。
- **Web**：ホストされたサイトまたはセルフホスト環境の \`/app\` を開き、同様に URL を指定してペアリングします。
- **複数端末／複数バックエンド**：**設定 → バックエンドグループ**でグループを作成すれば、追加端末は**招待 QR コード**を読み取るだけで既存端末から承認できます。詳細は[バックエンドへの接続](/docs/desktop/connect)を参照してください。

## 4. ワークスペースと会話を作成

設定済みのワークスペースルート（既定 \`~/projects\`）配下のディレクトリを追加し、利用可能な Provider を選んでタスクを送信します。プロンプト、承認、計画レビュー、リアルタイム計画ステップ、ターミナル、Git Diff が同じ暗号化チャネルで同期されます。

## トラブルシューティング

| 症状 | 確認ポイント |
| --- | --- |
| バックエンドに到達できない | \`todex-agentd daemon status\` を実行（既定ポートは \`7345\`） |
| 全リクエストが \`401\` になる | 端末未承認またはグループから削除済み — TUI の \`d\` 画面またはグループ名簿を確認 |
| REST は通るが WebSocket が失敗する | 暗号鍵またはプロキシヘッダー不一致 — 設定から**再ペアリング**を実行 |
| エージェントが利用不可表示 | バックエンドホストで該当 CLI が未導入または未ログイン（**設定 → CLI 管理**で確認） |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: '基本概念',
      description: 'TodeX の全画面に共通する用語：Provider、ワークスペース、会話、端末とグループ、履歴暗号化。',
      body: body(`
## Provider とドライバ

*Provider* とはバックエンドが駆動できるエージェントエンジン（**Codex**、**Claude Code**、**Pi**、**Grok Build**、**Devin**、**OpenCode**、**Antigravity**、**DeepSeek Harness (dsh)**、**omp (oh-my-pi)**、および \`config.toml\` 定義の ACP 2.0 プロファイル）を指します。ネイティブドライバ（JSON-RPC app-server、stream-json、RPC、ACP stdio）経由でモデル、推論強度、スラッシュコマンド、スキル、MCP サーバーを実 CLI から直接取得します。

*Provider アカウント*はエージェントごとに複数のアカウント・ゲートウェイ設定を保持し、切り替え時には既存設定をバックアップしたうえで CLI のグローバル設定またはパッチ層を更新するため、TodeX 外で CLI を直接起動しても同じ設定が効きます。

## ワークスペース

*ワークスペース*はバックエンドの \`TODEX_AGENTD_WORKSPACE_ROOT\`（既定 \`~/projects\`）配下のプロジェクトディレクトリ、または Docker 上の[コンテナワークスペース](/docs/desktop/containers)です。エージェント、PTY ターミナル、Git 操作は許可された境界内でのみ動作します。

## 会話

永続化された会話は \`$DATA_DIR/conversations/<uuid>/\` フォルダに保存されます（デーモンメモリのみに留まる[プライベート会話](/docs/backend/security)を除く）：

| ファイル | 内容 |
| --- | --- |
| \`manifest.json\` | メタデータ、Provider プロファイル、ワークスペース、タイムスタンプ、暗号化タイトル |
| \`events.jsonl\` | 追記専用イベントジャーナル（\`$enc\` 暗号文を含む履歴の正本） |
| \`snapshot.json\` | 高速再読み込み用のコンパクトスナップショット |
| \`provider-state.json\` | ターン再開用のネイティブエンジン状態 |

ターン更新は楽観的同時実行制御で保護されており、実行中の競合変更には \`409 Conflict\` を返します。入力欄からの追加メッセージはバックエンドのキューで安全に待機します。

## 端末、ペアリング、バックエンドグループ

TodeX はパスワードを使いません：

- **1 対 1 ペアリング（Pairing v3）**：端末が Ed25519 鍵ペアを生成し、TUI で確認コードを照合して端末鍵・通信プロトコル・バックエンド公開鍵を一括ピン留めします。
- **バックエンドグループ（Mesh v1）**：署名付き名簿チェーン（\`todex.mesh.roster\`）で結ばれた分散型グループ。グループ内の任意端末で承認された新端末は、全ノードへの接続権限と暗号化履歴の閲覧権限を同時に取得します。

## 通信暗号化と履歴暗号化

| レイヤー | 方式 | 説明 |
| --- | --- | --- |
| **通信** | \`ml-kem-768\`（既定）/ \`x25519\` / \`none\` | REST は \`POST /v2/sealed\`、WebSocket は \`tv=2\` 暗号化フレームを使用（\`none\` はループバック限定）。 |
| **履歴** | X-Wing E2E 暗号化（history v3） | ディスク書き込み前に認可端末と 24 語リカバリー鍵向けに暗号化され、バックエンドは復号用秘密鍵を一切持ちません。 |

## テナント

すべてのデータは \`tenant_id\` で名前空間分離され、クエリやイベント配信がテナントを跨ぐことはありません。
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: 'バックエンド概要',
      description: 'todex-agentd —— エージェント・会話・グループ・セキュリティを統括する Rust デーモン。',
      body: body(`
\`todex-agentd\` は Tokio と Axum で構築された単一バイナリの Rust デーモンで、端末認証付きの REST（\`/v2/*\`）と多重化 WebSocket（\`/v2/ws\`）を提供します。\`[api] enabled = true\` を有効にすると、スクリプトや CI 向けの API キー認証 REST + SSE ポートも提供します（[外部 API とキー](/docs/backend/external-api)）。

## Provider ドライバ

| Provider | 通信方式 | 特徴 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\` / \`turn\` / \`status\` / \`stop\` / \`attach\` / \`replay\` / \`interrupt\`、任意返信フォーク、\`/goal\`、\`provider_warning\` / \`auto_review\` |
| **Claude Code** | stream-json | \`initialize\` からのモデル動的取得、スマート作業モード（\`afterPlan\` / \`replan\`）、計画レビュー、バックグラウンド停止 |
| **Pi** | ネイティブ RPC | コマンド・モデル動的発見、ツール承認、\`/todex compact\`、\`@tintinweb/pi-tasks\` によるターン跨ぎ計画追跡 |
| **Grok Build** | 常駐 ACP / 管理 CLI | CLI 自動更新、ツール承認、質問プロンプト |
| **Antigravity** | 常駐 ACP（\`agy acp\`） | 会話ごとに常駐起動、ACP 権限確認（契約が対応時は Auto レビュー利用）、TodeX MCP 連携、旧フック自動削除 |
| **DeepSeek Harness** | 常駐 ACP（\`dsh\`） | パッチ層管理、組み込み／npm プラグイン制御、カスタムルーティング |
| **ACP 2.0** | 常駐／ターン毎 stdio | Devin、OpenCode、omp（\`omp acp\`）、\`config.toml\` のカスタム ACP プロファイル |

バックエンドは UI のために CLI インストールを書き換えません。プロジェクト優先でリアルタイムに能力を取得し、トップレベルのシンボリックリンクスキル（\`linked: true\`）も読み取り専用として正しく認識します。

## 会話エンジンと統一計画ストリーム

- すべての状態は追記専用ジャーナルとスナップショットに保存され、\`afterSequence\` で再接続後も欠損なく復元されます。
- **横断 \`plan.updated\` 正規化**：Codex、Claude Code（\`TodoWrite\`）、Pi（\`@tintinweb/pi-tasks\`）、ACP の計画更新を統一の \`steps\` / \`explanation\` スナップショットへ変換します。
- **承認待機に期限なし**：権限要求・質問・計画レビューの 10 分タイムアウトを撤廃し、ユーザーが操作するまで待機します。

## 1 本のソケットで多機能制御

\`/v2/ws\` は会話購読、プロンプト送信、権限応答、\`conversation.backgroundTasks.stop\`、PTY ターミナル（再接続時スクリーン復元対応）、履歴鍵付与、\`mesh.*\` グループ制御を単一接続に多重化します。

## デーモン管理

対話型 TUI（\`todex-agentd tui\`）のほか、バックグラウンド起動（\`daemon start|stop|restart|status\`）、自動起動設定（\`daemon autostart enable\`）、ヘッドレス CLI 管理コマンドを提供します。詳細は[インストールと実行](/docs/backend/install)をご覧ください。
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: 'インストールと実行',
      description: 'インストールスクリプト、ソースビルド、実行モード、ヘッドレス管理とグループコマンド。',
      body: body(`
## インストールスクリプト（macOS / Linux / WSL）

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # 最新リリースをインストールまたは更新
install.sh update                  # 既存インストールを更新
install.sh install --version 2.5.0 # バージョンを固定して導入
install.sh status                  # インストール済み／最新版とデーモン状態を確認
install.sh uninstall               # デーモンを停止してバイナリを削除
install.sh uninstall --purge       # ~/.todex-agent データディレクトリも削除
\`\`\`

\`~/.local/bin\`（\`--prefix\` や \`TODEX_INSTALL_DIR\` で変更可）に導入し、\`SHA256SUMS\` と Ed25519 署名 \`SHA256SUMS.sig\` を検証してロールバック用コピーを残し、起動中の管理デーモンを再起動します。署名検証できない場合は \`--allow-unverified\` 指定時を除き導入を拒否します（2.3.6 以前の無署名版は警告付きでチェックサム検証のみ）。Linux バイナリは glibc 2.28+ が必要で、Alpine 等はソースビルドします。\`TODEX_AUTO_UPDATE=0\` を設定しない限り起動時に自動更新を確認し、全エージェントが 5 分間非稼働の後に新バージョンへ自動切り替えします。

## ソースからビルド

\`\`\`bash
cargo build --release
\`\`\`

Rust 1.80+（MSRV）が必要です。バイナリは \`todex-agentd\` です。

## 実行モード

\`\`\`bash
# 対話型 TUI（状態・ログ・端末承認・API キー・QR コード）
todex-agentd tui

# フォアグラウンド実行
todex-agentd serve --host 127.0.0.1 --port 7345

# バックグラウンドデーモン
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# ログイン時自動起動（launchd / systemd / Windows レジストリ）
todex-agentd daemon autostart enable
\`\`\`

TUI を閉じてもデーモンはバックグラウンドで動作します。QR 画面がターミナル幅に収まらない場合は \`b\` キーでブラウザに正方形 SVG を開けます。

## ヘッドレス管理とグループコマンド

\`\`\`bash
# 1 対 1 ペアリングと端末管理
todex-agentd pair list
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>

# バックエンドグループ（Mesh v1）
todex-agentd mesh status                  # ノード ID と参加中グループを確認
todex-agentd mesh join-code [--new]       # 24 時間有効なワンタイム参加コードを表示／更新

# CLI と Agent ブラウザの導入
todex-agentd providers install codex claude --if-missing
todex-agentd browser install
\`\`\`

終了コード \`2\` は該当なし、\`3\` はデーモンと別ユーザーでの実行を意味します。デスクトップ上のローカル展開については[ローカルバックエンド](/docs/desktop/local-backend)を参照してください。
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '設定',
      description: 'config.toml、環境変数、および優先順位の解決ルール。',
      body: body(`
## 優先順位

1. コマンドライン引数
2. 環境変数
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`（既定 \`~/.todex-agent/config.toml\`）
4. 組み込みデフォルト

## 主な設定項目

| 項目 | CLI フラグ | 環境変数 | 既定値 |
| --- | --- | --- | --- |
| ホスト | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| ポート | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| データディレクトリ | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| ワークスペースルート | \`--workspace-root\`（複数可） | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| デフォルトエージェント | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex / Claude / Pi / omp | — | \`TODEX_AGENTD_*_BIN\` / \`[agent].omp_bin\` | \`codex\` / \`claude\` / \`pi\` / \`omp\` |
| 常駐プロセス保持秒数 | — | \`TODEX_AGENTD_PROVIDER_KEEPALIVE_SECONDS\` | \`300\`（\`30..=604800\`） |
| 端末認証 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| ペアリング暗号 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |
| 外部 API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | 無効 / \`7346\` |
| ネットワーク待ち受け | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| ローカル IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | 有効 / \`<data_dir>/agentd.sock\` |
| 許可ブラウザ Origin | — | \`TODEX_AGENTD_CORS_ORIGINS\` | なし |
| 信頼済みプロキシ | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | なし |
| ペアリング Origin | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | なし |
| グループ LAN ビーコン | — | \`TODEX_AGENTD_MESH_BEACON\` | \`true\`（UDP 21047） |
| ヘッドレスブラウザ強制 | — | \`TODEX_AGENT_BROWSER_HEADLESS\` | 自動（画面なし時は headless） |
| Kitesurf / workerd パス | — | \`TODEX_AGENT_BROWSER_KITESURF_DIR\` / \`TODEX_WORKERD_PATH\` | 自動取得 |

\`network_enabled = false\` には IPC の有効化が必要です（ローカル IPC のみで待ち受け、ツール用にランダムなループバックポートだけ確保します）。バックエンドグループ機能を利用するにはネットワーク待ち受けと端末認証（\`enable_auth = true\`）を有効にしてください。コンテナ向け変数は[コンテナ](/docs/desktop/containers)に記載しています。

## \`config.toml\` の例

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]
# network_enabled = false

[ipc]
enabled = true

[agent]
default_agent = "codex"
codex_bin = "codex"
claude_bin = "claude"
pi_bin = "pi"
provider_idle_timeout_minutes = 60

[agent.acp_profiles.default]
command = "mcp-server"
args = ["--stdio"]

[security]
enable_auth = true
enable_tls = false
# cors_origins = ["https://todex.example.com"]
# trusted_proxies = ["10.0.0.2"]

[api]
enabled = false
host = "127.0.0.1"
port = 7346
\`\`\`

> **注意：** ネイティブリスナーでの \`enable_tls = true\` は意図的に禁止されています。リモート公開時は Nginx、Caddy、Cloudflare Tunnel など信頼できるリバースプロキシで TLS を終端してください。
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: 'セキュリティとペアリング',
      description: '端末検証、バックエンドグループの信頼モデル、E2E 履歴暗号化、ブラウザサイト保護とプライバシー。',
      body: body(`
TodeX はフェイルクローズ設計です。明示的に承認されるまで端末は通信できず、全リクエストに暗号署名が付与され、会話履歴はディスク上で終始エンドツーエンド暗号化されます。

## 1 対 1 端末検証（Pairing v3）

1. クライアントにバックエンド URL のみを入力すると、ランダムな確認コードとトランスポート鍵フィンガープリント（\`XXXX-XXXX-XXXX-XXXX\`）が表示されます。
2. バックエンド TUI で \`d\` を押して照合し、\`a\` で承認または \`r\` で拒否します（\`x\` でいつでも失効可能）。
3. 確認コードはトランスポートプロトコルと公開鍵にも紐づいており、端末鍵・プロトコル・サーバー公開鍵が一度にピン留めされます。失効した端末は即座に \`401\` となり、WebSocket も 5 秒以内に \`4401\` で切断されます。

## バックエンドグループと暗号化リレー（Mesh v1）

- **署名付き名簿チェーン（\`todex.mesh.roster\`）**：既存メンバー端末（または 24 語リカバリー署名鍵）のみが次の名簿バージョンへ署名でき、削除された端末はオンラインノードから即時遮断され履歴復号鍵も失効します。
- **グループ端末による承認**：新端末は**招待 QR コード**（アドレス情報のみ、鍵は含まない）で到達可能なノードへ接続し、**グループ内の既存端末**で確認コードを照合して承認します。ノード側の TUI や \`devices.json\` には一切表示・保存されません。
- **相互 HMAC 参加コード**：参加コードによるノード追加は 80 ビット乱数コードの双方向 HMAC 証明を行い、5 回誤ると自動無効化されます。
- **E2E 暗号化リレー**：\`/v2/mesh/relay/{node}/{ticket}/{path}\` 経由のリレーは端末署名チケットが必要（ノードあたり最大 64 並列）で、中身の復号・改ざんは一切不可能です。

## トランスポート暗号化

| モード | スイート | 用途 |
| --- | --- | --- |
| \`none\` | 平文 | ループバック専用 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 一般的なリモート接続 |
| \`ml-kem-768\` | NIST 耐量子 ML-KEM | ペアリング標準 |

鍵はペアリングまたは署名付き \`node-info\` 経由でのみ配布され、手動インポートは廃止されています。

## 履歴暗号化と同一デーモンプロファイル共有

- イベントとタイトルはディスク保存前に認可端末の X-Wing 公開鍵と 24 語リカバリー鍵で暗号化され、バックエンドは秘密鍵を持ちません。クライアントのローカルキャッシュも暗号文のみを保持します。
- グループへ端末を承認すると、オンラインの既存端末が自動的に履歴鍵を付与します。
- 同一デーモン（同じピン留め鍵）を指す IPC・TCP・グループノードの複数プロファイルは、初回要求時に自動で相互に履歴アクセスを許可します。

## ブラウザ Origin とプロキシ境界

\`todex-desktop://app\`、ループバック、および \`security.cors_origins\` に厳密一致する Origin のみを許可し、\`Forwarded\` / \`X-Forwarded-For\` / \`X-Real-IP\` を含む通信は \`security.trusted_proxies\` に載っていない限りリモート扱いにします。

## Agent ブラウザのサイト保護

- Chromium と Kitesurf の双方ですべてのタブ要求を検査し、\`localhost\` 等以外の外部・LAN ホストには \`desktop_browser_host\` 承認（今回のみ／常に許可／拒否）を求めます。
- **承認不要**モードへ切り替えても DNS 解決によるチェックは継続し、リンクローカル（\`169.254.0.0/16\` 等）、クラウドメタデータ（\`fd00:ec2::254\`）、URL 内資格情報、デーモン自身のポートを確実に遮断します。パスワード欄入力には常に 1 回限りの確認（\`SENSITIVE_ACTION\`）が必要です。

## ローカル IPC、署名付きリリース、プライベート会話、プライバシーフィルター

- **ローカル IPC**：Unix ソケット（Windows は名前付きパイプ）は同一 OS ユーザーのみ接続でき、\`/v2/local-admin/*\` を提供します。
- **署名付きリリース**：\`install.sh\`・自己更新・デスクトップ導入のすべてで \`SHA256SUMS.sig\` を検証します。
- **プライベート会話**：デーモンメモリのみに留まり再起動で消去されます（Linux/macOS では一部 CLI の一時ファイルも削除）。
- **プライバシーフィルター**：\`todex_ssh\` 出力の秘密鍵・資格情報・カード番号・各国 ID・プロキシ情報をマスクし、アグレッシブ設定や最大 32 件のカスタムキーにも対応。ユーザー側 SSH 表示ではスクラッチカバー越しに保護されます。
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API リファレンス',
      description: '/v2 REST エンドポイント、多重化 /v2/ws WebSocket、および 2.5 拡張仕様。',
      body: body(`
すべての端末 API は \`/v2\` 配下にあり、Ed25519 署名と JSON（暗号化時は \`POST /v2/sealed\` 経由）で通信します。API キー向けの \`/api/v1\` は[外部 API とキー](/docs/backend/external-api)をご覧ください。

## システムとバックエンドグループ

| エンドポイント | 用途 |
| --- | --- |
| \`GET /health\` | ヘルスチェック |
| \`GET /v2/version\` | デーモンバージョン、ワークスペースルート、機能フラグ、\`mesh: 1\` 対応状況 |
| \`ALL /v2/mesh/relay/{node}/{ticket}/{path}\` | グループノード経由の公開ルート／\`tv=2\` WebSocket 暗号化リレー |

## ワークスペース・Provider・CLI

| エンドポイント | 用途 |
| --- | --- |
| \`GET / PUT /v2/workspaces\`、\`DELETE /v2/workspaces/{id}\` | ワークスペース一覧・マージ・削除（会話保持） |
| \`GET /v2/workspace/{entries,directories,file}\` | \`@\` 候補取得、ディレクトリ一覧、サンドボックス内ファイル読み取り |
| \`GET /v2/providers\`、\`versions\`、\`models\`、\`commands\` | 能力フラグ（\`supportsReplan\`、\`backgroundTaskStop\` 等）、CLI 版数、動的モデル、リンク済みスキル（\`linked: true\`） |
| \`POST /v2/providers/{provider}/{install,upgrade}\` | 管理 CLI の導入・単一実行アップグレード |

## 会話とスマート作業モード

| エンドポイント | 用途 |
| --- | --- |
| \`GET / POST /v2/conversations\`、\`GET /v2/conversations/{id}\` | 会話作成・一覧・マニフェスト取得 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | ジャーナルのページング取得（\`beforeSequence\` で過去方向） |
| \`POST /v2/conversations/{id}/prompt\` | ターン送信（Claude スマートモード用 \`afterPlan\` と \`replan\` に対応） |
| \`POST /v2/conversations/{id}/cancel\` | 実行中ターンのキャンセル |
| \`POST /v2/conversations/{id}/background-tasks/stop\` | ターン間で待機中のバックグラウンドタスクを停止 |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | ツール、\`user_input\`、\`plan\`、ホスト承認への応答 |

## Agent デスクトップツール

| エンドポイント | 用途 |
| --- | --- |
| \`GET / PUT /v2/agent-desktop\` | ツール有効化、\`browserEngine\`（\`chromium\` / \`kitesurf\`）、\`browserHostApproval\`（\`ask\` / \`auto\`）、権限状態 |
| \`POST /v2/agent-browser/install\` | 選択中のブラウザエンジンをダウンロード |
| \`GET /v2/agent-browser/hosts\`、\`DELETE .../hosts/{host}\` | 常に許可された外部サイトの一覧と削除 |
| \`GET /v2/agent-desktop/computer/apps\` | \`@app:\` 向けの起動中・導入済みアプリ一覧 |
| \`POST /v2/agent-desktop/computer/permissions\` | macOS システム設定とドラッグ＆ドロップ案内パネルを開く |

## WebSocket — \`/v2/ws\`

- \`conversation.subscribe\`：\`afterSequence\` 再開、横断正規化 \`plan.updated\`、\`provider.event\`（\`plan_handoff\` / \`plan_reentered\` / \`provider_warning\` / \`auto_review\` / \`background_tasks_pending\` / \`background_tasks_ended\`）
- プロンプト送信・キャンセル・承認・\`conversation.backgroundTasks.stop\`
- \`terminal.*\`：PTY セッションと画面スナップショット復元
- \`agentBrowser.{watch,frame}\` および \`desktop.computer.action\`（AI カーソル座標付き）
- \`mesh.{node.get,presence.get,state.get,state.push,join.list,join.approve,join.reject}\` と \`mesh.updated\` 配信

正確な仕様はバックエンドリポジトリの [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md) と [docs/mesh-v1.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/mesh-v1.md) を参照してください。
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: '外部 API とキー',
      description: 'バックエンド管理の API キーを使ってスクリプトや CI から REST + SSE でエージェントを呼び出します。',
      body: body(`
端末向けポート（\`7345\`）に加え、\`todex-agentd\` はスクリプト・CI・自動化サービス向けに API キー認証の REST + SSE ポートを提供できます（端末ペアリングや transport v2 は不要）。ワークベンチの**設定 → エージェント呼び出し**からも視覚的に管理できます。

## 有効化

既定では**無効**です。\`config.toml\` の \`[api] enabled = true\`、\`--enable-api\`、\`TODEX_AGENTD_API_ENABLED=true\`、または**設定 → エージェント呼び出し**／TUI から有効化し、次回起動時から待ち受けます。

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # TLS リバースプロキシ配下のみ
\`\`\`

API ポートはメインポートと分ける必要があり、CORS は無効（ブラウザからのクロスオリジン不可）です。

## キーの発行と管理

キー形式は \`tdx_<id>_<secret>\` で、完全な値は作成時に**一度だけ**表示されます。バックエンドは \`<data_dir>/api-keys.json\`（\`0600\`）にハッシュのみを保存します。

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

TUI の **API Keys** パネル（\`i\`）や**設定 → エージェント呼び出し**では再起動なしで即時反映・失効でき、失効済みキーは即 \`401\` となり実行中ターンもキャンセルされます。各キーにはエージェント／ワークスペーススコープ、承認ポリシー（\`ask\` / \`auto-approve\` / \`reject\`）、有効期限を設定でき、SSH・デスクトップ・ブラウザ MCP ツールは注入されません。

## エンドポイント（\`Authorization: Bearer <key>\` または \`X-API-Key\`）

| エンドポイント | 用途 |
| --- | --- |
| \`GET /api/v1/health\`、\`me\`、\`agents\`、\`workspaces\` | 疎通確認・キー情報・利用可能なエージェントとワークスペース |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | リアルタイムモデル一覧 |
| \`POST / GET /v1/conversations\`、\`GET / DELETE .../conversations/{id}\` | キー専用会話の作成・一覧・削除 |
| \`POST /v1/conversations/{id}/turns\`、\`cancel\`、\`permissions/{id}\` | ターン開始（\`Accept: text/event-stream\` で SSE）・キャンセル・承認 |
| \`GET /v1/conversations/{id}/events{/stream}\` | 履歴取得および \`Last-Event-ID\` 対応 SSE 購読 |
| \`POST /api/v1/runs\` | 新規会話 + 1 ターン実行を一括実行（同期待機または SSE） |

## ワンショット実行例

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"README を要約して"}' \\
  http://127.0.0.1:7346/api/v1/runs

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"TODO を一覧して","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

同期実行の \`timeoutSecs\` は既定 600 秒（最大 3600 秒）で、超過時はターンを中断し \`504\` を返します。外部 API の会話履歴もキーのシークレットから派生した受信者宛にディスク上で終始暗号化されます。
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: 'デスクトップ概要',
      description: 'Electron クライアント —— カスタマイズ可能なホーム、3 ペインワークベンチ、ローカル IPC、コンテナ連携。',
      body: body(`
TodeX Desktop は Electron 44、React 19、Vite 7、Tailwind CSS v4、BoardUI で構築されたネイティブクライアントです。Web 版と同一の \`@todex/protocol\`・セッション基盤を共有しつつ、ローカルバックエンド展開、Docker コンテナ、LAN ビーコン探索、端末内暗号化キャッシュを提供します。

## ホームと 3 ペイン構成

- **ホーム**：起動直後に開くダッシュボード。実行中・承認待ちの会話、日別件数／トークン、時間帯別グラフ、Codex / Claude Code のプラン枠をカードで表示し、並べ替え・リサイズが可能です。
- **左サイドバー**：分割／統合レイアウト切り替え、タグ分類、グループフォルダ状態リング、オフラインバックエンド折りたたみ、および**計画**（ボード＆カレンダー）・**ターミナル**・**プロフィール**・**プライベート会話**を備えます。
- **中央チャット**：ストリーミング Markdown、思考ドットとファイルチップ付きの操作名ベース実行グループ、独立した計画レビュー行＆カード、入力欄上のリアルタイム計画ステップ、スマート作業モード、\`@\` / \`/\` / \`#\` 補完、バックグラウンドタスク停止を統合。
- **右ワークベンチ**：**ターミナル**（xterm.js WebGL PTY）、**ファイル**、**Git Diff**、**エージェント呼び出し**に加え、**Agent ブラウザ**／**Computer Use** ライブビュー（入力欄上への配置も選択可能）を備えます。

## デスクトップ専用機能

- **[ローカルバックエンド](/docs/desktop/local-backend)**：署名検証付きで本機に \`todex-agentd\` を導入・IPC 接続（グループ参加時は IPC でデータ通信、ネットワークをスタンバイ維持）。
- **[コンテナ](/docs/desktop/containers)**：Docker + Compose v2 で隔離バックエンドを起動・自動フリーズ・定期クリーンアップ。
- **LAN ビーコン受信（UDP 21047）**：同一 LAN 内のバックエンドグループノードのアドレス変化を自動追跡。
- **端末内暗号化履歴キャッシュ**：直近の閲覧履歴を暗号文のまま保存して瞬時に表示。

リリース資産は GitHub Releases（Windows NSIS x64/ARM64、macOS Apple Silicon DMG、Linux x64 AppImage）から配布されます。ビルド手順は[セットアップとビルド](/docs/desktop/setup)へ。
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: 'セットアップとビルド',
      description: '前提条件、開発モード、パッケージング、脱敏済み診断ログ。',
      body: body(`
## 必要要件

- Node.js 22+、pnpm 11+
- 隣接ディレクトリに配置された \`TodeX_protocol\`（\`src\` から直接コンパイル）
- 稼働中の \`todex-agentd\` バックエンド（既定 \`http://127.0.0.1:7345\`）、またはブラウザ上の \`?demo\` プレビュー

## インストールと起動

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

Electron バイナリ取得が途中で止まった場合は \`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\` で修復できます。

## スクリプト一覧

| コマンド | 内容 |
| --- | --- |
| \`pnpm run dev\` | 事前チェック後に Vite 開発モードで起動（1280×800） |
| \`pnpm run build\` | main / preload / renderer をビルド |
| \`pnpm run package\` | electron-builder で各 OS 向けインストーラーを生成 |
| \`pnpm run preview\` | 本番ビルドをプレビュー |
| \`pnpm run typecheck\` | main と renderer を型チェック |
| \`pnpm run check:electron\` | ネイティブ Electron バイナリを検証 |

## リリースと開発ログ

リリースは **Release desktop packages** GitHub ワークフローからセマンティックバージョン（例：\`2.5.0\`）で公開されます（開発版は \`DEV0.0.0\`）。\`DEV0.0.0\` ビルドはトークン・Cookie・鍵・添付内容をマスクした診断ログを \`userData/logs/todex-desktop-debug.log\`（\`TODEX_DESKTOP_LOG_PATH\` で変更可）に出力します。
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: 'バックエンドへの接続',
      description: '複数バックエンドとの同時接続、バックエンドグループ参加、設定同期、接続診断。',
      body: body(`
TodeX は**複数のバックエンドへ同時に接続**し、それぞれのワークスペースと会話をカラーラベルで区別して扱えます。複数端末・複数サーバーを使う場合は**バックエンドグループ**が最適です。

## 方法 1：バックエンドグループ（複数端末・複数サーバー推奨）

**設定 → バックエンドグループ**では、中央サーバーを必要とせずに端末とバックエンド群を信頼グループにまとめます（ハブを指定して発見とリレーを速めることもできます）：

1. **作成または参加**：最初の端末で**グループを作成**し、一度だけ表示される 24 語**リカバリーキー**を保管します。他の端末は**バックエンドグループ → グループに参加**から**招待 QR コード**を読み取るか招待テキストを貼り付け（アドレスのみで鍵は含みません）、**グループ内の既存端末のどれか**で確認コードを照合して**承認**するだけで全バックエンドと履歴にアクセスできます。
2. **バックエンド追加**：既に 1 対 1 でペアリング済みのバックエンドは**ペアリング済みのバックエンド**からそのままグループへ編入でき、未ペアリングの場合は**アドレスと参加コード**（\`todex-agentd mesh join-code\`）で追加します。
3. **ローカル IPC とスタンバイ維持**：このコンピューターのバックエンドがグループに属しかつ[ローカルバックエンド](/docs/desktop/local-backend)の IPC で接続されている場合、通信は IPC を優先し（**このコンピューター · データは IPC 経由**）、グループ接続はプレゼンス・名簿同期・参加申請受信用に待機します。同一デーモンのプロファイル間では履歴アクセスも自動付与されます。
4. **固定アドレス、LAN ビーコン、暗号化リレー**：ノード設定に公開 IP やドメインを固定でき、デスクトップは UDP 21047 の LAN ビーコンも受信します。直結できない場合はグループ内の別ノード経由で E2E **暗号化リレー**（\`<ノード>\` **経由**）し、直結が回復すると自動復帰します。
5. **ハブ**：公開アドレスがあり常時オンラインのバックエンドのノード設定で**ハブ**をオンにします（メンバー一覧に**ハブ**と表示、複数可）。ほかのバックエンドはハブと接続を保って最新のアドレスを交換し、ハブは見えている公開アドレスを各ノードに伝えます。端末はまずハブ経由で接続し、直接のアドレスが使えるようになるとすぐ直接接続に切り替えます。ハブが扱うのは署名済みの名簿とアドレスだけで、リレーの内容は読めません。

:::demo mesh

## 方法 2：1 対 1 デバイス認証

単独のバックエンドを追加する場合は**設定 → Backend 接続 → Backend を追加**から URL を入力し、表示された確認コードと鍵フィンガープリントをバックエンド TUI（\`d\` → \`a\`）で承認します。グループ所属ノードは**バックエンドグループ**側のみに整理されます。

## 設定同期とアカウント移行

- **設定同期（設定 → Backend 接続 → 設定同期）**：2 台のペアリング済みバックエンドを左右に並べて **CLI アカウント、設定、MCP、スキル、SSH 接続**の差分を確認し、追加・変更分だけを安全にコピーします（削除は一切せず、パスワード認証 SSH や秘密鍵はコピーしません）。
- **アカウントのエクスポート／インポート**：**設定 → CLI 管理 → アカウント**から署名付き JSON として他ホストへ移行できます（平文キーを含むため厳重に管理してください）。

:::demo config-sync

## 接続診断

| 状態 | 原因 | 対処 |
| --- | --- | --- |
| 到達不可 | \`/v2/version\` または \`/health\` 失敗 | \`todex-agentd\` 起動・ポート確認、またはグループで固定アドレス／リレーを設定 |
| 無効な URL | パース不能 | \`http(s)://host:port\` 形式で指定（HTTPS ページからは HTTPS/WSS が必須） |
| 認証失敗 | HTTP 401/403 | 未承認またはグループ離脱済み — TUI かグループ既存端末で再承認 |
| 非推奨プロトコル | URL に \`/v1\` が含まれる | ルートアドレス（\`/v2\`）へ変更 |
| WebSocket 失敗 | REST のみ成功 | リバースプロキシの WS 転送または鍵不一致を確認し**再ペアリング** |
| エージェント不可 | \`available = false\` | **設定 → CLI 管理**から CLI を導入またはログイン |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: 'ワークベンチ',
      description: 'ホームボード、サイドバー、スマート作業モード、リアルタイム計画ステップ、右パネルとショートカット。',
      body: body(`
デスクトップと Web のワークベンチは同一構成です（Web 版のみブラウザ予約キーの都合で一部 \`⌥\` に置換）。まずは全体の流れをデモで確認してください。各セクションにも、一時停止やステップ切り替えができる自動デモがあります：

:::demo

## ホーム画面

起動時の既定画面である**ホーム**には、全接続バックエンドを横断する**実行中**・**返信待ち（承認待ち）**・**今日の会話**・**今日の使用量**・**時間帯別使用量**・**プラン上限**（5 時間／7 日）が並びます。**レイアウトをカスタマイズ**から並べ替え・リサイズ・削除・**カードを追加**が行えます。

:::demo home

## 左サイドバー

通常レイアウトと**統合**レイアウト（**設定 → 外観**で切り替え、各ワークスペース配下に 5 件ずつ表示）を選べます。バックグラウンド待機中の会話も稼働表示を維持し、右クリックで新規・名前変更・フォーク・ピン留め・削除が可能です。

- **オフラインバックエンドの折りたたみ**：切断中バックエンドのワークスペースは一覧末尾のページング行（**オフラインのバックエンドのワークスペースを表示 (n)**）まで隠れ、クリックで元の順序に展開できます。
- **タグとフォルダ状態リング**：タグでのグループ化に加え、フォルダアイコンに配下ワークスペースの最も緊急度の高い状態リング（\`working > issue > unread\`）を表示。ホームや計画など独立画面を開く際は背後の行ハイライトを外します。
- **プライベート会話（\`⌘⇧P\` / Web は \`⌥⇧P\`）**：デーモンメモリのみに保持される会話を即座に開始できます。

:::demo offline-sidebar

## スケジュール会話と機能表示切り替え

**計画**タスクやサイドバーから作成する**スケジュール会話**は指定時刻までバックエンドキューに保持され（**今すぐ送信**／**時刻を変更**／**キャンセル**可）、**設定 → 機能**からスケジュール会話・ターミナル・計画の表示／「その他」への収納／無効化を端末ごとに調整できます。バックエンド起動直後は最大 2 分間再試行し、現在のエージェントを事前ウォームアップします。

## スマート作業モードと計画レビュー

Claude Code 会話の入力欄で**スマート**を選ぶと、**設定 → スマート作業モード**に沿った 2 段階フローが動作します：

1. **計画段階（スマート · 計画中）**：計画用モデル・推論強度・計画スキルでコードベースを調査して計画を策定。
2. **計画行と承認カード**：\`ExitPlanMode\` 提出時にタイムライン上に Markdown の**計画**行が現れ、入力欄上に**計画の承認待ち**カード（移行先モデル表示付き）が登場。**承認**または**修正を依頼**でフィードバックを返せます。
3. **ターン中引き継ぎと再計画**：承認すると即座に実行用モデルと**自動承認**へ切り替わり（**スマート · 実行中**）、実行中に \`EnterPlanMode\` や計画スキル添付が行われれば再び計画モデルへ自動で戻ります。

:::demo smart

## 中央 —— 会話と計画ステップ

- **入力欄上の計画ステップ（\`計画 1/3\`）**：Codex、Claude Code（\`TodoWrite\`）、Pi（\`@tintinweb/pi-tasks\`）、ACP の進捗を折りたたみ式チェックリストで表示。
- **Codex 警告と自動レビュー**：\`provider_warning\` と \`auto_review\` の結果を 1 行の控えめな通知として表示し、詳細をツールチップで確認可能。推論強度に \`ultra\` も選べます。

:::demo plan-steps

- **思考ドット、操作名見出し、ファイルチップ**：実行中はアニメーションドットとともに現在の操作を示し、完了後は「2 ファイルを編集 · 1 コマンドを実行」のように要約して対象ファイルをチップで表示します。

:::demo execution-group

- **バックグラウンドタスクの停止**：ターン完了後にバックグラウンド処理だけが残っている場合、入力欄上の**バックグラウンドタスクを停止**ボタンから安全に終了できます。

:::demo background-tasks

- **入力欄と分岐**：\`@\` 2 階層メニュー（\`@file:\` / \`@folder:\` / \`@chat:\` / \`@skill:\` / \`@mcp:\` / \`@app:\` / SSH）、\`/\` コマンド、\`#\` 能力参照、画像・ファイル貼り付け、**この返信からフォーク**、Codex \`/goal\`、Pi \`/todex compact\` を備えます。

## 右側 —— ワークベンチタブ

| タブ | 内容 |
| --- | --- |
| ターミナル | xterm.js WebGL PTY（検索、リンク、シェル統合、画像ペースト、画面スナップショット復元） |
| ファイル | ワークスペースのディレクトリツリーとファイルプレビュー |
| Git Diff | マルチリポジトリの変更差分、ブランチ、ワークツリー操作 |
| エージェント呼び出し | \`todex_agents\` 経由の子会話タスクと結果をリアルタイム表示 |
| Agent ブラウザ / Computer Use | **ライブ画面の配置**設定に応じて右タブまたは入力欄上に表示し、操作座標をオレンジの **AI カーソル**で可視化 |

:::demo computer-live

## キーボードショートカットとターミナル操作

\`⌘B\` / \`Ctrl B\`（左サイドバー）、\`⌘⌥B\` / \`Ctrl Alt B\`（右パネル）、\`⇧⌘G\`（Git 操作）、\`⌘N\`（Web \`⌥N\`、新規会話）、\`⇧⌘N\`（Web \`⌥⇧N\`、ワークスペース追加）、\`⇧⌘P\`（Web \`⌥⇧P\`、プライベート会話）、\`⌘L\`（クイック検索）、\`⌘1…9\`（タブ切り替え）、\`⇧⌘K\`（計画）、\`⇧⌘T\`（Web \`⌥⇧T\`、ターミナル画面）。修飾キーの長押しでヒントバッジが表示されます。

ターミナル内では \`⌘C\`/\`Ctrl Shift C\`（コピー）、\`⌘V\`/\`Ctrl Shift V\`（ペースト）、\`⌘F\`（検索）、\`⌘K\`（クリア）、\`⌘↑/↓\`（プロンプト移動）に加え、bash/zsh/fish 向けの**シェル統合**（終了ステータス表示、パス追跡、10 秒以上の完了通知）と画像ペースト（7 日後自動削除）が利用できます。
`),
    },

    'desktop/settings': {
      slug: 'desktop/settings',
      title: '設定',
      description: 'バックエンドグループ、設定同期、スマート作業モード、Agent デスクトップツール、CLI 管理、履歴キャッシュ。',
      body: body(`
設定画面は左側のグループ化レールから各カテゴリへ移動します。[ローカルバックエンド](/docs/desktop/local-backend)と[コンテナ](/docs/desktop/containers)には個別ページがあります。

## バックエンドグループ

**設定 → バックエンドグループ**では、グループの作成（24 語リカバリーキーの保管）、**招待 QR コード**またはテキストでの参加、既存端末からの検証コード**承認**、ペアリング済みまたは 24 時間**参加コード**によるバックエンド追加、ノード別の**固定アドレス**・**リレー設定**、オンライン状態監視を行えます。

:::demo mesh

## Backend 接続と設定同期

- **Backend 接続**：1 対 1 で接続するバックエンドを管理します（グループノードは重複表示されません）。
- **設定同期**：2 つのペアリング済みバックエンドを並べて **CLI アカウント、設定、MCP、スキル、SSH ホスト**の新規・変更分だけを安全に同期します（秘密値は画面上でマスクされ、パスワード認証 SSH と秘密鍵は同期しません）。

:::demo config-sync

## スマート作業モード

**設定 → スマート作業モード**で、Claude Code 向けの**計画段階**（モデル・推論強度・自動添付する**計画スキル**）と**実行段階**（モデル・推論強度・常に**自動承認**）を端末ごとに指定します。

:::demo smart-settings

## Agent デスクトップツール（Agent ブラウザ & Computer Use）

- **Agent ブラウザ**：**Chromium** と実験的 **Kitesurf**（Cloudflare \`workerd\` ベースのヘッドレス分離エンジン）を選択でき、**サイト承認**（**サイトごとに確認**／**承認不要**）と**常に許可するサイト**一覧を管理します（DNS 検証でリンクローカルやメタデータ、デーモンポートは常に保護）。Chromium 利用時はワークスペースごとに独立プロファイルを管理できます。
- **Computer Use**：**内蔵**または実験的 **agent-desktop** エンジンを選択し、ライブ画面の配置（**サイドパネル**／**入力欄の上**）を設定。macOS ではドラッグ＆ドロップ権限ガイド、画面収録の再起動案内、ad-hoc 署名検出を表示します。

:::demo agent-browser

## CLI 管理

Codex、Claude Code、Pi、Grok Build、DeepSeek Harness、omp、ACP の導入・一括更新（**すべて更新**）と**共有 MCP / スキル**を管理します。

| タブ | 内容 |
| --- | --- |
| 設定 | フォーム・環境変数・生ファイル編集；Pi の**プラグイン**・ネイティブ **MCP**・**サブエージェントテンプレート**；\`dsh\` パッチ層＆プラグイン管理 |
| MCP / スキル | バックエンド上の有効な MCP とスキル；トップレベルのシンボリックリンクには読み取り専用の**リンク**タグを表示 |
| アカウント | プロバイダ認証と JSON 移行；カスタムモデルのコンテキスト長プリセットに **512K（\`524,288\`）** を追加 |
| クリーンアップ | バックエンド上の CLI ネイティブセッション整理 |
| プラグイン | omp プラグインの管理 |

:::demo linked-skills

## エージェント呼び出し、SSH、ストレージ、外観

- **エージェント呼び出し**：\`todex_agents\`（MCP 相互呼び出し）と \`/api/v1\` 外部 API の許可エージェント・モデル範囲、外部 API ポート、API キーを一元管理します。
- **SSH 接続**：管理ホスト・\`~/.ssh/config\`・**ローカル**ホストのアクセス許可、プライバシーフィルター（アグレッシブ設定とカスタムキー対応）、**接続承認**粒度（**ホストごと**／**コマンドごと**）を設定します。
- **一般 → ストレージ**：履歴クリーンアップと、デスクトップ版の**最近の会話を端末にキャッシュ**（最大 100 会話・最新 300 イベント・200 MB まで暗号文のまま保持、プライベート会話は対象外）を設定します。
- **外観と通知**：**サイドバーレイアウト**（分割／統合）と**シェル統合**を切り替え；質問文や承認対象を明示するシステム通知は応答後に自動で閉じます。
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: 'ローカルバックエンド',
      description: 'デスクトップアプリから本機バックエンドを展開して IPC 接続し、グループとも連携します。',
      body: body(`
デスクトップアプリは同一マシン上で \`todex-agentd\` を展開・起動し、ネットワークポートや確認コード照合なしに**ローカル IPC**（Unix ソケット／Windows 名前付きパイプ）で接続できます。

## 展開と管理

**設定 → ローカルバックエンド**から**展開して接続**を押すと、バージョン一致かつ \`SHA256SUMS.sig\` 検証済みのバイナリを取得・起動し IPC 接続します。以降は起動・再起動・停止・再ペアリング・ログ表示、**ログイン時に起動**、**TodeX 終了時に停止**、リスナー設定、リモート／モバイル用 QR コード表示を同じ画面で操作できます。

## 既存接続の再利用とバックエンドグループ連携

- **IPC への切り替え**：すでに \`http://127.0.0.1:7345\` でペアリング済みのループバックプロファイルがある場合、新しい端末鍵を作らず同じプロファイルを IPC へ切り替えて履歴アクセスをそのまま保ちます。
- **バックエンドグループ内のローカルノード（\`このコンピューター · データは IPC 経由\`）**：このマシンのバックエンドがグループにも属している場合、ワークスペース・会話・リクエストは高速な **IPC プロファイル**が担当し、グループのネットワーク接続はプレゼンス・名簿同期・参加承認用の**スタンバイ**として維持されます。同一デーモン上のプロファイル同士が自動で履歴鍵を共有するため、切り替え後も過去の履歴が途切れません。

## ネットワーク待ち受けの停止とローカル管理 API

このアプリ専用として使う場合は IPC 接続中に**ネットワークリスナー**をオフにできます（\`config.toml\` の \`network_enabled = false\`、TUI の \`b\` キー；グループから他端末が接続する場合はオンのままにしてください）。IPC 上でのみ \`/v2/local-admin/*\` が提供され、TCP 経由では常に \`404\` を返します。
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: 'コンテナ',
      description: 'Docker 上でバックエンドを動かし、コンテナワークスペース作成・初期化・アイドル時フリーズ・自動整理を行います。',
      body: body(`
TodeX コンテナは \`todex-agentd\` と各エージェント CLI を同梱した Docker イメージです。各コンテナが独立バックエンドとして動作し、プロジェクトフォルダをマウントして隔離環境でエージェントを実行できます。

## 要件とコンテナ管理

Docker と Compose v2 が必要です。**設定 → TodeX Container** からイメージ一覧や各コンテナの起動・停止・再起動・アップグレード・マウント確認・ログ閲覧・削除（home ボリュームはチェックしない限り保持）を行え、\`todexc\` CLI と \`~/.config/todex-container/<name>/\` 構成を共有します。

## コンテナワークスペース、セットアップ、自動フリーズ／整理

- **コンテナワークスペース**：**新規ワークスペース**で選択すると、Linux/macOS は同パス・Windows は \`/workspace/<name>\` にマウントし、\`todexc\` / \`docker exec\` 承認や[設定同期](/docs/desktop/settings)の案内、ホスト ↔ コンテナ間のパス変換を提供します。イメージ内蔵 CLI は「イメージとともに更新」と表示されます。
- **セットアップコマンド**：初回作成時に \`todex\` ユーザーで \`bash -c\` による初期化コマンドを実行可能（\`pnpm\` / \`npm\` / \`yarn\` / \`uv\` / \`requirements.txt\` / submodule のテンプレート提案付き、長時間処理はバックグラウンド継続）。
- **アイドル時フリーズと定期整理**：15 分〜4 時間の無操作で \`docker pause\` し（メッセージ送信や再開操作で即座に \`resume\`）、起動 1 分後および 6 時間ごとに古いイメージや停止済みコンテナ（1/7/30 日設定）を自動整理します（home ボリュームは自動削除しません）。

| 環境変数 | 効果 |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | 自己更新を無効化 |
| \`TODEX_AGENTD_ADVERTISE_URL\` | クライアントとグループへ通知する公開 URL |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | イメージ管理 CLI（個別インストールは \`409\`） |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | ホスト ↔ コンテナのパスマッピング |
`),
    },

    'mobile': {
      slug: 'mobile',
      title: 'モバイル',
      description: 'iPhone / iPad 向けネイティブクライアント（Todex Mobile）—— 鋭意開発中。',
      body: body(`
> **近日公開。** モバイルクライアントは現在開発中です。本ページは実装中の仕様を追跡しており、最初のベータ版公開時に正式ドキュメントへ置き換わります。

Todex Mobile（\`TodeX_native\`）は同じ \`todex-agentd\` バックエンドへ接続する iPhone・iPad 向けネイティブ Swift + UIKit アプリです。

## 計画・実装中の機能

- **カメラ QR ペアリングとバックエンドグループ**：**バックエンドグループ**の招待 QR コードやバックエンド TUI の QR コードを読み取り、デスクトップと同じ確認コード照合で即座に参加・ペアリングできます。
- **チャット + コンソール**：iPad のワイド画面では会話タイムライン・計画レビューとターミナル・ファイル・Git・ライブ画面を並べて操作できます。
- **完全なターン・スマート制御**：承認応答、質問カード、計画修正フィードバック、モデル／推論強度選択、キュー送信、バックグラウンド完了通知に対応。
- **同一セキュリティと暗号文キャッシュ**：Ed25519 署名と X25519 / ML-KEM-768 鍵を iOS Keychain に保存し、デスクトップと同等の暗号文履歴キャッシュおよびオフライン会話リスト（タイトルは \`titleEnc\` 暗号文のまま、プライベート会話は除外）を備えます。

## 今すぐモバイルで使うには

レスポンシブ対応の [Web クライアント](/docs/introduction/quick-start)（\`/app\`）がスマートフォン・タブレットのブラウザでそのまま動作し、バックエンドグループの招待 QR コードからも参加できます。
`),
    },
  },
};
