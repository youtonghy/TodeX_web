// Korean docs content pack. Structure mirrors docsContent.en.ts:
// same slugs, same section keys — only title/description/body are translated.
import type { DocsLocalePack } from './docsContent';

const body = (markdown: string) => `${markdown.trim()}\n`;

export const koDocs: DocsLocalePack = {
  sections: {
    'section-introduction': '소개',
    'section-backend': '백엔드',
    'section-desktop': '데스크톱',
    'section-mobile': '모바일',
  },
  pages: {

    // ------------------------------------------------------------- Introduction

    'introduction': {
      slug: 'introduction',
      title: '개요',
      description: 'TodeX가 무엇인지, 각 구성 요소가 어떻게 맞물리는지, 어디서 시작하면 되는지 설명합니다.',
      body: body(`
TodeX는 **셀프 호스팅 가능한 멀티 에이전트 코딩 워크벤치**입니다. 하나의
Rust 백엔드 — \`todex-agentd\` — 가 이미 사용 중인 코딩 에이전트(Codex,
Claude Code, Pi, Devin, OpenCode, Grok Build 및 모든 ACP 호환 에이전트)를
단일 인증 API 뒤에서 오케스트레이션합니다. 데스크톱, 웹, 모바일
클라이언트는 암호화된 채널을 통해 이 백엔드에 연결됩니다.

어떤 것도 TodeX 인프라를 통해 프록시되지 않습니다. 백엔드는 사용자의
머신이나 서버에서 실행되고, 에이전트는 사용자 본인의 계정과 자격 증명으로
실행되며, 코드는 승인한 워크스페이스 루트를 절대 벗어나지 않습니다.

## 구성 요소

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

| 구성 요소 | 설명 |
| --- | --- |
| **백엔드** | 대화, 워크스페이스, 프로바이더 드라이버, 보안을 관리하는 데몬 \`todex-agentd\`. |
| **데스크톱** | 3-페인 워크벤치를 갖춘 Electron + React 19 클라이언트. |
| **웹** | 이 사이트가 동일한 워크벤치를 HTTP로 제공합니다 — 설치가 필요 없습니다. |
| **모바일** | iPhone 및 iPad용 네이티브 Swift + UIKit 클라이언트(개발 중). |

## 주요 기능

- **에이전트 무관.** 대화는 프로바이더에 종속되지 않습니다. 스레드별로
  에이전트를 바꾸거나 같은 워크스페이스에서 여러 에이전트를 나란히
  실행할 수 있습니다.
- **영구적인 대화.** 모든 대화는 백엔드 호스트의 폴더입니다 — 매니페스트,
  추가 전용 이벤트 저널, 스냅샷, 네이티브 프로바이더 상태 — 따라서
  클라이언트 재연결과 데몬 재시작 후에도 턴이 이어집니다.
- **페일-클로즈드 보안.** 디바이스는 인증 코드를 통해 등록하고, 모든
  요청은 Ed25519로 서명되며, 전송 암호화는 포스트-퀀텀 ML-KEM-768로
  업그레이드할 수 있습니다.
- **완전한 워크벤치.** 승인 기능이 있는 스트리밍 채팅, 내장 터미널,
  Git 상태 및 diff, 스킬/MCP 카탈로그, 작업 보드를 제공합니다 —
  데스크톱과 웹에서 동일합니다.

## 다음 단계

| 목표 | 문서 |
| --- | --- |
| 10분 안에 실행하기 | [빠른 시작](/docs/introduction/quick-start) |
| 용어 익히기 | [개념](/docs/introduction/concepts) |
| 백엔드 실행하기 | [백엔드 개요](/docs/backend) |
| 데스크톱 앱 사용하기 | [데스크톱 개요](/docs/desktop) |
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: '빠른 시작',
      description: '백엔드를 설치하고, 클라이언트를 페어링하고, 첫 에이전트 대화를 시작합니다.',
      body: body(`
백엔드를 실행할 수 있는 머신과 인증된 에이전트 CLI(\`codex\`, \`claude\`,
\`pi\`, \`devin\`, \`opencode\`, …)가 하나 이상 필요합니다.

## 1. 백엔드 설치

macOS, Linux 또는 WSL — Rust 툴체인이 필요 없습니다:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

이 스크립트는 \`todex-agentd\`를 \`~/.local/bin\`에 설치하고, 릴리스
체크섬을 검증하며, 실행 중인 관리형 데몬을 재시작합니다.
\`install.sh install --version 2.0.2\`로 특정 릴리스를 고정하거나,
\`cargo build --release\`로 소스에서 직접 빌드할 수 있습니다.

## 2. 실행 및 디바이스 승인

\`\`\`bash
todex-agentd tui
\`\`\`

TUI는 데몬 상태, 실시간 로그, 페어링 도구를 표시합니다. 클라이언트가
처음으로 접근을 요청하면 \`d\`를 눌러 인증 코드를 표시하고 클라이언트의
코드와 비교한 다음, \`a\`로 승인(또는 \`r\`로 거부)합니다. TUI를
종료해도 데몬은 백그라운드에서 계속 실행됩니다.

## 3. 클라이언트 연결

- **데스크톱** — 릴리스 페이지에서 패키지를 설치하고, Settings를 열어
  백엔드 URL(기본값 \`http://127.0.0.1:7345\`)을 입력합니다. 디바이스
  인증을 완료한 후, 포스트-퀀텀 암호화가 활성화된 경우 QR 코드 또는
  페어링 JSON으로 암호화 공개 키를 가져옵니다.
- **웹** — 호스팅된 TodeX 사이트의 \`/app\`을 열거나, 직접 배포한
  페이지를 열고 같은 방식으로 백엔드를 지정합니다.

## 4. 워크스페이스와 대화 만들기

구성된 워크스페이스 루트 안에 프로젝트 디렉터리를 추가하고 신뢰됨으로
표시한 다음, 사용 가능한 프로바이더로 대화를 시작합니다. 프롬프트, 승인,
터미널, Git 상태가 모두 같은 연결을 통해 스트리밍됩니다.

## 문제 해결

| 증상 | 확인 사항 |
| --- | --- |
| 클라이언트가 백엔드에 연결되지 않음 | \`todex-agentd daemon status\`; 기본 포트는 7345입니다 |
| 모든 요청에 \`401\` | 디바이스가 승인되지 않음 — TUI에서 인증을 다시 진행하세요 |
| REST는 되는데 WebSocket이 실패함 | 암호화 불일치 — 백엔드의 공개 키를 가져오세요 |
| 에이전트가 사용 불가로 표시됨 | 프로바이더 CLI가 호스트에 설치되지 않았거나 로그인되어 있지 않습니다 |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: '개념',
      description: '모든 TodeX 화면 뒤에 있는 용어: 프로바이더, 워크스페이스, 대화, 디바이스.',
      body: body(`
## 프로바이더와 프로바이더 드라이버

*프로바이더*는 백엔드가 구동할 수 있는 에이전트 엔진입니다 — Codex,
Claude Code, Pi, Grok Build, Devin, OpenCode 또는 \`config.toml\`에
선언된 임의의 ACP 2.0 프로파일. 각 프로바이더에는 네이티브
드라이버(JSON-RPC app-server, stream-json, RPC 또는 ACP stdio)가 있어
스킬, 슬래시 명령, 모델 카탈로그 같은 기능이 추정이 아니라 설치된
CLI에서 그대로 제공됩니다.

*프로바이더 계정*(cc-switch 모델)을 사용하면 에이전트마다 여러 계정
프로파일을 유지할 수 있습니다 — TodeX는 에이전트의 전역 설정을 직접
다시 써서 하나를 활성화하므로, TodeX 밖에서 시작된 세션도 동일하게
동작합니다.

## 워크스페이스와 신뢰

*워크스페이스*는 구성된 *워크스페이스 루트*
(\`TODEX_AGENTD_WORKSPACE_ROOT\`, 기본값 \`~/projects\`) 아래의 프로젝트
디렉터리입니다. 새 워크스페이스는 기본적으로 신뢰되지 않습니다. 신뢰는
에이전트가 그곳에서 무엇을 실행할 수 있는지를 제어하는 명시적이고
소유자 범위의 결정입니다. 워크스페이스의 신뢰를 해제하면 활성 턴이
취소됩니다.

## 대화

대화는 \`$DATA_DIR/conversations/<uuid>/\` 아래의 폴더입니다:

| 파일 | 내용 |
| --- | --- |
| \`manifest.json\` | 메타데이터, 활성 프로바이더 프로파일, 워크스페이스, 타임스탬프 |
| \`events.jsonl\` | 추가 전용 이벤트 저널 — 히스토리의 기준 원본 |
| \`snapshot.json\` | 빠른 재로드를 위한 압축 상태 스냅샷 |
| \`provider-state.json\` | 턴 재개를 위한 네이티브 엔진 상태 |

턴은 낙관적 동시성으로 보호됩니다. 턴이 실행 중일 때 두 번째 변경
요청은 조용히 큐에 쌓이는 대신 \`409 Conflict\`를 반환합니다.

## 디바이스와 페어링

클라이언트는 비밀번호로 로그인하지 않습니다. 각 클라이언트 *디바이스*는
Ed25519 키를 생성하고 등록을 요청하며, 백엔드 TUI에서 코드를 비교해
한 번 승인합니다. 그 이후 모든 HTTP 요청에는 디바이스 서명이 포함되고,
디바이스는 개별적으로 해지할 수 있습니다.

## 전송 암호화

| 모드 | 의미 |
| --- | --- |
| \`none\` | 평문(루프백 전용 설정) |
| \`x25519\` | X25519 + ChaCha20-Poly1305 |
| \`ml-kem-768\` | NIST 포스트-퀀텀 ML-KEM-768(페어링 기본값) |

암호화 키는 페어링 QR 코드 또는 JSON 페이로드를 통해 교환되며,
디바이스 승인과는 별개입니다.

## 테넌트

모든 데이터는 \`tenant_id\`로 네임스페이스화되며, 쿼리, 저널, 구독은
절대 테넌트를 넘나들 수 없습니다.
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: '백엔드 개요',
      description: 'todex-agentd — 에이전트, 대화, 보안을 오케스트레이션하는 Rust 데몬.',
      body: body(`
\`todex-agentd\`는 TodeX의 핵심입니다. Tokio와 Axum 위에 구축된 단일
Rust 바이너리로, 이벤트 스트림, 승인, 터미널 세션을 위한 하나의 REST
표면(\`/v2/*\`)과 하나의 멀티플렉싱 WebSocket(\`/v2/ws\`)을 노출합니다.

## 프로바이더 드라이버

| 프로바이더 | 전송 | 참고 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`, \`turn\`, \`status\`, \`stop\`, \`attach\`, \`replay\`, \`interrupt\` |
| **Claude Code** | stream-json | Claude CLI를 구동합니다. 게이트웨이 없이 내장 모델 별칭 사용 |
| **Pi** | Native RPC | 명령 검색, 동적 모델, 대화형 도구 승인 |
| **Grok Build** | Managed CLI | 다른 관리형 CLI처럼 버전 관리 및 자체 업데이트 가능 |
| **ACP 2.0** | stdio profiles | Devin(\`devin acp\`), OpenCode(\`opencode acp\`), 사용자 정의 \`config.toml\` 프로파일 |

백엔드는 UI를 제공하기 위해 프로바이더 설치를 절대 변경하지 않습니다.
기능 카탈로그(스킬, MCP 서버, 슬래시 명령, 모델)는 프로젝트가 사용자
설정보다 우선하는 규칙으로 실시간 인트로스펙션되고, 스킬은 업로드되는
대신 \`resourceId\`로 프롬프트에 주입됩니다.

## 대화 엔진

모든 턴 상태는 대화 폴더에 있으며, 스냅샷 및 네이티브 프로바이더
상태와 함께 추가 전용 이벤트로 저널링됩니다. 구독은 시퀀스
번호(\`afterSequence\`)부터 재생되므로 클라이언트가 재연결 후에도
메시지 손실 없이 다시 동기화됩니다.

## 하나의 소켓, 여러 채널

\`/v2/ws\`는 대화 구독, 프롬프트 디스패치, 권한 결정, PTY 터미널 세션,
엔진 제어를 하나의 연결로 멀티플렉싱합니다 — 하트비트 감지와 UTF-8
프레임 강제를 포함합니다.

## 데몬 관리

\`todex-agentd\`에는 상태, 로그, 디바이스 승인, 페어링 QR 코드를 위한
대화형 TUI(\`todex-agentd tui\`)와 PID 파일 데몬
모드(\`daemon start|stop|restart|status\`), 로그인 자동
시작(\`daemon autostart enable\`)이 포함됩니다.
[설치 및 실행](/docs/backend/install)을 참조하세요.
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: '설치 및 실행',
      description: '설치 스크립트, 소스 빌드, 실행 모드, 업데이트.',
      body: body(`
## 설치 스크립트 (macOS / Linux / WSL)

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

스크립트는 \`~/.local/bin\`에 설치하고(\`--prefix\` 또는
\`TODEX_INSTALL_DIR\`로 재정의 가능), \`SHA256SUMS\`를 검증하며,
롤백용 사본 하나를 유지하고, 실행 중인 관리형 데몬을 재시작합니다.
사전 빌드된 Linux 바이너리에는 glibc 2.28+가 필요합니다. Alpine 같은
musl 배포판은 소스에서 빌드해야 합니다. WSL은 자동으로 감지됩니다.

고정된 \`--version\`은 \`TODEX_AUTO_UPDATE=0\`일 때만 유지됩니다 —
그렇지 않으면 \`serve\`, \`tui\`, \`daemon start\`가 시작 시 자체
업데이트하고, 실행 중인 데몬은 에이전트가 5분 동안 실행되지 않으면
새 릴리스로 재시작합니다.

## 소스에서 빌드

\`\`\`bash
cargo build --release
\`\`\`

Rust 1.80+(MSRV)이 필요합니다. 바이너리는 \`todex-agentd\`입니다.

## 실행 모드

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

TUI를 종료해도 데몬은 계속 실행됩니다. 페어링 QR 코드는 채워진 터미널
셀로 렌더링됩니다. 코드가 터미널에 맞지 않으면 QR 팝업에서 \`b\`를
눌러 브라우저에서 정사각형 SVG 버전을 엽니다.
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '구성',
      description: 'config.toml, 환경 변수, 그리고 적용 우선순위.',
      body: body(`
## 우선순위

1. 명령줄 인수
2. 환경 변수
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`(기본값 \`~/.todex-agent/config.toml\`)
4. 내장 기본값

## 옵션

| 옵션 | CLI 플래그 | 환경 변수 | 기본값 |
| --- | --- | --- | --- |
| 호스트 | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| 포트 | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| 데이터 디렉터리 | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| 워크스페이스 루트 | \`--workspace-root\`(반복 가능) | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| 기본 에이전트 | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex 바이너리 | — | \`TODEX_AGENTD_CODEX_BIN\` | \`codex\` |
| Claude 바이너리 | — | \`TODEX_AGENTD_CLAUDE_BIN\` | \`claude\` |
| Pi 바이너리 | — | \`TODEX_AGENTD_PI_BIN\` | \`pi\` |
| 디바이스 인증 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| 페어링 암호화 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |

## \`config.toml\` 예시

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

> **참고:** \`enable_tls = true\`는 잘못된 보안 가정을 방지하기 위해
> 네이티브 리스너에서 의도적으로 차단됩니다. 원격 접근의 경우 Nginx,
> Caddy, Cloudflare Tunnel 같은 신뢰할 수 있는 리버스 프록시에서
> TLS를 종단하세요.
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: '보안 및 페어링',
      description: '디바이스 인증, 요청 서명, 워크스페이스 경계, 전송 암호화.',
      body: body(`
TodeX는 페일-클로즈드입니다. 디바이스가 명시적으로 승인되기 전까지는
어떤 것도 백엔드와 통신할 수 없고, 모든 요청은 암호학적으로
서명됩니다.

## 디바이스 인증

각 클라이언트 디바이스는 Ed25519 키 쌍을 생성하고 등록을 요청합니다.
이 흐름은 사람이 직접 검증합니다:

1. 클라이언트가 무작위 인증 코드를 표시하고 대기합니다.
2. 백엔드 TUI에서 \`d\`를 눌러 디바이스 패널을 열고 전체 코드를
   비교합니다.
3. \`a\`로 승인하거나 \`r\`로 거부합니다. 승인된 디바이스는 같은
   패널에 표시되며, \`x\`는 선택한 디바이스를 해지합니다.

승인 후 모든 HTTP 요청에는 디바이스 서명이 포함됩니다 — 승인되지 않은
요청은 \`401 Unauthorized\`로 거부됩니다. 디바이스 승인과 전송 암호화는
별개입니다. 암호화 공개 키는 여전히 QR 코드 또는 수동 가져오기가
필요합니다.

## 전송 암호화

| 모드 | 스위트 | 사용 시기 |
| --- | --- | --- |
| \`none\` | 평문 | 루프백 전용 설정 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 일반적인 원격 접근 |
| \`ml-kem-768\` | NIST 포스트-퀀텀 ML-KEM | 페어링 기본값 |

키는 페어링 QR 코드(채워진 터미널 셀로 렌더링되는 다중 프레임
ML-KEM 세그먼트 또는 \`b\` 키로 여는 브라우저 렌더링 SVG 포함)를 통해
교환되거나, 페어링 JSON 페이로드를 가져와서 교환됩니다.

## 워크스페이스 경계

\`workspace_roots\`는 모든 파일 및 디렉터리 API를 승인된 범위로
제한합니다 — 클라이언트는 그 밖을 읽을 수 없습니다. 워크스페이스별
신뢰는 소유자 범위이고, 새 워크스페이스는 신뢰되지 않은 상태로
시작하며, 신뢰를 해지하면 활성 턴이 취소되고 대화는 삭제하지 않은 채
워크스페이스가 분리됩니다.

## 격리

- **테넌트** — 모든 쿼리, 저널, 구독은 \`tenant_id\`로 범위가
  지정됩니다.
- **서브프로세스** — 에이전트 CLI는 정제된 환경으로 실행되어 관리용
  변수가 프로바이더 세션으로 새어나가지 않습니다.
- **TLS** — 네이티브 리스너는 \`enable_tls\`를 거부합니다. 우회
  방법을 신뢰하는 대신 리버스 프록시에서 TLS를 종단하세요.
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API 레퍼런스',
      description: '/v2 REST 표면과 멀티플렉싱된 /v2/ws WebSocket.',
      body: body(`
모든 엔드포인트는 \`/v2\` 아래에 있습니다. 모든 요청에는 등록된
디바이스 서명이 포함되어야 하며, 본문과 응답은 JSON입니다.

## 시스템

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /health\` | 라이브니스 프로브 |
| \`GET /v2/version\` | 데몬 버전, 워크스페이스 루트, 기능 |

## 워크스페이스

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /v2/workspaces\` | 현재 테넌트의 캐시된 워크스페이스 |
| \`PUT /v2/workspaces\` | 워크스페이스 캐시를 병합합니다. 정규 ID를 반환하고 워크스페이스 경계 내의 미결정 디렉터리를 자동 신뢰합니다 |
| \`GET \\| PUT /v2/workspaces/{id}/trust\` | 소유자 범위의 실행 신뢰를 읽거나 변경합니다(새 워크스페이스는 신뢰되지 않음) |
| \`DELETE /v2/workspaces/{id}\` | 신뢰 해지, 활성 턴 취소, 워크스페이스 제거(대화는 유지됨) |
| \`GET /v2/workspace/entries?workspace=&query=\` | \`@\` 선택기용 파일/폴더 제안 |
| \`GET /v2/workspace/directories?path=\` | 디렉터리 트리 탐색 |
| \`GET /v2/workspace/file?path=\` | 샌드박스 루트 내 파일 읽기 |
| \`GET /v2/browser/fetch?url=\` | 웹 리소스 가져오기 프록시 |

## 프로바이더

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /v2/providers\` | 프로바이더 및 활성 상태 |
| \`GET /v2/providers/versions\` | 각 에이전트의 설치된 버전과 최신 CLI 버전 |
| \`POST /v2/providers/{provider}/install\` | 누락된 관리형 CLI 설치(벤더 공식 스크립트) |
| \`POST /v2/providers/{provider}/upgrade\` | 싱글-플라이트 CLI 업그레이드 시작. 활성 에이전트 작업이 있으면 차단됨 |
| \`GET /v2/providers/upgrades/{operationId}\` | 비동기 설치/업그레이드 진행 상황 및 검증된 버전 |
| \`GET /v2/providers/models?provider=&workspace=\` | 프로바이더의 모델 카탈로그 |
| \`GET /v2/providers/commands?provider=&workspace=\` | 슬래시 명령 및 확장 |

프로바이더 계정은 \`/v2/agent-providers/{agent}\` 아래에 있으며,
\`GET .../export\`와 \`POST .../import\`가 서명된 JSON 파일로 호스트
간에 프로파일을 이동합니다.

## 대화

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /v2/conversations\` | 테넌트에 영속화된 대화 |
| \`POST /v2/conversations\` | 프로바이더로 대화 폴더 생성 |
| \`GET /v2/conversations/{id}\` | 매니페스트 및 세부 정보 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | 페이지네이션된 이벤트 저널. \`beforeSequence=N\`은 지연 히스토리 로딩을 위해 뒤로 페이지네이션 |
| \`POST /v2/conversations/{id}/prompt\` | 턴 디스패치 — 텍스트, 타입이 지정된 콘텐츠, 모델, 추론 강도, 스킬 리소스 ID |
| \`POST /v2/conversations/{id}/cancel\` | 실행 중인 턴 취소 |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | 대화형 승인 처리 |

턴이 실행 중일 때 두 번째 변경 요청은 \`409 Conflict\`를 반환합니다 —
턴은 조용히 큐에 쌓이지 않습니다.

## WebSocket — \`/v2/ws\`

하나의 연결이 다음을 멀티플렉싱합니다:

- \`conversation.subscribe\` — 시퀀스 기반 재개를 지원하는 실시간
  이벤트 저널
- 프롬프트 디스패치 및 취소
- 권한 결정
- \`terminal.open\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.close\` — PTY 세션
- 로컬 Codex 엔진 프로세스 제어

프레임은 UTF-8 길이 제한을 강제하고, 하트비트가 끊어진 연결을
감지합니다.

공식 계약은 백엔드 리포지토리의
[docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)입니다.
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: '데스크톱 개요',
      description: 'Electron 클라이언트 — macOS, Windows, Linux용 3-페인 워크벤치.',
      body: body(`
TodeX Desktop은 Electron 44, React 19, Vite 7, Tailwind CSS v4,
HeroUI Pro로 구축된 \`todex-agentd\`용 네이티브 클라이언트입니다.
웹 클라이언트와 \`@todex/protocol\` 전송 라이브러리를 공유하므로
워크벤치는 동일합니다 — 데스크톱 앱은 그 위에 네이티브 통합을
추가합니다.

## 세 개의 페인

- **왼쪽 사이드바** — 워크스페이스 탐색기, 에이전트 배지가 있는 대화
  히스토리, 스레드 수명 주기(새로 만들기, 이름 바꾸기, 포크, 삭제),
  빠른 설정.
- **중앙 채팅** — Shiki 하이라이팅과 KaTeX 수식을 지원하는 스트리밍
  Markdown 타임라인, 대화형 승인 카드(명령, diff, 도구 호출), 모델 +
  추론 강도 선택기, \`@\` 참조 메뉴(파일, 폴더, 대화, 스킬, MCP), \`/\` 슬래시 명령, \`#\`
  스킬/MCP 제안, Codex Fast 모드를 갖춘 프롬프트 상자.
- **오른쪽 워크벤치** — Slash Commands 참조, 실시간 Git Diff, 내장
  xterm.js PTY 터미널, Skills/MCP Capabilities 카탈로그, Experiments가
  있는 탭 드로어.

## 데스크톱 전용 기능

- 루프백 워크스페이스용 네이티브 파일 및 디렉터리 선택기.
- **드래그 앤 드롭 페어링** — QR 스크린샷을 창에 드롭하면 로컬에서
  디코딩(jsQR)되며, 페어링 JSON / 분할된 ML-KEM 페이로드를
  붙여넣을 수도 있습니다.
- Electron \`userData\` 영속화, \`contextBridge\`를 통한 안전한
  IPC(\`nodeIntegration: false\`), 빌드별 진단 로그.
- 연결할 수 없는 백엔드, 잘못된 URL, 인증 실패, 지원 중단된 \`/v1\`
  엔드포인트, WebSocket 불일치를 구분하는 연결 진단.

## 릴리스

사전 빌드된 패키지는 GitHub Releases에서 제공됩니다. SHA-256 체크섬과
함께 Windows NSIS(x64 + ARM64), macOS Apple Silicon DMG, Linux x64
AppImage가 포함됩니다. 개발 빌드는
[설정 및 빌드](/docs/desktop/setup)를 참조하세요.
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: '설정 및 빌드',
      description: '사전 요구 사항, 개발 모드, 릴리스 패키징.',
      body: body(`
## 요구 사항

- Node.js 22+, pnpm 11+
- 실행 중인 \`todex-agentd\` 백엔드(기본값 \`http://127.0.0.1:7345\`)
- 패키지 설치를 위한 HeroUI Pro 라이선스 토큰

## 설치

\`@heroui-pro/react\`는 설치 중에 인증하므로 먼저 토큰을 export하세요:

\`\`\`bash
export HEROUI_AUTH_TOKEN="your_heroui_key"   # or: export HEROUI_AUTH_TOKEN="$HEROUI_KEY"
pnpm install
pnpm run dev
\`\`\`

> **경고:** 토큰을 리포지토리에 커밋하지 마세요.

Electron 바이너리 다운로드가 중간에 끊기면
\`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\`로
복구하세요.

## 스크립트

| 명령 | 동작 |
| --- | --- |
| \`pnpm run dev\` | predev 검사 후 Vite 개발 모드로 앱 실행(1280×800 창) |
| \`pnpm run build\` | main, preload, renderer 빌드 |
| \`pnpm run package\` | electron-builder로 패키징 |
| \`pnpm run preview\` | 프로덕션 빌드 미리보기 |
| \`pnpm run typecheck\` | main + renderer 대상 타입 검사 |
| \`pnpm run check:electron\` | 네이티브 Electron 바이너리 확인 |

## 릴리스

패키지는 **Release desktop packages** GitHub 워크플로우로 생성됩니다.
\`1.2.3\` 같은 semver를 입력하면 Windows NSIS(x64 + ARM64), macOS
Apple Silicon DMG, Linux x64 AppImage와 SHA-256 체크섬이 릴리스 태그에
게시됩니다. 개발 빌드는 \`DEV0.0.0\`으로 표시됩니다. 이 워크플로우에는
\`HEROUI_AUTH_TOKEN\`과 — 프로토콜 리포지토리가 비공개인 동안에는 —
\`PROTOCOL_REPO_TOKEN\` Actions 시크릿이 필요합니다. macOS 릴리스에는
서명이 필요합니다. 데스크톱 리포지토리의 \`docs/automatic-updates.md\`를
참조하세요.

## 개발 로그

\`DEV0.0.0\`으로 스탬프된 빌드는 진단 정보를
\`userData/logs/todex-desktop-debug.log\`에 기록합니다
(\`TODEX_DESKTOP_LOG_PATH\`로 재정의 가능). 로그는 윈도우, IPC, HTTP,
WebSocket, 처리되지 않은 오류를 다루며, 토큰, 쿠키, 키, 첨부 파일은
마스킹됩니다.
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: '백엔드 연결',
      description: '페어링 흐름, 디바이스 인증, 연결 진단.',
      body: body(`
데스크톱 앱은 REST + WebSocket을 통해 한 번에 하나의 백엔드와
통신하며, 모든 요청은 디바이스의 등록된 키로 서명됩니다.

## 페어링 방법

| 방법 | 방식 |
| --- | --- |
| **디바이스 인증** | 호스트/포트로 연결하면 앱이 코드를 표시합니다 — 백엔드 TUI에서 승인(\`d\` 다음 \`a\`)하면 토큰이 저장됩니다. |
| **드래그 앤 드롭 QR** | QR 스크린샷이나 이미지 파일을 창에 드롭합니다. jsQR로 로컬에서 디코딩됩니다. 다중 프레임 ML-KEM 세그먼트를 지원합니다. |
| **페어링 JSON 붙여넣기** | 분할된 QR 텍스트를 포함한 전체 페어링 페이로드를 붙여넣습니다. |
| **수동** | 백엔드 URL을 입력하고 암호화 공개 키를 수동으로 가져옵니다. |

디바이스 승인과 암호화는 별도의 단계입니다 — 페어링 암호화가
\`x25519\` 또는 \`ml-kem-768\`이면 디바이스가 승인된 후에도
클라이언트에 백엔드의 공개 키(QR 또는 수동 가져오기)가 필요합니다.

## 클라이언트에서 프로바이더 관리

페어링 패널은 백엔드의 Codex, Pi, Claude Code, Grok Build, ACP CLI
인벤토리를 설치된 버전과 최신 버전과 함께 표시하고, 누락된 CLI를
한 번의 클릭으로 설치하며, 관리형 업그레이드를 시작합니다.
프로바이더 계정은 JSON 파일로 내보내고 가져와서 호스트 간에 에이전트
자격 증명을 동기화할 수 있습니다 — 이 파일에는 키가 평문으로 들어
있으므로 비밀처럼 다루세요.

## 진단

| 상태 | 원인 | 해결 |
| --- | --- | --- |
| 백엔드에 연결할 수 없음 | \`/v2/version\` 또는 \`/health\` 실패 | \`todex-agentd\` 시작; 포트 확인 |
| 잘못된 백엔드 URL | URL을 파싱할 수 없음 | \`http://127.0.0.1:7345\` 형식 사용 |
| 인증 실패 | HTTP 401/403 | 디바이스 인증 다시 실행 |
| 지원 중단된 프로토콜 | URL 경로에 \`/v1\` 포함 | \`/v2\`로 전환 |
| WebSocket 실패 | REST는 되지만 \`/v2/ws\` 실패 | 방화벽, 토큰 또는 암호화 불일치 — 키를 다시 가져오세요 |
| 에이전트 사용 불가 | 프로바이더가 \`available = false\` 표시 | 백엔드 호스트에서 에이전트 CLI 설치/인증 |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: '워크벤치',
      description: '사이드바, 채팅 패널, 워크벤치 탭, 키보드 단축키.',
      body: body(`
워크벤치는 데스크톱과 웹에서 동일합니다. 이 페이지는 데스크톱 용어를
사용하며, 웹에서 다른 점은 별도로 표시합니다.

## 왼쪽 사이드바

워크스페이스가 위에, 대화가 아래에 있습니다. 대화 행에는 활성 에이전트
배지와 실행 상태가 표시됩니다. 우클릭 작업에는 새로 만들기, 이름
바꾸기, 포크, 삭제가 있습니다. 워크스페이스는 구성된 워크스페이스 루트
아래의 모든 디렉터리에서 추가할 수 있으며 명시적으로 신뢰됩니다.

## 중앙 — 채팅

- Shiki 코드 하이라이팅과 KaTeX 수식을 지원하는 스트리밍 Markdown.
- 명령, 파일 diff, 도구 호출에 대한 승인 카드 — 턴이 실행되는 동안
  인라인으로 처리합니다.
- 프롬프트 상자: \`@\`는 참조 메뉴를 열어 유형을 고른 뒤 검색하며(\`@file:\`,
  \`@folder:\`, 워크스페이스의 다른 대화를 Markdown 파일로 첨부하는 \`@chat:\`,
  \`@skill:\`, \`@mcp:\`), \`/\`는
  프로바이더 슬래시 명령을 실행하며, \`#\`은 스킬이나 MCP 기능을
  참조합니다. 모델 선택기는 이름을 대소문자 구분 없이 매칭하고,
  프로바이더가 지원하는 경우 드래그 가능한 추론 강도 컨트롤과
  Codex Fast 모드를 제공합니다.
- 추론 및 도구 세부 정보는 확장 시 지연 마운트되며, 최종 답변은
  컨텍스트와 실행 노이즈로부터 격리된 상태를 유지합니다.

## 오른쪽 — 워크벤치 탭

| 탭 | 내용 |
| --- | --- |
| Slash Commands | 프로바이더 명령 참조 |
| Git Diff | 작업 디렉터리 변경 사항 실시간 표시 |
| Terminal | 직접 키보드 입력과 자동 크기 조정을 지원하는 내장 xterm.js PTY |
| Capabilities | 활성 Skills 및 MCP 서버의 읽기 전용 카탈로그 |
| Experiments | 기능 토글 및 개발자 진단 |

## 키보드 단축키

| 키 | 동작 |
| --- | --- |
| ⌘B / Ctrl B | 왼쪽 사이드바 토글 |
| ⌘⌥B / Ctrl Alt B | 워크벤치 어사이드 토글 |
| ⇧⌘G / Ctrl Shift G | Git 작업 |
| ⌘N(웹에서는 ⌥N) | 새 대화 |
| ⇧⌘N(웹에서는 ⌥⇧N) | 워크스페이스 추가 |
| ⇧⌘K / Ctrl Shift K | 칸반 작업 보드 |
| ⇧⌘T(웹에서는 ⌥⇧T) | 터미널 보기(SSH 호스트, 키, 원격 파일) |

> 브라우저는 ⌘N / ⇧⌘N / ⇧⌘T를 예약하므로, 웹 클라이언트는 두 개의 "새로
> 만들기" 작업과 터미널 보기에 Option 수정자를 사용합니다. 나머지는 모두 동일합니다.

수정자 키를 잠시 누르고 있으면 UI에 단축키 힌트 배지가 표시됩니다.
`),
    },

    // ------------------------------------------------------------------- Mobile

    'mobile': {
      slug: 'mobile',
      title: '모바일',
      description: '네이티브 iPhone & iPad 클라이언트 — 출시 예정.',
      body: body(`
> **출시 예정.** 모바일 클라이언트는 활발히 개발 중입니다. 이
> 페이지는 계획된 내용을 추적하며, 첫 베타가 출시되면 전체 문서로
> 대체됩니다.

Todex Mobile은 같은 \`todex-agentd\` 백엔드와 페어링되는 iPhone 및
iPad용 네이티브 Swift + UIKit 앱입니다 — 같은 워크스페이스, 대화,
승인, 터미널 세션을 주머니 속에서 사용할 수 있습니다.

## 계획된 기능

- **카메라 페어링** — 다중 프레임 ML-KEM 세그먼트를 포함한 백엔드
  QR 코드를 스캔하거나 페어링 JSON을 가져옵니다. 디바이스 인증은
  데스크톱 흐름과 같이 동작합니다.
- **채팅 + 콘솔** — 넓은 화면에서는 2-페인 레이아웃: 한쪽에는 대화
  타임라인, 다른 쪽에는 터미널, 파일, 브라우저 미리보기, Git이 있는
  워크벤치.
- **완전한 턴 제어** — 승인, 플랜 모드 피드백, 모델 및 추론 선택기,
  메시지 큐잉, 자리를 비운 동안 대화가 끝나면 로컬 알림.
- **동일한 보안 모델** — Ed25519 디바이스 서명과 X25519 / ML-KEM-768
  전송 암호화, 토큰은 iOS Keychain에 저장됩니다.

## 그동안에는

[웹 클라이언트](/docs/introduction/quick-start)는 이미 접근 가능한
백엔드에 대해 모바일 브라우저에서 동작합니다 — 네이티브 셸은
아니지만 동일한 워크벤치 UI입니다. 백엔드 페어링 세부 정보는
[보안 및 페어링](/docs/backend/security)을 참조하세요.
`),
    },
  },
};
