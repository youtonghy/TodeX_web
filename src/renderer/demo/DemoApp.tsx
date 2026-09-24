import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Button, Chip, Label, ListBox, Modal, Select } from '@heroui/react';
import { AppLayout, Navbar, useSidebar } from '@heroui-pro/react';
import { RiAddLine, RiGithubLine, RiLayoutLeftLine, RiLayoutRightLine, RiShieldLine } from '@remixicon/react';
import { providerDisplayName } from '@todex/protocol/v2';
import { AppSidebar } from '../components/AppSidebar';
import { Field } from '../components/Field';
import { GitStatusDisplay } from '../components/GitStatusIndicator';
import { ProviderIcon } from '../components/ProviderIcon';
import { ChatPanel } from '../screens/ChatPanel';
import { WorkbenchPanel } from '../screens/WorkbenchPanel';
import type { WorkbenchTab } from '../lib/panels';
import type { TodeXSession } from '../session/useTodeXSession';
import { t, useT } from '../i18n';
import { demoBackend } from './demoData';
import { playDemoOnce, type DemoScriptContext, type DemoTarget } from './demoScript';
import { buildDemoSession } from './demoSession';
import { initialDemoState, type DemoModalState, type DemoState } from './demoState';
import { isDemoPlaybackMessage } from './playback';

const noop = () => {};
const LOOP_PAUSE_MS = 7000;

type CursorState = { x: number; y: number; visible: boolean; pressed: boolean };

class DemoAborted extends Error {}

type SidebarControl = Pick<ReturnType<typeof useSidebar>, 'isMobile' | 'setMobileOpen'>;

/** Hands AppLayout's sidebar state to the script, which lives outside the layout. */
function SidebarBridge({ controlRef }: { controlRef: RefObject<SidebarControl | null> }) {
  const { isMobile, setMobileOpen } = useSidebar();
  useEffect(() => {
    controlRef.current = { isMobile, setMobileOpen };
  }, [controlRef, isMobile, setMobileOpen]);
  return null;
}

function targetElement(target: DemoTarget): Element | null {
  switch (target) {
    case 'menu':
      return [...document.querySelectorAll('button[aria-label]')].find((element) => element.getAttribute('aria-label') === t('app.openSidebar')) ?? null;
    case 'new-workspace':
      return [...document.querySelectorAll('button[aria-label]')].find((element) => element.getAttribute('aria-label') === t('sidebar.newWorkspace')) ?? null;
    case 'new-conversation':
      return document.querySelector('.connection-create-button');
    case 'composer':
      return document.querySelector('.composer-container [contenteditable="true"], .composer-container textarea') ?? document.querySelector('.composer-container');
    default:
      return document.querySelector(`[data-demo-target="${target}"]`);
  }
}

function targetPoint(target: DemoTarget): { x: number; y: number } | null {
  const rect = targetElement(target)?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  // Text inputs are clicked near where the caret lands, buttons in the middle.
  const x = target === 'composer' || target === 'workspace-name' ? rect.left + Math.min(48, rect.width / 2) : rect.left + rect.width / 2;
  return { x, y: target === 'workspace-name' ? rect.bottom - 18 : rect.top + rect.height / 2 };
}

/** Drives the scripted walkthrough, pausing while the host page hides the frame. */
function useDemoPlayback(setState: Dispatch<SetStateAction<DemoState>>, setCursor: Dispatch<SetStateAction<CursorState>>, sidebarRef: RefObject<SidebarControl | null>) {
  useEffect(() => {
    const controller = new AbortController();
    // Reduced motion renders the finished walkthrough once, without the pointer.
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hostVisible = true;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (isDemoPlaybackMessage(event.data)) hostVisible = event.data.playing;
    };
    window.addEventListener('message', onMessage);

    const wait = async (ms: number) => {
      let remaining = instant ? 0 : ms;
      do {
        const slice = Math.min(remaining, 100);
        if (slice > 0) await new Promise((resolve) => window.setTimeout(resolve, slice));
        if (controller.signal.aborted) throw new DemoAborted();
        if (hostVisible && document.visibilityState === 'visible') remaining -= slice;
      } while (remaining > 0);
    };
    const point = async (target: DemoTarget) => {
      if (instant) return;
      const next = targetPoint(target);
      if (next) setCursor({ ...next, visible: true, pressed: false });
      await wait(800);
    };
    const click = async () => {
      if (instant) return;
      setCursor((cursor) => ({ ...cursor, pressed: true }));
      await wait(180);
      setCursor((cursor) => ({ ...cursor, pressed: false }));
      await wait(160);
    };
    const context: DemoScriptContext = {
      update: setState,
      wait,
      now: Date.now,
      point,
      click,
      hideCursor: () => setCursor((cursor) => ({ ...cursor, visible: false })),
      revealSidebar: async () => {
        const sidebar = sidebarRef.current;
        if (!sidebar?.isMobile) return;
        await point('menu');
        await click();
        sidebar.setMobileOpen(true);
        await wait(600);
      },
      hideSidebar: async () => {
        const sidebar = sidebarRef.current;
        if (!sidebar?.isMobile) return;
        sidebar.setMobileOpen(false);
        await wait(500);
      },
    };

    void (async () => {
      try {
        do {
          await playDemoOnce(context);
          await wait(LOOP_PAUSE_MS);
        } while (!instant);
      } catch (error) {
        if (!(error instanceof DemoAborted)) console.error('TodeX demo stopped', error);
      }
    })();
    return () => {
      controller.abort();
      window.removeEventListener('message', onMessage);
    };
  }, [setCursor, setState, sidebarRef]);
}

function diffStats(diff: string) {
  const lines = diff.split('\n');
  return {
    changedFiles: lines.filter((line) => line.startsWith('diff --git')).length,
    additions: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length,
    deletions: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
  };
}

/** Mirrors ConversationHeaderDetails with a fixed Git summary instead of a backend poll. */
function DemoHeaderDetails({ session }: { session: TodeXSession }) {
  const t = useT();
  const conversation = session.activeConversation;
  const workspace = session.workspaces.find((item) => item.id === conversation?.workspaceId);
  const diff = conversation ? session.gitDiffByConversation[conversation.id]?.diff ?? '' : '';
  const git = {
    workspace, connected: true, error: '', loading: false, refresh: noop,
    data: workspace ? { repositoryPath: workspace.path, initialized: true, branch: 'main', worktreeKind: 'main' as const, statsTruncated: false, ...diffStats(diff) } : null,
    repoOptions: [], dirtyRepos: [], selectedPath: workspace?.path ?? '', containingRepo: workspace?.path ?? '', selectRepo: noop,
  };
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <span className="min-w-0 max-w-64 truncate text-sm font-medium sm:shrink-0">{conversation?.title ?? t('app.conversation')}</span>
      {conversation ? (
        <Chip size="sm" variant="soft" className="shrink-0 whitespace-nowrap">
          <ProviderIcon provider={conversation.provider} />
          {providerDisplayName(conversation.provider || '', 'Agent')}
        </Chip>
      ) : null}
      {/* Phones leave no room for the Git summary; the real header folds it into a popover there. */}
      <div className="hidden min-w-0 sm:block"><GitStatusDisplay state={git} onOpenGit={noop} wrap={false} /></div>
    </div>
  );
}

function DemoWorkspaceModal({ modal, backend }: { modal: DemoModalState | null; backend: ReturnType<typeof demoBackend> }) {
  const t = useT();
  // Keep the typed values on screen while the dialog animates out.
  const [shown, setShown] = useState(modal);
  if (modal && modal !== shown) setShown(modal);
  return (
    <Modal isOpen={modal !== null} onOpenChange={noop}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.Header>
              <Modal.Heading>{t('app.workspaceCreateTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div data-demo-target="workspace-name"><Field label={t('app.workspaceName')} value={shown?.name ?? ''} onChange={noop} /></div>
              <Select selectedKey={backend.id}>
                <Label>{t('app.workspaceBackend')}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                <Select.Popover><ListBox><ListBox.Item id={backend.id} textValue={backend.name}>{backend.name} · {backend.serverUrl}</ListBox.Item></ListBox></Select.Popover>
              </Select>
              <Field label={t('app.workspaceDirectory')} value={shown?.path ?? ''} onChange={noop} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary">{t('common.cancel')}</Button>
              <Button data-demo-target="create-workspace"><RiAddLine className="size-4" />{t('app.workspaceCreate')}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function DemoCursor({ x, y, visible, pressed }: CursorState) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[2147483647] transition-[transform,opacity] duration-700 ease-in-out"
      style={{ transform: `translate(${x}px, ${y}px)`, opacity: visible ? 1 : 0 }}
    >
      <span className={`absolute -top-4 -left-4 size-8 rounded-full bg-accent/30 transition-transform duration-200 ${pressed ? 'scale-100' : 'scale-0'}`} />
      <svg width="22" height="22" viewBox="0 0 24 24" className={`relative drop-shadow-md transition-transform duration-150 ${pressed ? 'scale-90' : ''}`}>
        <path d="M4 2.5 20 11l-7 2-3.5 7z" fill="#18222e" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** The real workbench panels, fed by a scripted in-memory session. */
export function DemoApp() {
  const t = useT();
  const [state, setState] = useState(() => initialDemoState(Date.now()));
  const [backend] = useState(() => demoBackend(Date.now()));
  const [cursor, setCursor] = useState<CursorState>({ x: -40, y: -40, visible: false, pressed: false });
  const session = useMemo(() => buildDemoSession(state, backend), [state, backend]);
  const sidebarRef = useRef<SidebarControl | null>(null);
  useDemoPlayback(setState, setCursor, sidebarRef);
  const changeWorkbenchTab = useCallback((tab: WorkbenchTab) => setState((current) => current.workbenchTab === tab ? current : { ...current, workbenchTab: tab }), []);
  const scopeKey = state.activeConversationId || state.activeWorkspaceId;

  return (
    <div className="bg-background text-foreground h-full">
      <AppLayout
        className="h-full min-h-0"
        scrollMode="content"
        sidebarCollapsible="offcanvas"
        asideMobile="hidden"
        sidebarOpen
        onSidebarOpenChange={noop}
        sidebarResizable
        sidebarDefaultSize="248px"
        sidebarMinSize="200px"
        sidebarMaxSize="320px"
        sidebarResizeBehavior="preserve-pixel-size"
        asideResizable
        asideDefaultSize="420px"
        asideMinSize="320px"
        asideMaxSize="640px"
        asideResizeBehavior="preserve-pixel-size"
        asideOpen
        onAsideOpenChange={noop}
        aside={<WorkbenchPanel key={scopeKey} scopeKey={scopeKey} session={session} tab={state.workbenchTab} onTabChange={changeWorkbenchTab} />}
        sidebar={
          <AppSidebar
            session={session}
            onCreateWorkspace={noop}
            onEditWorkspace={noop}
            onCreateConversation={noop}
            onOpenSettings={noop}
            onOpenCapabilities={noop}
            onOpenCliManager={noop}
            onOpenAgentProviders={noop}
            onOpenUsage={noop}
            onOpenAbout={noop}
            onOpenKanban={noop}
          />
        }
        navbar={
          <Navbar maxWidth="full">
            <Navbar.Header className="flex-nowrap gap-2 px-3 sm:px-6 [&>button]:shrink-0">
              <SidebarBridge controlRef={sidebarRef} />
              <AppLayout.MenuToggle className="inline-flex min-[769px]:hidden" aria-label={t('app.openSidebar')}>
                <RiLayoutLeftLine className="size-4" />
              </AppLayout.MenuToggle>
              <Button className="hidden min-[769px]:inline-flex" isIconOnly size="sm" variant="ghost" aria-label={t('app.collapseSidebar')}>
                <RiLayoutLeftLine className="size-4" />
              </Button>
              <DemoHeaderDetails session={session} />
              <Navbar.Content className="shrink-0 gap-2">
                {session.activeWorkspace ? (
                  <Button size="sm" variant="tertiary" aria-label={t('app.trustRevoke')}>
                    <RiShieldLine className="size-4" />
                    <span className="hidden sm:inline">{t('app.trustTrusted')}</span>
                  </Button>
                ) : null}
                <Button isIconOnly size="sm" variant="ghost" aria-label={t('app.githubActions')}>
                  <RiGithubLine className="size-4" />
                </Button>
                <Button isIconOnly size="sm" variant="ghost" aria-label={t('app.closeAside')} aria-expanded>
                  <RiLayoutRightLine className="size-4" />
                </Button>
              </Navbar.Content>
            </Navbar.Header>
          </Navbar>
        }
      >
        <ChatPanel session={session} />
      </AppLayout>
      <DemoWorkspaceModal modal={state.modal} backend={backend} />
      <DemoCursor {...cursor} />
    </div>
  );
}
