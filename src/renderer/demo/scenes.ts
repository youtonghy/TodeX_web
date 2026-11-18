// Scene navigator for `/demo?scene=<scene>`: opens the requested screen,
// settings category, or conversation once the real workbench mounts so every
// feature preview in `/docs` shows the live UI in the right state.
import { t } from '../i18n';
import { isDemoScene, type DemoScene } from './playback';

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.closest('[inert]')) return false;
  if (element instanceof HTMLButtonElement && element.disabled) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function waitFor<T extends Element>(lookup: () => T | null | undefined, timeoutMs = 8000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const element = lookup();
    if (element && isVisible(element)) return element;
    await wait(80);
  }
  throw new Error('demo scene target not found');
}

function findButton(label: string, scope: ParentNode = document): HTMLElement | undefined {
  return [...scope.querySelectorAll<HTMLElement>('button, [role="button"]')].find(
    (element) => isVisible(element) && (element.getAttribute('aria-label') === label || element.textContent?.trim() === label),
  );
}

function findByText(text: string, selector: string, scope: ParentNode = document): HTMLElement | undefined {
  return [...scope.querySelectorAll<HTMLElement>(selector)].find(
    (element) => isVisible(element) && element.textContent?.trim() === text,
  );
}

async function ensureSidebarOpen(): Promise<void> {
  const settingsBtn = findButton(t('app.settings'));
  if (settingsBtn) return;
  const openBtn = findButton(t('app.openSidebar'));
  if (openBtn) {
    openBtn.click();
    await wait(200);
  }
}

async function openConversation(conversationTitle: string, workspaceName?: string): Promise<void> {
  await ensureSidebarOpen();
  if (workspaceName) {
    const ws = await waitFor(() => [...document.querySelectorAll<HTMLElement>('[role="row"], aside span, aside button')]
      .find((el) => isVisible(el) && el.textContent?.trim() === workspaceName));
    ws.click();
    await wait(120);
  }
  const row = await waitFor(() => [...document.querySelectorAll<HTMLElement>('[role="grid"] [role="row"]')]
    .find((el) => isVisible(el) && el.textContent?.includes(conversationTitle)));
  row.click();
  // On phone viewports the sidebar drawer stays open after picking a row.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

async function openSettingsSection(sectionLabel: string): Promise<HTMLElement> {
  await ensureSidebarOpen();
  const settingsBtn = await waitFor(() => findButton(t('app.settings')));
  settingsBtn.click();
  const nav = await waitFor(() => document.querySelector<HTMLElement>(`nav[aria-label="${CSS.escape(t('app.settings'))}"]`));
  const item = await waitFor(() => findButton(sectionLabel, nav));
  item.click();
  await wait(120);
  return nav.closest<HTMLElement>('[role="dialog"]') ?? document.body;
}

async function navigateScene(scene: DemoScene): Promise<void> {
  // Wait briefly for initial hydration on the home page.
  await waitFor(() => findButton(t('home.customize')));

  switch (scene) {
    case 'walkthrough':
    case 'home':
      return;
    case 'mesh':
      await openSettingsSection(t('mesh.title'));
      return;
    case 'smart-settings':
      await openSettingsSection(t('smart.title'));
      return;
    case 'agent-browser': {
      const dialog = await openSettingsSection(t('agentDesktop.title'));
      const entry = await waitFor(() => dialog.querySelector<HTMLButtonElement>('[data-agent-desktop-page="browser"]'));
      entry.click();
      return;
    }
    case 'linked-skills': {
      const dialog = await openSettingsSection(t('app.cliManager'));
      const claudeLabel = t('cliSettings.title', { name: 'Claude Code' });
      const claudeBtn = await waitFor(() => findButton(claudeLabel, dialog));
      claudeBtn.click();
      const mcpTab = await waitFor(() => findByText(t('cliPage.tabCapabilities'), '[role="tab"]', dialog));
      mcpTab.click();
      return;
    }
    case 'config-sync': {
      const dialog = await openSettingsSection(t('settings.backendConnections'));
      const syncTitle = t('configSync.title');
      const syncBtn = await waitFor(() => [...dialog.querySelectorAll<HTMLButtonElement>('button')]
        .find((btn) => isVisible(btn) && btn.textContent?.startsWith(syncTitle)));
      syncBtn.click();
      return;
    }
    case 'smart':
      await openConversation('拆分主题构建脚本', 'design-tokens');
      return;
    case 'plan-steps':
      await openConversation('排查 Safari 下商品卡片抖动');
      return;
    case 'execution-group': {
      await openConversation('重构结账页表单校验');
      const groupBtn = await waitFor(() => document.querySelector<HTMLButtonElement>('main section > button[aria-expanded="false"]'));
      groupBtn.click();
      groupBtn.scrollIntoView({ block: 'center' });
      return;
    }
    case 'background-tasks':
      await openConversation('支付回调幂等处理', 'lumen-api');
      return;
    case 'computer-live':
    case 'offline-sidebar':
      await openConversation('重构结账页表单校验');
      return;
  }
}

export function startDemoScene(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('autoplay')) return;
  const raw = params.get('scene');
  if (!raw || !isDemoScene(raw)) return;
  void navigateScene(raw).catch(() => {
    // Best-effort scene navigation; leave the user on whatever view opened.
  });
}
