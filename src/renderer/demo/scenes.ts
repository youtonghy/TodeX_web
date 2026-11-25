// The scripted demos `/docs` embeds (`/demo?scene=<scene>&autoplay&controls`):
// each step drives the real workbench with the pointer from ./driver. Steps
// only use actions the in-memory backend answers, and every lookup goes by the
// labels the workbench renders, so the scripts follow the locale.
import { t } from '../i18n';
import { messageParts, type DemoDriver } from './driver';
import { demoOfflineWorkspaces } from './fixtures';
import type { DemoScene, DemoSceneStep } from './playback';
import { walkthroughSteps } from './walkthrough';

type SceneScript<S extends DemoScene> = {
  /** Runs before the first step, while the player still shows "loading". */
  prepare(d: DemoDriver): Promise<void>;
  steps: Record<DemoSceneStep<S>, (d: DemoDriver) => Promise<void>>;
};

/** Waits for the home page the workbench boots into. */
async function workbenchReady(d: DemoDriver): Promise<void> {
  await d.find(d.button(t('home.customize')), 15_000);
  await d.wait(600);
}

const startsWith = (key: Parameters<typeof messageParts>[0], param: string) => {
  const [before] = messageParts(key, param);
  return (text: string | null | undefined) => Boolean(text?.trim().startsWith(before));
};

/** The note rows the timeline renders for provider notices. */
const note = (d: DemoDriver, match: (text: string) => boolean) => d.find(() => [...document.querySelectorAll('main [role="note"]')]
  .find((element) => match(element.textContent ?? '')));

export const sceneScripts: { [S in DemoScene]: SceneScript<S> } = {
  walkthrough: {
    // The landing page has always let the workbench settle this long.
    prepare: (d) => d.wait(2600),
    steps: walkthroughSteps,
  },

  mesh: {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openSettings(t('mesh.title')).then(() => d.hold(800)),
      async devices(d) {
        const dialog = d.scope();
        await d.point(await d.find(d.text(t('mesh.online'), '*', dialog)));
        await d.point(await d.find(d.text(t('mesh.hub'), '*', dialog)), 1200);
      },
      async approve(d) {
        await d.click(await d.find(d.button(t('mesh.approve'))));
        const confirm = await d.find(() => d.scope() as Element);
        await d.point(await d.find(() => [...confirm.querySelectorAll('*')]
          .filter((element) => element.textContent?.trim() === '3F9A2-7C41B').at(-1)), 2200);
        // Confirming has no demo backend behind it; leave the request pending.
        await d.click(await d.find(d.button(t('common.cancel'), confirm)));
      },
      async invite(d) {
        await d.point(await d.open(d.button(t('mesh.invite')), d.select(`svg[role="img"][aria-label="${CSS.escape(t('mesh.inviteQr'))}"]`)), 2400);
      },
    },
  },

  smart: {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('拆分主题构建脚本', 'design-tokens'),
      async plan(d) {
        await d.point(await d.find(d.select(`main section[aria-label="${CSS.escape(t('chat.planReview'))}"]`)), 2400);
      },
      async handoff(d) {
        const handoff = startsWith('chat.providerNotice.planHandoff', 'model');
        await d.point(await note(d, handoff), 2200);
      },
      async workMode(d) {
        await d.point(await d.open(d.button(t('chat.selectWorkMode')), () => [...document.querySelectorAll('[role="option"]')]
          .find((element) => element.textContent?.trim().startsWith(t('chat.modeSmart')))), 2200);
      },
    },
  },

  'smart-settings': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openSettings(t('smart.title')).then(() => d.hold(800)),
      async planModel(d) {
        const label = `${t('smart.planStage')} · ${t('smart.model')}`;
        const card = await d.open(d.button(label), d.select(`[role="dialog"][aria-label="${CSS.escape(label)}"]`));
        await d.point(card, 2000);
        await d.dismiss(card, d.button(label));
        await d.wait(300);
      },
      async planSkill(d) {
        await d.choose(t('smart.skill'), 'plan-gate');
        await d.point(await d.find(d.button(t('smart.skill'))), 1400);
      },
      async executeModel(d) {
        const label = `${t('smart.executeStage')} · ${t('smart.model')}`;
        await d.point(await d.open(d.button(label), d.select(`[role="dialog"][aria-label="${CSS.escape(label)}"]`)), 2200);
      },
    },
  },

  'plan-steps': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('排查 Safari 下商品卡片抖动'),
      async planBar(d) {
        const list = `ul[aria-label="${CSS.escape(t('plan.label'))}"]`;
        const toggle = () => document.querySelector(list)?.parentElement?.querySelector<HTMLElement>('button[aria-expanded]')
          ?? [...document.querySelectorAll<HTMLElement>('button[aria-expanded]')]
            .find((button) => button.textContent?.trim().startsWith(t('plan.title')) && /\d+\s*\/\s*\d+/.test(button.textContent));
        const button = await d.find(toggle);
        // It starts open: fold it, then open it again on the checklist.
        await d.click(button);
        await d.wait(500);
        await d.click(button);
        await d.point(await d.find(d.select(list)), 2000);
      },
      async notices(d) {
        await d.point(await note(d, startsWith('chat.providerNotice.warning', 'agent')), 1600);
        await d.point(await note(d, startsWith('chat.providerNotice.autoReviewApproved', 'agent')), 1800);
      },
    },
  },

  'execution-group': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('重构结账页表单校验'),
      async group(d) {
        const group = await d.find(d.select('main section > button[aria-expanded="false"]'));
        await d.click(group);
        await d.point(group.parentElement ?? group, 1800);
      },
      async step(d) {
        const row = await d.find(() => [...document.querySelectorAll<HTMLButtonElement>('main section ul > li button[aria-expanded="false"]')]
          .filter((button) => !button.disabled).at(-1));
        await d.click(row);
        await d.point(row.closest('li') ?? row, 2400);
      },
    },
  },

  'background-tasks': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('支付回调幂等处理', 'lumen-api'),
      async ring(d) {
        const opened = await d.openSidebar();
        await d.point(await d.find(d.select(`aside [aria-label="${CSS.escape(t('sidebar.statusWorking'))}"]`)), 2000);
        if (opened) {
          d.escape();
          await d.wait(500);
        }
      },
      async stop(d) {
        const stop = await d.find(d.button(t('chat.stopBackground')));
        await d.point(stop, 1200);
        await d.click(stop);
        await d.hold(2000);
      },
    },
  },

  home: {
    prepare: workbenchReady,
    steps: {
      async board(d) {
        await d.point(await d.find(d.select('main section[aria-label]')), 1400);
        await d.point(await d.find(() => [...document.querySelectorAll('main section[aria-label]')].at(-1)), 1400);
      },
      async customize(d) {
        await d.click(await d.find(d.button(t('home.customize'))));
        await d.hold(1400);
      },
      async cards(d) {
        const [before, after] = messageParts('home.remove', 'name');
        const remove = await d.find(() => [...document.querySelectorAll<HTMLElement>('main button[aria-label]')]
          .filter((button) => {
            const label = button.getAttribute('aria-label') ?? '';
            return label.startsWith(before) && label.endsWith(after);
          }).at(-1));
        const label = remove.getAttribute('aria-label') ?? '';
        const name = label.slice(before.length, label.length - after.length);
        await d.click(remove);
        await d.wait(600);
        await d.choose(t('home.addCards'), name);
        await d.hold(1200);
      },
      async done(d) {
        await d.click(await d.find(d.button(t('ssh.done'))));
        await d.hold(1400);
      },
    },
  },

  'computer-live': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('重构结账页表单校验'),
      async screen(d) {
        const frame = d.select(`img[alt="${CSS.escape(t('computerLive.frame'))}"]`);
        if (!frame()) {
          const tab = d.select('button[aria-label="Computer Use"][aria-pressed="false"]')();
          if (tab) await d.click(tab as HTMLElement);
        }
        await d.point(await d.find(frame), 2200);
      },
      async cursor(d) {
        await d.point(await d.find(d.select('[data-testid="computer-ai-cursor"]')), 2400);
      },
    },
  },

  'agent-browser': {
    prepare: workbenchReady,
    steps: {
      async open(d) {
        const dialog = await d.openSettings(t('agentDesktop.title'));
        await d.click(await d.find(d.select('[data-agent-desktop-page="browser"]', dialog)));
        await d.hold(800);
      },
      async engine(d) {
        await d.choose(t('agentBrowser.engine'), t('agentBrowser.engineKitesurf'));
        await d.point(await d.find(d.button(t('agentBrowser.engine'))), 1400);
      },
      async approval(d) {
        await d.choose(t('agentBrowser.hostApproval'), t('agentBrowser.hostApprovalAuto'));
        await d.point(await d.find(d.button(t('agentBrowser.hostApproval'))), 1400);
      },
      async hosts(d) {
        await d.point(await d.find(d.text('docs.example.com')), 2200);
      },
    },
  },

  'linked-skills': {
    prepare: workbenchReady,
    steps: {
      async open(d) {
        const dialog = await d.openSettings(t('app.cliManager'));
        await d.click(await d.find(d.button(t('cliSettings.title', { name: 'Claude Code' }), dialog)));
        await d.click(await d.find(d.button(t('cliPage.tabCapabilities'), dialog)));
        await d.hold(800);
      },
      async badge(d) {
        await d.point(await d.find(() => {
          const card = [...document.querySelectorAll('[role="button"][aria-expanded]')].find((element) => element.textContent?.includes('plan-gate'));
          return card ? [...card.querySelectorAll('*')].filter((element) => element.textContent?.trim() === t('cap.linked')).at(-1) : null;
        }), 2200);
      },
      async preview(d) {
        const card = await d.find(() => [...document.querySelectorAll('[role="button"][aria-expanded]')]
          .find((element) => element.textContent?.includes('plan-gate')));
        await d.click(card);
        await d.hold(2400);
      },
    },
  },

  'config-sync': {
    prepare: workbenchReady,
    steps: {
      async open(d) {
        const dialog = await d.openSettings(t('settings.backendConnections'));
        const title = t('configSync.title');
        await d.click(await d.find(() => [...dialog.querySelectorAll('button')].find((button) => button.textContent?.trim().startsWith(title))));
        await d.hold(1000);
      },
      async preview(d) {
        const show = await d.find(d.button(t('configSync.showValue')));
        await d.click(show);
        await d.point((show.closest('li, [role="row"], section') as HTMLElement | null) ?? show, 2000);
      },
      async same(d) {
        const same = startsWith('configSync.showSame', 'count');
        await d.click(await d.find(d.buttonWhere(same)));
        await d.hold(2000);
      },
    },
  },

  'offline-sidebar': {
    prepare: workbenchReady,
    steps: {
      open: (d) => d.openConversation('重构结账页表单校验'),
      async expand(d) {
        await d.openSidebar();
        const labels = new Set(Array.from({ length: 20 }, (_, n) => t('sidebar.showOfflineWorkspaces', { n: n + 1 })));
        await d.click(await d.find(d.buttonWhere((name) => labels.has(name))));
        await d.wait(400);
      },
      async workspaces(d) {
        for (const workspace of demoOfflineWorkspaces) {
          await d.point(await d.find(d.text(workspace.name, 'aside *')), 1200);
        }
      },
    },
  },
};
