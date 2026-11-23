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
Claude Code, Pi, Devin, OpenCode, Grok Build, Antigravity, DeepSeek Harness, omp 및 모든 ACP 호환 에이전트)를
단일 인증 API 뒤에서 오케스트레이션합니다. 데스크톱, 웹, 모바일 클라이언트는 암호화된 채널을 통해 연결됩니다.

어떤 트래픽도 TodeX 인프라를 경유하지 않습니다. 백엔드는 사용자의 머신이나 서버에서 실행되고, 에이전트는 본인의 계정과 자격 증명으로 동작하며, 코드는 승인된 워크스페이스 루트를 절대 벗어나지 않습니다.

## 구성 요소

\`\`\`text
TodeX Desktop (Electron)          TodeX Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 기기 인증 + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, dsh, agy, omp…)
\`\`\`

| 구성 요소 | 역할 |
| --- | --- |
| **백엔드** | \`todex-agentd\`. 대화, 워크스페이스, Provider 드라이버, 백엔드 그룹, 보안을 전담하는 데몬입니다. |
| **데스크톱** | Electron + React 19 기반 클라이언트로 사용자 지정 홈, 3패널 워크벤치, 로컬 IPC, 컨테이너 통합을 제공합니다. |
| **웹** | 설치 없이 HTTP로 동일한 워크벤치를 제공하며, 직접 연결 또는 셀프 호스팅 프록시를 지원합니다. |
| **모바일** | iPhone 및 iPad용 네이티브 Swift + UIKit 클라이언트입니다(활발히 개발 중). |

## 핵심 특징

- **에이전트 비종속성.** 대화가 특정 Provider에 묶이지 않습니다. 스레드마다 에이전트를 바꾸거나 한 워크스페이스에서 여러 에이전트를 병렬 실행하고, \`todex_agents\`를 통해 에이전트끼리 서로 호출할 수도 있습니다.
- **백엔드 그룹과 종단간 암호화 기록.** 분산 신뢰 그룹에 한 번만 가입하면 그룹 내 모든 백엔드에 접근할 수 있으며, X-Wing으로 디스크에 암호화 저장된 대화 기록 권한도 자동으로 부여됩니다.
- **스마트 작업 모드 및 계획 검토.** Claude Code에서 계획 모델로 조사·초안 작성 → 타임라인에서 계획 검토·승인 → 자동 승인이 적용된 실행 모델로 턴 도중 전환 → 필요 시 자동으로 계획 단계 재진입까지 2단계 흐름으로 운영합니다.
- **완전한 워크벤치.** 사용자 지정 홈 보드, 파일 칩과 사고 점 애니메이션이 포함된 실행 타임라인, 입력창 위 실시간 계획 단계, Git Diff, 내장 xterm.js 터미널, Agent 브라우저(Chromium / Kitesurf), Computer Use 실시간 화면을 데스크톱과 웹에서 동일하게 제공합니다.

## 다음 단계

| 목적 | 문서 |
| --- | --- |
| 2.5 새 기능을 대화형 워크벤치 미리보기로 살펴보기 | [2.5 새 기능](/docs/introduction/whats-new) |
| 10분 만에 시작하기 | [빠른 시작](/docs/introduction/quick-start) |
| 용어와 구조 익히기 | [핵심 개념](/docs/introduction/concepts) |
| 백엔드 설치 및 운영 | [백엔드 개요](/docs/backend) |
| 데스크톱 앱 사용하기 | [데스크톱 개요](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: '2.5 새 기능',
      description: '백엔드 그룹, 스마트 작업 모드, 계획 검토 및 실시간 단계 목록, 사용자 지정 홈 보드, Kitesurf 엔진, 단일 창 Computer Use — 각 기능의 워크벤치 미리보기 포함.',
      body: body(`
TodeX 2.5(2026년 11월)는 **다중 백엔드 간 분산 신뢰**와 **에이전트 워크플로 제어성**에 초점을 맞췄습니다. 중앙 서버 없이 백엔드와 기기를 하나의 그룹으로 묶고, Claude Code에 2단계 스마트 작업 모드를 도입했으며, 타임라인·홈 보드·실시간 화면 도구를 한층 정교하게 다듬었습니다.

먼저 새 대화 생성부터 계획 단계 표시, 작업 과정 펼치기, 스트리밍 답변까지 전체 흐름을 확인해 보세요:

:::demo

## 백엔드 그룹

이전에는 새 기기나 서버가 늘 때마다 각각 일대일 페어링을 거쳐야 했습니다. **백엔드 그룹**(Mesh v1)은 여러 백엔드(노드)와 클라이언트 기기를 중앙 서버 없는 단일 신뢰 그룹으로 묶어 줍니다:

- **한 번 가입으로 모든 노드 연결.** 새 기기에서는 **초대 QR 코드**를 스캔하거나 초대 문자열을 붙여넣습니다(초대에는 백엔드 주소만 포함되며 키는 담기지 않습니다). 백엔드가 아닌 **그룹 내 기존 기기 아무 곳에서나** 확인 코드를 대조해 **승인**하면 그룹의 모든 백엔드 사용 권한과 암호화된 기록 접근 권한이 한 번에 부여됩니다.
- **유연한 백엔드 추가.** 이미 일대일로 페어링된 백엔드는 기존 대화와 기록을 유지한 채 제자리에서 그룹에 편입할 수 있고, 새 백엔드는 주소와 24시간 일회용 **참여 코드**(\`todex-agentd mesh join-code\`)로 추가할 수 있습니다.
- **로컬 IPC 우선 + 그룹 연결 대기 유지.** 이 컴퓨터의 백엔드가 그룹에 속하면서 로컬 IPC로도 연결된 경우, 작업과 대화 데이터는 빠른 IPC로 오가고(**이 컴퓨터 · 데이터는 IPC로**), 그룹 연결은 온라인 상태·명단 동기화·가입 요청 수신용 대기로 유지됩니다. 동일 데몬을 가리키는 프로필끼리는 기록 권한을 자동으로 공유합니다.
- **접속 상태, LAN 비콘 및 종단간 암호화 릴레이.** 기기 멤버의 온라인/마지막 접속 시각을 표시하며, 노드별 **고정 주소**와 데스크톱의 UDP 21047 LAN 비콘 탐색을 지원합니다. 모든 직접 주소가 닿지 않을 때는 기기 서명 티켓을 통해 그룹 내 다른 노드를 경유한 **암호화 릴레이**(\`<노드>\` **경유**, 릴레이는 내용을 볼 수 없음)로 연결하고, 직접 연결이 복구되면 자동으로 되돌아옵니다.
- **24단어 복구 키 및 분리 관리.** 그룹 생성 시 1회 표시되는 24단어 복구 키로 모든 기기 분실 시에도 그룹과 기록을 복구할 수 있습니다. 일대일 백엔드는 **설정 → Backend 연결**에, 그룹 노드는 **설정 → 백엔드 그룹**에 표시됩니다.

:::demo mesh

자세한 내용은 [백엔드 연결](/docs/desktop/connect) 및 [보안 및 페어링](/docs/backend/security)을 참고하세요.

## 스마트 작업 모드 및 계획 검토

**스마트 작업 모드**는 Claude Code에서 모델 분리형 계획 수립과 자동 승인 구현을 하나의 매끄러운 흐름으로 연결합니다:

- **2단계 설정(설정 → 스마트 작업 모드).** 기기별로 **계획 단계**(모델, 추론 강도, 매 계획마다 자동 첨부할 **계획 스킬** 예: \`plan-gate\`)와 **실행 단계**(모델, 추론 강도, 항상 **자동 승인**)를 지정합니다.
- **턴 도중 계획 인수인계(\`plan_handoff\`).** 입력창 작업 모드 메뉴에서 **스마트**를 선택합니다. 계획 중(**스마트 · 계획 중**) Claude가 \`ExitPlanMode\`로 계획을 제출하고 사용자가 승인하면, 백엔드가 실행 중인 Claude 프로세스를 턴 도중에 실행 모델과 자동 승인 모드로 전환한 뒤 전환 안내를 남기고 곧바로 구현(**스마트 · 실행 중**)을 이어 갑니다.
- **필요 시 계획 재진입(\`plan_reentered\`).** 실행 중 Claude가 스스로 \`EnterPlanMode\`를 호출하거나 사용자가 계획 스킬을 첨부해 후속 요청을 보내면 다시 계획 모델로 전환되며, 새 계획이 승인되면 재차 실행 단계로 넘어갑니다.
- **독립 계획 행 및 검토 카드.** \`ExitPlanMode\` 계획 본문이 타임라인에 별도의 Markdown **계획** 행으로 렌더링되며, 입력창 위에 **계획 승인 대기** 카드(스마트 모드에서는 전환될 실행 모델 표시)가 나타나 **승인**하거나 수정 의견을 적어 **수정 요청**을 보낼 수 있습니다.

:::demo smart

:::demo smart-settings

## 계획 단계, 작업별 실행 요약, 백그라운드 작업

- **입력창 위 계획 단계(\`계획 1/3\`).** Codex(\`turn/plan/updated\`), Claude Code(\`TodoWrite\`), Pi(\`@tintinweb/pi-tasks\`의 \`TaskCreate\`/\`TaskUpdate\`/\`TaskList\`, 턴을 넘어 유지), ACP 에이전트의 진행 상황을 통일된 \`plan.updated\` 스냅샷으로 정규화해 접을 수 있는 체크리스트로 보여 줍니다.
- **Codex 경고·자동 검토 안내 및 \`ultra\` 강도.** Codex의 \`provider_warning\`(턴당 중복 제거)과 \`auto_review\` 결과를 각각 한 줄의 조용한 안내로 표시하며, 세부 정보와 판단 근거는 툴팁에서 확인할 수 있습니다. Codex 추론 강도에 \`ultra\`가 추가되었습니다.

:::demo plan-steps

- **사고 점 애니메이션, 작업 제목, 파일 칩.** 실행 중인 도구 그룹은 BoardUI 사고 점 애니메이션과 함께 현재 동작(예: "\`page.tsx\` 읽는 중")을 표시하고, 완료 후에는 "파일 2개 편집 · 명령 1개 실행"처럼 요약 제목과 파일 칩으로 정리합니다.

:::demo execution-group

- **백그라운드 작업 중지 및 읽지 않음 유지.** Claude Code 턴 종료 후 백그라운드 명령이나 서브에이전트만 대기 중일 때 입력창 위에 **백그라운드 작업 중지** 버튼이 나타나며, 후속 턴에서도 백그라운드 작업 추적이 이어지고 타임라인 메모리 해제 후에도 완료된 대화의 읽지 않음 표시가 유지됩니다.
- **승인 제한 시간 폐지 및 알림 개선.** 권한 요청, 질문, 계획 검토의 10분 만료 제한을 없애 사용자가 응답하거나 취소할 때까지 대기합니다. 시스템 알림은 질문 원문 또는 구체적인 승인 대상을 표시하고 처리 즉시 사라집니다.

:::demo background-tasks

## 홈 보드, 계획 캘린더, 사이드바

- **사용자 지정 가능한 홈 화면.** 시작 시 **홈** 보드가 열려 **실행 중**, **답변 대기(승인 대기)**, **오늘 대화**, **오늘 사용량**, **시간별 사용량**, Codex / Claude Code **요금제 한도**(5시간 / 7일 창)를 한눈에 보여 줍니다. **레이아웃 사용자 지정**으로 드래그 정렬, 모서리 리사이즈, 카드 제거 및 다시 추가가 가능합니다.

:::demo home

- **계획 보드 및 캘린더.** 기존 칸반 보드가 **계획**으로 확장되어 **보드**와 **캘린더** 보기를 모두 제공합니다.
- **오프라인 워크스페이스 접기 및 폴더 상태 링.** 연결되지 않은 백엔드의 워크스페이스는 목록 끝의 **오프라인 백엔드의 워크스페이스 보기 (n)** 아래로 접히며, 그룹 폴더 아이콘에는 하위 워크스페이스의 가장 긴급한 상태 링(\`working > issue > unread\`)이 표시됩니다. 홈·터미널·계획·프로필 등 독립 페이지가 열려 있을 때는 뒤쪽 워크스페이스/대화 강조를 해제합니다.

:::demo offline-sidebar

## Agent 브라우저 및 Computer Use

- **실시간 화면 위치 선택.** Agent 브라우저와 Computer Use 실시간 화면을 **사이드 패널**(기본) 또는 **입력창 위** 중 원하는 곳에 배치할 수 있습니다.
- **단일 창 Computer Use 및 AI 커서.** 앱이나 창을 지정해 관찰하면 \`ScreenCaptureKit\`으로 해당 창만(다른 macOS Space나 다른 창 뒤에 있어도) 캡처하며 사용자 포인터를 빼앗지 않고 백그라운드로 조작합니다. 호스트와 실시간 화면 양쪽에 주황색 **AI 커서**가 마지막 동작 위치를 표시하며, macOS에서는 드래그 권한 가이드, 화면 기록 재시작 안내, ad-hoc 서명 경고, 호스트 컨트롤 빨간 **중지** 버튼을 제공합니다.

:::demo computer-live

- **실험적 Kitesurf 엔진, 헤드리스 Chromium, 사이트 승인.** Cloudflare의 헤드리스 **Kitesurf**(\`workerd\` 기반, 탭별 독립 컨텍스트, 데스크톱 환경 불필요)를 선택할 수 있으며, 디스플레이 없는 Linux에서도 Chromium이 자동으로 \`--headless\` 모드로 동작합니다. 로컬 외 사이트 방문 시 **사이트 승인**(\`이번만 허용\` / \`항상 허용\` / \`거부\`)을 묻고, 설정에서 **항상 허용된 사이트** 목록과 **사이트별 확인 / 승인 없음** 모드를 전환할 수 있습니다(DNS 확인을 통해 링크 로컬·클라우드 메타데이터·데몬 포트는 항상 차단). 크래시나 빈 페이지 실패는 콘솔 진단과 함께 \`PAGE_FAILED\`로 알립니다.

:::demo agent-browser

## 심볼릭 링크 스킬 및 Provider 개선

- **심볼릭 링크 스킬(\`링크\`).** 스킬 루트 최상단의 심볼릭 링크(예: \`~/.claude/skills/plan-gate -> ~/.codex/skills/plan-gate\`)를 읽기 전용 **링크** 배지로 목록에 표시해 스마트 작업 모드의 계획 스킬이나 \`@skill:\`로 바로 쓸 수 있습니다.

:::demo linked-skills

- **Antigravity ACP 상주 전환.** 대화마다 상주 \`agy acp\` 프로세스를 구동하여 네이티브 ACP 권한 승인 및 타임아웃이 적용된 TodeX MCP 도구를 사용하며, 구버전 \`~/.gemini/config\` 훅 잔여물을 자동 정리합니다.
- **Claude Code 실시간 모델 조회 및 512K 프리셋.** Claude Code는 CLI \`initialize\` 응답에서 모델과 추론 강도(\`ultracode\` 포함)를 직접 읽으며, 커스텀 모델 설정에는 정확한 **512K(\`524,288\` 토큰)** 컨텍스트 프리셋이 추가되었습니다.

## 2.4 핵심 기반 기능

**비공개 대화**(메모리 전용, \`⌘⇧P\` / \`⌥⇧P\`), **어느 답변에서나 분기**, Codex **\`/goal\`**, **로컬 IPC 백엔드**, **TodeX Docker 컨테이너**, **설정 동기화**, **기기 내 암호화 기록 캐시**, \`SHA256SUMS.sig\` **서명 검증 릴리스**가 그대로 이어집니다.
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: '빠른 시작',
      description: '백엔드 설치, 클라이언트 페어링 또는 그룹 가입, 첫 번째 에이전트 대화 시작하기.',
      body: body(`
백엔드를 실행할 머신과 인증이 완료된 에이전트 CLI(\`codex\`, \`claude\`, \`pi\`, \`devin\`, \`opencode\`, \`dsh\`, \`omp\` 등) 최소 1개가 필요합니다. 이 컴퓨터에서만 쓸 경우 데스크톱 앱의 [로컬 백엔드](/docs/desktop/local-backend)에서 원클릭으로 배포하고 IPC 연결할 수 있습니다.

## 1. 백엔드 설치

macOS, Linux, WSL 지원(Rust 툴체인 불필요):

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

스크립트가 \`SHA256SUMS.sig\` 서명을 검증하고 \`~/.local/bin\`에 \`todex-agentd\`를 설치한 뒤 실행 중인 관리 데몬을 재시작합니다. 버전 고정은 \`install.sh install --version 2.5.0\`, 소스 빌드는 \`cargo build --release\`를 사용합니다.

## 2. 실행 및 기기 승인

\`\`\`bash
todex-agentd tui
\`\`\`

TUI에서 데몬 상태, 실시간 로그, 기기 관리, 페어링 QR 코드를 확인할 수 있습니다. 클라이언트 첫 연결 시 \`d\`를 눌러 확인 코드와 키 지문을 대조하고 \`a\`로 승인(\`r\`로 거부)하세요. TUI를 종료해도 데몬은 백그라운드에서 계속 실행됩니다.

## 3. 클라이언트 연결

- **데스크톱**: GitHub Releases에서 패키지를 설치합니다. 로컬 전용은 **설정 → 로컬 백엔드**, 원격 연결은 **설정 → Backend 연결**에서 URL(기본 \`http://127.0.0.1:7345\`)만 입력해 기기 검증을 마칩니다.
- **웹**: 호스팅 사이트 또는 직접 배포한 \`/app\`을 열어 동일한 방식으로 연결합니다.
- **다중 기기 / 백엔드**: **설정 → 백엔드 그룹**에서 그룹을 만든 뒤 추가 기기에서 **초대 QR 코드**를 스캔하면 터미널 없이 기존 기기에서 바로 승인할 수 있습니다. [백엔드 연결](/docs/desktop/connect)을 참고하세요.

## 4. 워크스페이스와 대화 시작

설정한 워크스페이스 루트(기본 \`~/projects\`) 안의 프로젝트 폴더를 추가하고 원하는 에이전트를 선택해 작업을 시작하세요. 프롬프트, 승인, 계획 검토, 실시간 단계, 터미널, Git Diff가 모두 같은 암호화 연결로 스트리밍됩니다.

## 문제 해결

| 증상 | 점검 항목 |
| --- | --- |
| 백엔드에 연결되지 않음 | \`todex-agentd daemon status\` 실행(기본 포트 \`7345\`) |
| 모든 요청이 \`401\` 반환 | 기기 미승인 또는 그룹 제외 — TUI \`d\` 패널 또는 그룹 명단 확인 |
| REST는 되지만 WebSocket 실패 | 암호화 키 또는 프록시 헤더 불일치 — 설정에서 **다시 페어링** 실행 |
| 에이전트 사용 불가 표시 | 호스트에 CLI 미설치 또는 미로그인(**설정 → CLI 관리**에서 확인) |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: '핵심 개념',
      description: '모든 TodeX 화면 뒤에 있는 핵심 용어: Provider, 워크스페이스, 대화, 기기와 그룹, 기록 암호화.',
      body: body(`
## Provider와 드라이버

*Provider*는 백엔드가 구동하는 에이전트 엔진(**Codex**, **Claude Code**, **Pi**, **Grok Build**, **Devin**, **OpenCode**, **Antigravity**, **DeepSeek Harness (dsh)**, **omp (oh-my-pi)** 및 \`config.toml\`의 ACP 2.0 프로필)입니다. 네이티브 드라이버(JSON-RPC app-server, stream-json, RPC, ACP stdio)를 통해 모델, 추론 강도, 슬래시 명령, 스킬, MCP 서버를 설치된 CLI에서 실시간으로 읽어 옵니다.

*Provider 계정*은 에이전트당 여러 계정·게이트웨이 구성을 저장해 두고 활성화 시 기존 설정을 백업한 뒤 CLI 전역 설정 또는 패치 레이어를 갱신하므로, TodeX 외부에서 CLI를 실행해도 똑같이 동작합니다.

## 워크스페이스

*워크스페이스*는 \`TODEX_AGENTD_WORKSPACE_ROOT\`(기본 \`~/projects\`) 하위의 프로젝트 디렉터리 또는 Docker [컨테이너 워크스페이스](/docs/desktop/containers)입니다. 에이전트, PTY 터미널, Git 작업은 승인된 경계 안에서만 실행됩니다.

## 대화

영구 저장되는 대화는 \`$DATA_DIR/conversations/<uuid>/\` 폴더에 보관됩니다(데몬 메모리에서만 유지되는 [비공개 대화](/docs/backend/security) 제외):

| 파일 | 내용 |
| --- | --- |
| \`manifest.json\` | 메타데이터, 활성 Provider 프로필, 워크스페이스, 타임스탬프, 암호화 제목 |
| \`events.jsonl\` | 추가 전용 이벤트 저널(\`$enc\` 암호문 포함 — 기록의 원본) |
| \`snapshot.json\` | 빠른 재로드를 위한 상태 스냅샷 |
| \`provider-state.json\` | 턴 재개용 네이티브 엔진 상태 |

턴은 낙관적 동시성 제어로 보호되어 실행 중 충돌 요청에는 \`409 Conflict\`를 반환하며, 입력창에서 보낸 후속 메시지는 백엔드 대기열에 안전하게 저장됩니다.

## 기기, 페어링, 백엔드 그룹

TodeX는 비밀번호 로그인을 쓰지 않습니다:

- **일대일 기기 페어링(Pairing v3)**: 각 기기가 Ed25519 키 쌍을 생성하고 TUI 확인 코드 검증을 통해 기기 키, 전송 프로토콜, 백엔드 공개 키를 한 번에 고정합니다.
- **백엔드 그룹(Mesh v1)**: 서명된 명단 체인(\`todex.mesh.roster\`)으로 묶인 분산 신뢰 그룹입니다. 그룹 내 기존 기기 한 곳이 새 기기를 승인하면 그룹 내 모든 백엔드와 암호화된 기록 접근 권한이 함께 부여됩니다.

## 전송 암호화 및 기록 암호화

| 계층 | 방식 | 설명 |
| --- | --- | --- |
| **전송** | \`ml-kem-768\`(기본) / \`x25519\` / \`none\` | REST는 \`POST /v2/sealed\`, WebSocket은 \`tv=2\` 암호화 프레임을 사용(\`none\`은 루프백 전용). |
| **기록** | X-Wing 종단간 암호화(history v3) | 디스크 기록 전 승인된 기기 키와 24단어 복구 키용으로 암호화되며, 백엔드는 복호화 개인 키를 갖지 않습니다. |

## 테넌트

모든 데이터는 \`tenant_id\`로 격리되어 조회나 구독이 테넌트 경계를 넘지 않습니다.
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: '백엔드 개요',
      description: 'todex-agentd — 에이전트, 대화 엔진, 백엔드 그룹, 보안을 담당하는 Rust 데몬.',
      body: body(`
\`todex-agentd\`는 Tokio와 Axum으로 작성된 단일 Rust 바이너리로, 인증된 REST API(\`/v2/*\`)와 다중화 WebSocket(\`/v2/ws\`)을 제공합니다. \`[api] enabled = true\` 설정 시 스크립트·CI용 API 키 기반 REST + SSE 포트도 제공합니다([외부 API와 키](/docs/backend/external-api)).

## Provider 드라이버

| Provider | 전송 | 비고 |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\` / \`turn\` / \`status\` / \`stop\` / \`attach\` / \`replay\` / \`interrupt\`, 어느 답변에서나 분기, \`/goal\`, \`provider_warning\`·\`auto_review\` |
| **Claude Code** | stream-json | \`initialize\` 실시간 모델 조회, 스마트 작업 모드(\`afterPlan\` / \`replan\`), 계획 검토 카드, 백그라운드 중지 |
| **Pi** | 네이티브 RPC | 동적 모델·명령 탐색, 도구 승인, \`/todex compact\`, \`@tintinweb/pi-tasks\` 턴 간 계획 추적 |
| **Grok Build** | 상주 ACP / 관리 CLI | 자체 업데이트, 도구 승인 및 질문 프롬프트 |
| **Antigravity** | 상주 ACP(\`agy acp\`) | 대화당 상주 프로세스, ACP 권한 승인(계정 지원 시 Auto 검토 사용), TodeX MCP 연동, 구형 훅 정리 |
| **DeepSeek Harness** | 상주 ACP(\`dsh\`) | 패치 레이어 관리, 번들·npm 플러그인 제어, 커스텀 라우팅 |
| **ACP 2.0** | 상주 / 턴별 stdio | Devin, OpenCode, omp(\`omp acp\`), \`config.toml\` 커스텀 ACP 프로필 |

백엔드는 UI 구성을 위해 Provider 설치를 변조하지 않으며, 프로젝트 우선 순위로 카탈로그를 읽고 최상위 심볼릭 링크 스킬(\`linked: true\`)도 읽기 전용으로 인식합니다.

## 대화 엔진 및 통합 계획 스트림

- 모든 턴 상태는 추가 전용 \`events.jsonl\`과 스냅샷으로 유지되며 \`afterSequence\` 기반으로 재연결·재시작 후에도 손실 없이 재동기화됩니다.
- **Provider 공통 \`plan.updated\` 정규화**: Codex, Claude Code(\`TodoWrite\`), Pi(\`@tintinweb/pi-tasks\`), ACP의 계획 업데이트를 일관된 \`steps\` / \`explanation\` 스냅샷으로 변환합니다.
- **승인 대기 무제한**: 권한 요청·질문·계획 검토의 10분 타임아웃을 제거해 응답 또는 취소 시까지 대기합니다.

## 단일 소켓 다중화

\`/v2/ws\`는 대화 구독, 프롬프트 전달, 권한 응답, \`conversation.backgroundTasks.stop\`, PTY 터미널(재연결 시 화면 스냅샷 복구), 기록 키 권한, \`mesh.*\` 그룹 제어 메시지를 단일 연결로 처리합니다.

## 데몬 관리

대화형 TUI(\`todex-agentd tui\`), 백그라운드 데몬(\`daemon start|stop|restart|status\`), 로그인 자동 시작(\`daemon autostart enable\`), 헤드리스 CLI 명령을 제공합니다. [설치 및 실행](/docs/backend/install)을 확인하세요.
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: '설치 및 실행',
      description: '설치 스크립트, 소스 빌드, 실행 모드, 헤드리스 및 그룹 관리 명령.',
      body: body(`
## 설치 스크립트 (macOS / Linux / WSL)

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # 최신 릴리스 설치 또는 업데이트
install.sh update                  # 기존 설치 업데이트
install.sh install --version 2.5.0 # 특정 버전 고정 설치
install.sh status                  # 설치/최신 버전 및 데몬 상태 확인
install.sh uninstall               # 데몬 중지 및 바이너리 제거
install.sh uninstall --purge       # ~/.todex-agent 데이터 디렉터리까지 삭제
\`\`\`

\`~/.local/bin\`(\`--prefix\` / \`TODEX_INSTALL_DIR\`로 변경 가능)에 설치하며, \`SHA256SUMS\` 및 Ed25519 서명 \`SHA256SUMS.sig\`를 검증하고 롤백본 1개를 보관한 뒤 실행 중인 데몬을 재시작합니다. 서명 검증 실패 시 \`--allow-unverified\` 없이는 설치를 거부합니다(2.3.6 이하 무서명 버전은 경고 후 체크섬만 검사). Linux 바이너리는 glibc 2.28+가 필요하며 Alpine 등은 소스 빌드가 필요합니다. \`TODEX_AUTO_UPDATE=0\`이 아니면 실행 시 자동 업데이트를 확인하고, 5분간 유휴 상태일 때 새 버전으로 재시작합니다.

## 소스에서 빌드

\`\`\`bash
cargo build --release
\`\`\`

Rust 1.80+(MSRV)가 필요하며 결과물은 \`todex-agentd\`입니다.

## 실행 모드

\`\`\`bash
# 대화형 TUI (상태, 로그, 기기 승인, API 키, 페어링 QR)
todex-agentd tui

# 포그라운드 서버
todex-agentd serve --host 127.0.0.1 --port 7345

# 백그라운드 데몬
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# 로그인 시 자동 실행
todex-agentd daemon autostart enable
\`\`\`

TUI를 종료해도 데몬은 계속 동작합니다. 터미널이 좁아 QR 코드가 잘릴 때는 팝업에서 \`b\`를 눌러 브라우저에 정사각형 SVG를 띄울 수 있습니다.

## 헤드리스 관리 및 그룹 명령

\`\`\`bash
# 일대일 페어링 및 기기 관리
todex-agentd pair list
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>

# 백엔드 그룹 (Mesh v1)
todex-agentd mesh status                  # 노드 ID와 가입된 그룹 확인
todex-agentd mesh join-code [--new]       # 24시간 일회용 참여 코드 표시/갱신

# Provider CLI 및 브라우저 구성 요소 설치
todex-agentd providers install codex claude --if-missing
todex-agentd browser install
\`\`\`

종료 코드 \`2\`는 일치 항목 없음, \`3\`은 데몬과 다른 사용자로 실행했음을 의미합니다. 데스크톱 로컬 배포는 [로컬 백엔드](/docs/desktop/local-backend)를 참고하세요.
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: '구성',
      description: 'config.toml, 환경 변수 및 적용 우선순위.',
      body: body(`
## 우선순위

1. 명령줄 플래그
2. 환경 변수
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\`(기본 \`~/.todex-agent/config.toml\`)
4. 내장 기본값

## 주요 옵션

| 옵션 | CLI 플래그 | 환경 변수 | 기본값 |
| --- | --- | --- | --- |
| 호스트 | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| 포트 | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| 데이터 디렉터리 | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| 워크스페이스 루트 | \`--workspace-root\`(반복 가능) | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| 기본 에이전트 | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex / Claude / Pi / omp | — | \`TODEX_AGENTD_*_BIN\` / \`[agent].omp_bin\` | \`codex\` / \`claude\` / \`pi\` / \`omp\` |
| 상주 유지 시간(초) | — | \`TODEX_AGENTD_PROVIDER_KEEPALIVE_SECONDS\` | \`300\`(\`30..=604800\`) |
| 기기 인증 | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| 페어링 암호화 | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |
| 외부 API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | 꺼짐 / \`7346\` |
| 네트워크 리스너 | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| 로컬 IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | 켜짐 / \`<data_dir>/agentd.sock\` |
| 허용 브라우저 Origin | — | \`TODEX_AGENTD_CORS_ORIGINS\` | 없음 |
| 신뢰할 수 있는 프록시 | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | 없음 |
| 페어링 Origin | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | 없음 |
| 그룹 LAN 비콘 | — | \`TODEX_AGENTD_MESH_BEACON\` | \`true\`(UDP 21047) |
| 헤드리스 브라우저 강제 | — | \`TODEX_AGENT_BROWSER_HEADLESS\` | 자동(디스플레이 없으면 headless) |
| Kitesurf / workerd 경로 | — | \`TODEX_AGENT_BROWSER_KITESURF_DIR\` / \`TODEX_WORKERD_PATH\` | 자동 다운로드 |

\`network_enabled = false\`를 쓰려면 IPC가 켜져 있어야 합니다(에이전트 도구용 랜덤 루프백 포트만 남깁니다). 백엔드 그룹 기능은 네트워크 접근과 \`enable_auth = true\`가 필요합니다. 컨테이너 변수는 [컨테이너](/docs/desktop/containers)를 참고하세요.

## \`config.toml\` 예시

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

> **참고:** 네이티브 리스너에서 \`enable_tls = true\`는 잘못된 보안 가정을 막기 위해 의도적으로 차단됩니다. 원격 접속 시에는 Nginx, Caddy, Cloudflare Tunnel 등 신뢰할 수 있는 리버스 프록시에서 TLS를 종단하세요.
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: '보안 및 페어링',
      description: '기기 검증, 백엔드 그룹 신뢰 모델, E2E 기록 암호화, 브라우저 사이트 보호 및 개인정보 필터.',
      body: body(`
TodeX는 fail-closed 보안 모델을 따릅니다. 승인되지 않은 기기는 백엔드와 통신할 수 없으며, 모든 요청에 서명이 포함되고, 디스크상의 대화 기록은 종단간 암호화됩니다.

## 일대일 기기 검증 (Pairing v3)

1. 백엔드 URL만 입력하면 클라이언트가 난수 확인 코드와 전송 키 지문(\`XXXX-XXXX-XXXX-XXXX\`)을 표시합니다.
2. 백엔드 TUI에서 \`d\`를 눌러 대조한 뒤 \`a\`로 승인하거나 \`r\`로 거부합니다(\`x\`로 언제든 폐기 가능).
3. 확인 코드가 전송 프로토콜과 공개 키를 묶어 검증하므로 기기 키·프로토콜·서버 공개 키가 한 번에 고정됩니다. 폐기된 기기는 다음 요청부터 \`401\`을 받고 WebSocket은 5초 내에 \`4401\`로 종료됩니다.

## 백엔드 그룹 및 암호화 릴레이 (Mesh v1)

- **서명된 명단 체인(\`todex.mesh.roster\`)**: 이전 명단의 멤버 기기(또는 24단어 복구 서명 키)만 다음 명단에 서명할 수 있습니다. 제거된 기기는 온라인 노드에서 즉시 접근 및 기록 권한을 잃습니다.
- **기기 간 승인**: 새 기기는 **초대 QR 코드**(주소만 포함, 키 없음)로 노드에 연결하고 **그룹 내 기존 기기**에서 확인 코드를 대조해 승인합니다. 노드의 로컬 TUI나 \`devices.json\`에는 기록되지 않습니다.
- **상호 HMAC 참여 코드**: 참여 코드로 백엔드를 추가할 때 80비트 base32 비밀값의 양방향 HMAC 증명을 검증하며 5회 실패 시 폐기합니다.
- **종단간 암호화 릴레이**: \`/v2/mesh/relay/{node}/{ticket}/{path}\`는 기기 서명 티켓이 필요하며(노드당 최대 64개 동시 연결), 릴레이 노드는 암호화된 바이트만 전달할 뿐 평문을 열람하거나 위조할 수 없습니다.

## 전송 암호화

| 모드 | 스위트 | 용도 |
| --- | --- | --- |
| \`none\` | 평문 | 루프백 전용 |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | 일반 원격 접속 |
| \`ml-kem-768\` | NIST 양자 내성 ML-KEM | 페어링 기본값 |

키는 페어링이나 서명된 \`node-info\`로만 전달되며 수동 키 가져오기는 허용되지 않습니다.

## 기록 암호화 및 동일 데몬 프로필 공유

- 이벤트와 제목은 디스크에 쓰기 전 승인된 기기의 X-Wing 키와 24단어 복구 키용으로 암호화되며, 백엔드에는 복호화 개인 키가 없습니다. 클라이언트 로컬 캐시 역시 암호문만 저장합니다.
- 백엔드 그룹 가입이 승인되면 온라인 상태인 그룹 기기가 별도 확인 없이 자동으로 기록 권한을 부여합니다.
- 동일 데몬(같은 고정 전송 키)을 가리키는 IPC·TCP·그룹 노드 프로필은 요청 시 자동으로 기록 접근 권한을 서로 부여하므로 로컬 IPC 전환 후에도 이전 기록이 유지됩니다.

## 브라우저 Origin 및 프록시 경계

\`todex-desktop://app\`, 루프백 페이지, \`security.cors_origins\`에 정확히 일치하는 Origin만 허용하며, \`Forwarded\` / \`X-Forwarded-For\` / \`X-Real-IP\` 헤더가 있으면 \`security.trusted_proxies\`에 등록되지 않는 한 원격 요청으로 취급합니다.

## Agent 브라우저 사이트 보호

- Chromium과 Kitesurf 모두 모든 탭 요청을 가로채 확인합니다. \`localhost\` 외 외부·LAN 호스트는 \`desktop_browser_host\` 승인(이번만 / 항상 허용 / 거부)을 요구합니다.
- **승인 없음** 모드로 전환하더라도 DNS 확인을 통해 링크 로컬(\`169.254.0.0/16\` 등), 클라우드 메타데이터(\`fd00:ec2::254\`), URL 내 자격 증명, 데몬 포트는 계속 차단하며, 비밀번호 입력란은 항상 일회성 확인(\`SENSITIVE_ACTION\`)을 요구합니다.

## 로컬 IPC, 서명된 릴리스, 비공개 대화, 개인정보 필터

- **로컬 IPC**: Unix 소켓(Windows 명명된 파이프)은 데몬 실행 OS 사용자만 열 수 있으며 \`/v2/local-admin/*\`을 제공합니다.
- **서명 릴리스**: \`install.sh\`, 자동 업데이트, 데스크톱 배포 모두 \`SHA256SUMS.sig\` 서명을 검증합니다.
- **비공개 대화**: 데몬 메모리에서만 유지되며 재시작 시 소멸합니다(Linux/macOS 일부 CLI 임시 파일 포함).
- **개인정보 필터**: \`todex_ssh\` 출력의 개인 키·자격 증명·카드 번호·각국 신분증·프록시 정보를 가리고 공격적 옵션과 최대 32개 사용자 지정 키 이름을 지원하며, 사용자 출력 창에서는 긁어서 볼 수 있는 보호막 아래 표시됩니다.
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API 레퍼런스',
      description: '/v2 REST 표면, 다중화 /v2/ws WebSocket 및 2.5 추가 이벤트.',
      body: body(`
모든 기기 엔드포인트는 \`/v2\` 아래에 있으며 Ed25519 서명이 포함된 JSON으로 통신합니다(암호화 활성 시 \`POST /v2/sealed\` 경유). 스크립트용 API 키 엔드포인트(\`/api/v1\`)는 [외부 API와 키](/docs/backend/external-api)를 확인하세요.

## 시스템 및 백엔드 그룹

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /health\` | 생존 확인 |
| \`GET /v2/version\` | 데몬 버전, 워크스페이스 루트, 기능 플래그, \`mesh: 1\` 지원 여부 |
| \`ALL /v2/mesh/relay/{node}/{ticket}/{path}\` | 그룹 노드를 통한 공개 경로 및 \`tv=2\` WebSocket 종단간 릴레이 |

## 워크스페이스 · Provider · CLI

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET / PUT /v2/workspaces\`, \`DELETE /v2/workspaces/{id}\` | 워크스페이스 조회·병합·제거(대화 보존) |
| \`GET /v2/workspace/{entries,directories,file}\` | \`@\` 파일 추천, 디렉터리 탐색, 샌드박스 내 파일 읽기 |
| \`GET /v2/providers\`, \`versions\`, \`models\`, \`commands\` | 기능 플래그(\`supportsReplan\`, \`backgroundTaskStop\`), CLI 버전, 동적 모델, 심볼릭 링크 스킬(\`linked: true\`) |
| \`POST /v2/providers/{provider}/{install,upgrade}\` | 관리형 CLI 설치 및 단일 실행 업그레이드 |

## 대화 및 스마트 작업 모드

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET / POST /v2/conversations\`, \`GET /v2/conversations/{id}\` | 대화 생성·목록·매니페스트 조회 |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | 이벤트 저널 페이지네이션(\`beforeSequence\` 역방향 조회) |
| \`POST /v2/conversations/{id}/prompt\` | 턴 시작(Claude 스마트 모드용 \`afterPlan\`, \`replan\` 지원) |
| \`POST /v2/conversations/{id}/cancel\` | 실행 중 턴 취소 |
| \`POST /v2/conversations/{id}/background-tasks/stop\` | 턴 사이 대기 중인 백그라운드 작업 중지 |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | 도구, \`user_input\`, \`plan\`, 호스트 승인 응답 |

## Agent 데스크톱 도구

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET / PUT /v2/agent-desktop\` | 도구 켜기/끄기, \`browserEngine\`(\`chromium\` / \`kitesurf\`), \`browserHostApproval\`(\`ask\` / \`auto\`), 권한 상태 |
| \`POST /v2/agent-browser/install\` | 선택한 브라우저 엔진 다운로드 |
| \`GET /v2/agent-browser/hosts\`, \`DELETE .../hosts/{host}\` | 항상 허용된 외부 사이트 목록 조회·제거 |
| \`GET /v2/agent-desktop/computer/apps\` | \`@app:\` 멘션용 실행·설치 앱 목록 |
| \`POST /v2/agent-desktop/computer/permissions\` | macOS 시스템 설정 및 드래그 권한 가이드 표시 |

## WebSocket — \`/v2/ws\`

- \`conversation.subscribe\`: \`afterSequence\` 재동기화, 통합 정규화 \`plan.updated\`, \`provider.event\`(\`plan_handoff\`, \`plan_reentered\`, \`provider_warning\`, \`auto_review\`, \`background_tasks_pending\`, \`background_tasks_ended\`)
- 프롬프트 전송, 취소, 권한 결정, \`conversation.backgroundTasks.stop\`
- \`terminal.*\`: PTY 세션 및 화면 스냅샷 재연결
- \`agentBrowser.{watch,frame}\` 및 \`desktop.computer.action\`(AI 커서 좌표 포함)
- \`mesh.{node.get,presence.get,state.get,state.push,join.list,join.approve,join.reject}\` 및 \`mesh.updated\` 브로드캐스트

정확한 스펙은 백엔드 저장소의 [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)와 [docs/mesh-v1.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/mesh-v1.md)를 참고하세요.
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: '외부 API와 키',
      description: '백엔드가 발급한 API 키로 스크립트·CI에서 REST + SSE로 에이전트를 호출합니다.',
      body: body(`
기기 포트(\`7345\`) 외에 \`todex-agentd\`는 스크립트와 CI 작업을 위한 별도 REST + SSE 포트를 열 수 있습니다. 백엔드가 발급한 **API 키**로 인증하며(기기 페어링과 transport v2 불필요), 워크벤치 **설정 → 에이전트 호출**에서도 키를 만들고 관리할 수 있습니다.

## 활성화

기본값은 **비활성**입니다. \`config.toml\`의 \`[api] enabled = true\`, \`--enable-api\`, \`TODEX_AGENTD_API_ENABLED=true\`, 또는 **설정 → 에이전트 호출** / TUI에서 켜고 재시작하면 적용됩니다.

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # TLS 리버스 프록시 뒤에서만 사용
\`\`\`

API 포트는 메인 포트와 달라야 하며 CORS는 제공되지 않습니다.

## 키 발급 및 관리

키 형식은 \`tdx_<id>_<secret>\`이며 생성 직후 **한 번만** 전체 값이 표시됩니다. 백엔드는 \`<data_dir>/api-keys.json\`(\`0600\`)에 해시만 보관합니다.

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

TUI의 **API Keys** 패널(\`i\`)이나 **설정 → 에이전트 호출**에서 재시작 없이 생성·수정·폐기할 수 있으며, 폐기된 키는 즉시 \`401\`과 함께 실행 중 턴이 취소됩니다. 키마다 허용 에이전트·워크스페이스 범위, 승인 정책(\`ask\` / \`auto-approve\` / \`reject\`), 만료일을 지정할 수 있고 SSH·데스크톱·브라우저 MCP 도구는 주입되지 않습니다.

## 엔드포인트 (\`Authorization: Bearer <key>\` 또는 \`X-API-Key\`)

| 엔드포인트 | 용도 |
| --- | --- |
| \`GET /api/v1/health\`, \`me\`, \`agents\`, \`workspaces\` | 상태 확인, 키 정보, 허용된 에이전트·워크스페이스 |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | 실시간 모델 목록 |
| \`POST / GET /v1/conversations\`, \`GET / DELETE .../conversations/{id}\` | 키 전용 대화 생성·조회·삭제 |
| \`POST /v1/conversations/{id}/turns\`, \`cancel\`, \`permissions/{id}\` | 턴 실행(\`Accept: text/event-stream\` 시 SSE), 취소, 승인 응답 |
| \`GET /v1/conversations/{id}/events{/stream}\` | 이벤트 페이지 및 \`Last-Event-ID\` 기반 SSE 스트림 |
| \`POST /api/v1/runs\` | 새 대화 생성 + 단일 턴 일괄 실행(대기 또는 스트리밍) |

## 단발성 실행 예시

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"README 요약"}' \\
  http://127.0.0.1:7346/api/v1/runs

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"TODO 목록 출력","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

동기 호출의 \`timeoutSecs\`는 기본 600초(최대 3600초)이며 초과 시 턴을 취소하고 \`504\`를 반환합니다. 외부 API 대화 기록 역시 해당 키의 시크릿에서 파생된 수신자 키로 디스크에 암호화 저장됩니다.
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: '데스크톱 개요',
      description: 'Electron 클라이언트 — 사용자 지정 홈 보드, 3패널 워크벤치, 로컬 IPC, 컨테이너 통합.',
      body: body(`
TodeX Desktop은 Electron 44, React 19, Vite 7, Tailwind CSS v4 및 BoardUI 디자인 시스템으로 구축된 네이티브 클라이언트입니다. 웹 클라이언트와 동일한 \`@todex/protocol\` 및 세션 계층을 공유하면서 로컬 백엔드 배포, Docker 컨테이너, LAN 비콘 탐색, 로컬 암호화 기록 캐시 같은 네이티브 기능을 제공합니다.

## 홈 보드 및 3패널 구성

- **홈**: 실행 시 기본으로 열려 모든 연결 백엔드의 실행 중/승인 대기 대화, 일일 대화·토큰 수, 시간별 사용량, Codex / Claude Code 요금제 한도를 보여 주며 카드를 자유롭게 재배치·리사이즈할 수 있습니다.
- **왼쪽 사이드바**: 분할/통합 레이아웃, 태그 그룹화, 폴더 상태 링, 오프라인 백엔드 워크스페이스 접기, **계획**(보드·캘린더), **터미널**, **프로필**, **비공개 대화**를 제공합니다.
- **가운데 채팅**: 스트리밍 Markdown, 사고 점과 파일 칩이 달린 작업 제목 기반 실행 그룹, 독립 계획 검토 행·카드, 입력창 위 실시간 계획 단계, 스마트 작업 모드 전환, \`@\` / \`/\` / \`#\` 메뉴, 백그라운드 작업 중지 버튼을 제공합니다.
- **오른쪽 워크벤치**: **터미널**(xterm.js WebGL PTY), **파일**, **Git Diff**, **에이전트 호출** 탭과 함께 **Agent 브라우저** 및 **Computer Use** 실시간 화면을 표시합니다.

## 데스크톱 전용 기능

- **[로컬 백엔드](/docs/desktop/local-backend)**: 이 컴퓨터에 \`todex-agentd\`를 서명 검증 후 배포하고 IPC로 연결(그룹 내에서는 IPC로 데이터를 주고받으며 네트워크 연결은 대기로 유지).
- **[컨테이너](/docs/desktop/containers)**: Docker + Compose v2로 격리된 컨테이너 백엔드를 구동하고 유휴 시 자동 동결 및 정리를 수행합니다.
- **LAN 비콘 수신(UDP 21047)**: 로컬 네트워크에서 백엔드 그룹 노드의 IP 변경을 자동 탐지합니다.
- **기기 내 암호화 기록 캐시**: 최근 열어 본 대화를 암호문 상태로 로컬에 캐시해 즉시 엽니다.

릴리스 패키지는 GitHub Releases(Windows NSIS x64/ARM64, macOS Apple Silicon DMG, Linux x64 AppImage)로 배포됩니다. 빌드는 [설치 및 빌드](/docs/desktop/setup)를 보세요.
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: '설치 및 빌드',
      description: '필수 조건, 개발 모드, 릴리스 패키징, 마스킹된 진단 로그.',
      body: body(`
## 요구 사항

- Node.js 22+, pnpm 11+
- 같은 상위 폴더에 체크아웃된 \`TodeX_protocol\`(\`src\`에서 직접 컴파일)
- 실행 중인 \`todex-agentd\` 백엔드(기본 \`http://127.0.0.1:7345\`) 또는 브라우저 \`?demo\` 모드

## 설치 및 개발 실행

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

Electron 바이너리 다운로드가 끊겼다면 \`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\`로 복구할 수 있습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| \`pnpm run dev\` | 사전 검사 후 Vite 개발 모드로 실행(1280×800 창) |
| \`pnpm run build\` | main / preload / renderer 빌드 |
| \`pnpm run package\` | electron-builder로 배포 패키지 생성 |
| \`pnpm run preview\` | 프로덕션 빌드 미리보기 |
| \`pnpm run typecheck\` | main + renderer 타입 검사 |
| \`pnpm run check:electron\` | 네이티브 Electron 바이너리 검증 |

## 릴리스 및 개발 로그

**Release desktop packages** GitHub 워크플로에 시맨틱 버전(예: \`2.5.0\`)을 입력해 배포판을 생성합니다(개발 빌드는 \`DEV0.0.0\`). \`DEV0.0.0\` 빌드는 토큰·쿠키·키·첨부 파일이 마스킹된 진단 로그를 \`userData/logs/todex-desktop-debug.log\`(\`TODEX_DESKTOP_LOG_PATH\`로 재정의)에 기록합니다.
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: '백엔드 연결',
      description: '다중 백엔드 연결, 백엔드 그룹 가입, 설정 동기화, 연결 문제 진단.',
      body: body(`
TodeX는 **여러 백엔드에 동시에 연결**해 각 백엔드의 워크스페이스와 대화를 색상 점으로 구분해 관리합니다. 여러 기기와 백엔드를 함께 쓴다면 **백엔드 그룹**을 사용하는 것이 가장 간편합니다.

## 방법 1: 백엔드 그룹 (다중 기기·서버 권장)

**설정 → 백엔드 그룹**에서 중앙 서버 없이도 기기와 \`todex-agentd\`들을 분산 신뢰 그룹으로 연결합니다(허브를 지정해 탐색과 릴레이를 빠르게 할 수도 있습니다):

1. **생성 및 가입**: 첫 기기에서 **그룹 만들기**를 누르고 1회 표시되는 24단어 **복구 키**를 보관합니다. 새 기기에서는 **백엔드 그룹 → 그룹 가입**에서 **초대 QR 코드**를 스캔하거나 초대 문자열을 붙여넣고(주소만 포함, 키 없음), **그룹 내 기존 기기 아무 곳에서나** 확인 코드를 확인한 뒤 **승인**하면 그룹의 모든 백엔드와 기록을 즉시 사용할 수 있습니다.
2. **백엔드 추가**: 이미 일대일로 페어링한 백엔드는 **페어링된 백엔드**에서 기존 대화와 기록을 유지한 채 그룹에 추가할 수 있고, 새 백엔드는 **주소 및 참여 코드**(\`todex-agentd mesh join-code\`)로 추가합니다.
3. **로컬 IPC + 그룹 대기**: 이 컴퓨터의 백엔드가 그룹 노드로 포함되어 있고 [로컬 백엔드](/docs/desktop/local-backend) IPC로 연결되면 데이터는 IPC로 흐르고(**이 컴퓨터 · 데이터는 IPC로**), 그룹 연결은 온라인 상태·명단 동기화·가입 요청 수신용 대기로 유지됩니다. 같은 데몬의 프로필끼리는 기록 권한을 자동으로 공유합니다.
4. **고정 주소, LAN 비콘, 암호화 릴레이**: 노드 설정에 공인 IP·도메인·포트 포워딩 주소를 고정할 수 있고, 데스크톱은 UDP 21047 LAN 비콘을 수신합니다. 직접 연결이 모두 실패하면 그룹의 다른 노드를 통해 **종단간 암호화 릴레이**(\`<노드>\` **경유**)로 우회하고, 직접 연결이 살아나면 자동으로 복귀합니다.
5. **허브**: 공인 주소가 있고 항상 켜져 있는 백엔드의 노드 설정에서 **허브**를 켭니다(구성원 목록에 **허브**로 표시, 여러 대 가능). 다른 백엔드는 허브와 연결을 유지하며 최신 주소를 주고받고, 허브는 자신이 보는 공인 주소를 각 노드에 알려 줍니다. 기기는 먼저 허브를 거쳐 연결한 뒤 직접 주소가 동작하면 바로 직접 연결로 바꿉니다. 허브는 서명된 명단과 주소만 전달하며 릴레이 내용은 읽을 수 없습니다.

:::demo mesh

## 방법 2: 일대일 기기 페어링

그룹 밖의 개별 백엔드를 연결할 때는 **설정 → Backend 연결 → Backend 추가**에 URL만 입력한 뒤, 백엔드 TUI(\`d\` → \`a\`)에서 확인 코드와 키 지문을 승인합니다. 그룹 소속 노드는 **백엔드 그룹**에서만 관리됩니다.

## 설정 동기화 및 계정 내보내기

- **설정 동기화(설정 → Backend 연결 → 설정 동기화)**: 페어링된 두 백엔드를 나란히 놓고 **CLI 계정, 설정, MCP 서버, 스킬, SSH 연결** 중 새 항목과 변경분만 안전하게 복사합니다(대상 삭제 없음, 비밀값 마스킹, 비밀번호 로그인 SSH 및 개인 키 제외).
- **계정 내보내기/가져오기**: **설정 → CLI 관리 → 계정**에서 에이전트별 프로필을 서명된 JSON으로 이전할 수 있습니다.

:::demo config-sync

## 연결 진단

| 상태 | 원인 | 해결 |
| --- | --- | --- |
| 백엔드 연결 불가 | \`/v2/version\` 또는 \`/health\` 실패 | \`todex-agentd\` 실행·포트 확인, 또는 그룹에서 고정 주소/릴레이 활성화 |
| 잘못된 URL | 주소 형식 오류 | \`http(s)://host:port\` 형식 사용(HTTPS 페이지는 HTTPS/WSS 필수) |
| 인증 실패 | HTTP 401/403 | 미승인 또는 그룹에서 제거됨 — TUI나 그룹 기존 기기에서 다시 승인 |
| 구버전 프로토콜 | 경로에 \`/v1\` 포함 | 루트 주소(\`/v2\`)로 변경 |
| WebSocket 실패 | REST만 성공 | 프록시 WS 업그레이드 설정이나 암호화 지문 확인 후 **다시 페어링** |
| 에이전트 사용 불가 | \`available = false\` | **설정 → CLI 관리**에서 CLI 설치 또는 로그인 |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: '워크벤치',
      description: '홈 보드, 사이드바, 스마트 작업 모드와 계획 검토, 실시간 계획 단계, 오른쪽 패널 및 단축키.',
      body: body(`
데스크톱과 웹의 워크벤치는 동일합니다(브라우저 예약 단축키만 \`⌥\`로 대체). 전체 동작 시연을 먼저 본 뒤, 아래 기능별 대화형 미리보기를 직접 클릭해 보세요:

:::demo

## 홈 화면

기본 시작 화면인 **홈**은 연결된 모든 백엔드의 **실행 중**, **답변 대기(승인 대기)**, **오늘 대화**, **오늘 사용량**, **시간별 사용량**, **요금제 한도**(5시간/7일 창)를 실시간 카드로 보여 줍니다. **레이아웃 사용자 지정**을 눌러 카드 순서 변경·크기 조절·숨기기·**카드 추가**를 자유롭게 구성하세요.

:::demo home

## 왼쪽 사이드바

상단 워크스페이스 + 하단 대화 목록 또는 **통합** 레이아웃(**설정 → 모양**, 워크스페이스당 5개씩 표시)을 지원합니다. 백그라운드 대기 중인 대화도 작업 중 표시를 유지하며, 오른쪽 클릭으로 새 대화·이름 변경·분기·고정·삭제를 할 수 있습니다.

- **오프라인 백엔드 워크스페이스 접기**: 연결이 끊긴 백엔드의 워크스페이스는 목록 끝 페이징 줄(**오프라인 백엔드의 워크스페이스 보기 (n)**)에 접혀 있다가 클릭 시 원래 순서대로 펼쳐집니다.
- **태그와 폴더 상태 링**: 워크스페이스·그룹 태그 분류와 더불어 그룹 폴더 아이콘에 하위 워크스페이스의 가장 긴급한 상태 링(\`working > issue > unread\`)이 표시됩니다. 홈·계획·터미널·프로필 화면을 여는 동안에는 뒤쪽 목록 강조를 해제합니다.
- **비공개 대화(\`⌘⇧P\` / 웹 \`⌥⇧P\`)**: 지원 에이전트를 골라 데몬 메모리에만 남는 비공개 대화를 바로 시작할 수 있습니다.

:::demo offline-sidebar

## 예약 대화 및 기능 표시 전환

사이드바나 **계획** 작업에서 만드는 **예약 대화**는 지정 시각까지 백엔드 큐에 메시지를 보관했다가 순서대로 전송하며(**지금 보내기** / **시간 변경** / **예약 취소** 제공), **설정 → 기능**에서 예약 대화·터미널·계획의 표시 여부와 단축키를 기기별로 켜고 끌 수 있습니다. 백엔드 시작 직후에는 최대 2분간 재시도하며 활성 대화의 에이전트를 미리 예열합니다.

## 스마트 작업 모드 및 계획 검토

Claude Code 대화 입력창에서 작업 모드로 **스마트**를 선택하면 **설정 → 스마트 작업 모드**의 2단계 흐름이 동작합니다:

1. **계획 단계(\`스마트 · 계획 중\`)**: 지정한 계획 모델·추론 강도·자동 첨부 계획 스킬로 코드를 조사해 계획을 작성합니다.
2. **계획 행 및 승인 카드**: \`ExitPlanMode\`가 호출되면 계획 전체가 타임라인에 독립 Markdown **계획** 행으로 표시되고 입력창 위에 **계획 승인 대기** 카드가 나타납니다. **승인**하거나 수정 의견을 입력해 **수정 요청**을 보낼 수 있습니다.
3. **턴 도중 전환 및 재계획**: 승인 시 실행 모델과 **자동 승인**(**스마트 · 실행 중**)으로 즉시 넘어가며, 이후 실행 중 Claude가 \`EnterPlanMode\`에 다시 들어가거나 계획 스킬이 첨부되면 자동으로 계획 모델로 복귀합니다.

:::demo smart

## 가운데 — 채팅 및 계획 단계

- **입력창 위 계획 단계(\`계획 1/3\`)**: Codex, Claude Code(\`TodoWrite\`), Pi(\`@tintinweb/pi-tasks\`, 턴 간 유지), ACP의 단계 진행 상황을 접이식 체크리스트로 확인합니다.
- **Codex 경고 및 자동 검토 안내**: \`provider_warning\`과 \`auto_review\` 결과를 한 줄 알림으로 표시하고 툴팁으로 근거를 제공합니다. 추론 강도에 \`ultra\`가 추가되었습니다.

:::demo plan-steps

- **사고 점 애니메이션, 작업 제목, 파일 칩**: 실행 중인 도구 그룹은 동적 점 그리드와 현재 동작을 보여 주고, 완료 후에는 "파일 2개 편집 · 명령 1개 실행" 형태로 요약해 수정 파일 칩과 함께 정리합니다.

:::demo execution-group

- **백그라운드 작업 중지**: 턴 종료 후 백그라운드 작업만 대기 중인 경우 입력창 위의 **백그라운드 작업 중지** 버튼으로 즉시 중단할 수 있습니다.

:::demo background-tasks

- **입력창과 분기**: \`@\` 2단계 참조(\`@file:\` / \`@folder:\` / \`@chat:\` / \`@skill:\` / \`@mcp:\` / \`@app:\` / SSH), \`/\` 명령, \`#\` 능력 참조, 이미지·파일 붙여넣기, **이 답변에서 분기**, Codex \`/goal\`, Pi \`/todex compact\`를 지원합니다.

## 오른쪽 — 워크벤치 탭

| 탭 | 내용 |
| --- | --- |
| 터미널 | 내장 xterm.js WebGL PTY(검색, 링크, 셸 통합, 이미지 붙여넣기, 재연결 화면 복구) |
| 파일 | 워크스페이스 디렉터리 트리 및 파일 미리보기 |
| Git Diff | 다중 저장소 변경 내역, 브랜치, 워크트리 및 Git 작업 |
| 에이전트 호출 | \`todex_agents\`로 생성된 하위 에이전트 대화와 결과 추적 |
| Agent 브라우저 / Computer Use | **실시간 화면 위치** 설정에 따라 오른쪽 탭 또는 입력창 위에 표시하며, 마지막 조작 위치를 주황색 **AI 커서**로 표시 |

:::demo computer-live

## 키보드 단축키 및 터미널

\`⌘B\`/\`Ctrl B\`(왼쪽 사이드바), \`⌘⌥B\`(오른쪽 패널), \`⇧⌘G\`(Git 작업), \`⌘N\`(웹 \`⌥N\`, 새 대화), \`⇧⌘N\`(웹 \`⌥⇧N\`, 워크스페이스 추가), \`⇧⌘P\`(웹 \`⌥⇧P\`, 비공개 대화), \`⌘L\`(빠른 검색), \`⌘1…9\`(워크벤치 탭 전환), \`⇧⌘K\`(계획 보드/캘린더), \`⇧⌘T\`(웹 \`⌥⇧T\`, 터미널 화면). 보조 키를 잠시 누르면 화면에 단축키 배지가 나타납니다.

터미널 안에서는 \`⌘C\`/\`Ctrl Shift C\`(복사), \`⌘V\`/\`Ctrl Shift V\`(붙여넣기), \`⌘F\`(찾기), \`⌘K\`(지우기), \`⌘↑/↓\`(프롬프트 이동)와 bash/zsh/fish **셸 통합**(종료 상태 표시, 경로 동기화, 10초 이상 명령 완료 알림), 이미지 붙여넣기(7일 후 자동 삭제)를 지원합니다.
`),
    },

    'desktop/settings': {
      slug: 'desktop/settings',
      title: '설정',
      description: '백엔드 그룹, 설정 동기화, 스마트 작업 모드, Agent 데스크톱 도구, CLI 관리 및 로컬 캐시.',
      body: body(`
설정 화면은 왼쪽 그룹 레일로 구성되어 있습니다. 호스트 전용 기능은 [로컬 백엔드](/docs/desktop/local-backend)와 [컨테이너](/docs/desktop/containers) 페이지를 참고하세요.

## 백엔드 그룹

**설정 → 백엔드 그룹**에서 그룹 생성(24단어 복구 키 저장), **초대 QR 코드** 또는 초대 텍스트 가입, 대기 기기 코드 대조 **승인**, 페어링된 백엔드 또는 24시간 **참여 코드**로 백엔드 추가, 노드별 **고정 주소**·**릴레이 설정**, 온라인 상태 확인을 수행합니다.

:::demo mesh

## Backend 연결 및 설정 동기화

- **Backend 연결**: 일대일 백엔드 프로필을 관리합니다(그룹 노드는 **백엔드 그룹**에서만 관리).
- **설정 동기화**: 두 백엔드를 나란히 비교해 **CLI 계정, 설정, MCP, 스킬, SSH 호스트**의 새 항목과 변경분만 안전하게 동기화합니다(비밀값 마스킹, 비밀번호 SSH 및 개인 키 제외).

:::demo config-sync

## 스마트 작업 모드

**설정 → 스마트 작업 모드**에서 Claude Code용 **계획 단계**(모델, 추론 강도, 자동 첨부 **계획 스킬**)와 **실행 단계**(모델, 추론 강도, 항상 **자동 승인**)를 기기별로 설정합니다.

:::demo smart-settings

## Agent 데스크톱 도구 (Agent 브라우저 & Computer Use)

- **Agent 브라우저**: **Chromium**과 실험적 **Kitesurf**(Cloudflare \`workerd\` 기반 헤드리스 격리 엔진) 중 선택하고, **사이트 승인**(**사이트마다 묻기** / **승인 없음**)과 **항상 허용된 사이트** 목록을 관리합니다(DNS 확인으로 링크 로컬·메타데이터·데몬 포트는 계속 차단). Chromium 사용 시 워크스페이스별 브라우저 프로필도 관리합니다.
- **Computer Use**: **내장** 또는 실험적 **agent-desktop** 엔진을 선택하고 실시간 화면 위치(**사이드 패널** / **입력창 위**)를 고릅니다. macOS에서는 드래그 권한 가이드, 화면 기록 재시작 안내, ad-hoc 서명 감지를 제공합니다.

:::demo agent-browser

## CLI 관리

Codex, Claude Code, Pi, Grok Build, DeepSeek Harness, omp, ACP의 버전 확인·설치·**모두 업데이트** 및 **공유 MCP / 스킬**을 관리합니다.

| 탭 | 내용 |
| --- | --- |
| 설정 | 폼·환경 변수·원본 편집기; Pi **플러그인**·네이티브 **MCP**·**서브에이전트 템플릿**; \`dsh\` 패치 레이어 및 플러그인 |
| MCP / 스킬 | 백엔드에 적용된 MCP와 스킬; 최상위 심볼릭 링크 스킬에는 읽기 전용 **링크** 배지 표시 |
| 계정 | Provider 계정·API 키·JSON 내보내기/가져오기; 커스텀 모델 컨텍스트 프리셋에 **512K(\`524,288\`)** 추가 |
| 정리 | 백엔드에 저장된 CLI 네이티브 세션 정리 |
| 플러그인 | omp 플러그인 관리 |

:::demo linked-skills

## 에이전트 호출, SSH, 저장소, 모양

- **에이전트 호출**: \`todex_agents\`(MCP 상호 호출)와 \`/api/v1\` 외부 API에서 허용할 에이전트·모델, 외부 API 포트, API 키를 관리합니다.
- **SSH 연결**: 관리 호스트·\`~/.ssh/config\`·**로컬** 호스트 접근 제어, 개인정보 필터(공격적 옵션·사용자 지정 키), **SSH 승인** 방식(**호스트별** / **명령별**)을 설정합니다.
- **일반 → 저장소**: 기록 정리 및 데스크톱 **이 기기에 최근 대화 캐시**(최대 100개 대화·최신 300개 이벤트·200 MB 암호문만 저장, 비공개 대화 제외)를 관리합니다.
- **모양 및 알림**: **사이드바 레이아웃**(분할 / 통합)과 **셸 통합**을 전환하며, 시스템 알림은 질문 내용과 구체적인 승인 대상을 표시하고 응답 후 자동으로 닫힙니다.
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: '로컬 백엔드',
      description: '데스크톱 앱에서 이 머신의 백엔드를 배포해 IPC로 연결하고 그룹과도 연동합니다.',
      body: body(`
데스크톱 앱은 같은 컴퓨터에서 \`todex-agentd\`를 직접 배포·실행하고 네트워크 포트나 검증 코드 없이 **로컬 IPC**(Unix 소켓 / Windows 명명된 파이프)로 통신할 수 있습니다.

## 배포 및 관리

**설정 → 로컬 백엔드**에서 **배포 및 연결**을 누르면 현재 앱 버전과 일치하고 \`SHA256SUMS.sig\` 검증이 완료된 바이너리를 받아 IPC로 연결합니다. 이후 시작·재시작·중지·다시 페어링·로그 보기, **로그인 시 시작**, **TodeX 종료 시 중지**, 리스너 및 원격 페어링 QR 표시를 한곳에서 제어합니다.

## 기존 루프백 재사용 및 백엔드 그룹 연동

- **IPC로 전환**: \`http://127.0.0.1:7345\`로 이미 페어링된 프로필이 있으면 새 기기 키를 만들지 않고 동일 프로필을 IPC로 전환해 기록 접근 권한을 유지합니다.
- **백엔드 그룹 내 로컬 노드(\`이 컴퓨터 · 데이터는 IPC로\`)**: 이 컴퓨터의 백엔드가 그룹에도 속해 있으면 워크스페이스·대화·요청은 빠른 **IPC 프로필**로 전송되고, 그룹 네트워크 프로필은 온라인 상태·명단 동기화·가입 요청 수신용 **대기 연결**로 유지됩니다. 같은 데몬을 가리키는 프로필끼리 기록 키를 자동 공유하므로 전환 후에도 이전 대화가 그대로 보입니다.

## 네트워크 리스너 끄기 및 로컬 관리 API

이 컴퓨터의 데스크톱 앱만 쓴다면 IPC 연결 상태에서 **네트워크 리스너**를 끌 수 있습니다(\`network_enabled = false\`, TUI \`b\`; 다른 기기가 그룹으로 접속한다면 켜 두세요). \`/v2/local-admin/*\` 관리 경로는 IPC 소켓에서만 허용되고 TCP에서는 \`404\`를 반환합니다.
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: '컨테이너',
      description: 'Docker에서 백엔드를 실행하고 컨테이너 워크스페이스 생성, 초기화, 유휴 동결 및 자동 정리를 수행합니다.',
      body: body(`
TodeX 컨테이너는 \`todex-agentd\`와 에이전트 CLI가 미리 설치된 Docker 이미지입니다. 각 컨테이너가 독립된 백엔드로 동작하며 프로젝트 디렉터리를 마운트해 격리 실행합니다.

## 요구 사항 및 컨테이너 관리

Docker와 Compose v2가 필요합니다. **설정 → TodeX Container**에서 이미지 태그와 컨테이너 목록을 보고 시작·중지·재시작·업그레이드·마운트·로그·삭제(체크하지 않으면 home 볼륨 보존)를 관리하며, \`todexc\` CLI와 \`~/.config/todex-container/<name>/\` 구조를 공유합니다.

## 컨테이너 워크스페이스, 초기화, 유휴 동결 및 정리

- **컨테이너 워크스페이스**: **새 워크스페이스**에서 선택하면 Linux/macOS는 동일 경로, Windows는 \`/workspace/<폴더>\`로 마운트하며 \`todexc\` / \`docker exec\` 승인 안내, [설정 동기화](/docs/desktop/settings) 제안, 호스트 ↔ 컨테이너 경로 매핑을 제공합니다. 이미지 내장 CLI는 "이미지와 함께 업데이트"로 표시됩니다.
- **초기화 명령**: \`todex\` 사용자로 \`bash -c\` 초기화 스크립트를 1회 실행(\`pnpm\` / \`npm\` / \`yarn\` / \`uv\` / \`requirements.txt\` / submodule 템플릿 제공, 장시간 작업은 백그라운드 계속).
- **자동 동결 및 정리**: 15분~4시간 유휴 시 \`docker pause\`로 절전(메시지 전송이나 터미널 열기 시 자동 재개), 시작 1분 후 및 6시간마다 미사용 이미지·중지된 컨테이너(1/7/30일 설정)를 정리합니다(home 볼륨은 자동 삭제 안 함).

| 환경 변수 | 효과 |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | 자체 업데이트 비활성화 |
| \`TODEX_AGENTD_ADVERTISE_URL\` | 클라이언트와 그룹에 알릴 URL |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | 이미지 관리 CLI 경로(설치 시 \`409\`) |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | 호스트 ↔ 컨테이너 경로 매핑 |
`),
    },

    'mobile': {
      slug: 'mobile',
      title: '모바일',
      description: '네이티브 iPhone & iPad 클라이언트 (Todex Mobile) — 곧 출시 예정.',
      body: body(`
> **출시 예정.** 모바일 클라이언트는 현재 활발히 개발 중이며, 첫 베타 출시 시 정식 문서로 교체됩니다.

Todex Mobile(\`TodeX_native\`)은 동일한 \`todex-agentd\` 백엔드와 페어링되는 iPhone 및 iPad용 네이티브 Swift + UIKit 앱입니다.

## 계획 및 정렬 중인 기능

- **카메라 QR 페어링 및 백엔드 그룹**: **백엔드 그룹** 초대 QR 코드 또는 백엔드 TUI QR 코드를 스캔해 데스크톱과 동일한 확인 코드 대조로 즉시 가입·연결합니다.
- **채팅 + 콘솔**: iPad 넓은 화면에서 대화 타임라인·계획 검토와 터미널·파일·Git·실시간 화면을 2패널로 동시에 사용합니다.
- **완전한 턴 제어**: 권한 승인, 질문 응답, 계획 수정 요청, 모델/추론 강도 선택, 대기열, 백그라운드 작업 완료 알림을 지원합니다.
- **동일 보안 및 암호문 캐시**: Ed25519 기기 서명과 X25519 / ML-KEM-768 키를 iOS Keychain에 보관하며, 데스크톱과 동일한 암호문 전용 로컬 기록 캐시(오프라인 대화 목록 제목은 \`titleEnc\` 암호문 유지, 비공개 대화 제외)를 제공합니다.

## 지금 모바일에서 사용하기

반응형 [웹 클라이언트](/docs/introduction/quick-start)(\`/app\`)가 모바일 브라우저에서도 그대로 동작하며 백엔드 그룹 초대 QR 코드로도 참여할 수 있습니다.
`),
    },
  },
};
