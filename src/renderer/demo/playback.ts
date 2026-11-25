// Shared by the site pages that embed the demo and by the demo itself; keep
// this file free of imports so the site bundle does not pull in workbench code.

export const DEMO_PATH = '/demo';

/** Workbench demos embedded in `/docs` (`:::demo` / `:::demo <scene>`). */
export const DEMO_SCENES = [
  'walkthrough',
  'mesh',
  'smart',
  'smart-settings',
  'plan-steps',
  'execution-group',
  'background-tasks',
  'home',
  'computer-live',
  'agent-browser',
  'linked-skills',
  'config-sync',
  'offline-sidebar',
] as const;
export type DemoScene = (typeof DEMO_SCENES)[number];

export function isDemoScene(value: string): value is DemoScene {
  return (DEMO_SCENES as readonly string[]).includes(value);
}

/** The steps each demo plays, in order. The docs player draws its step bar
 * from this before the frame loads; `demo/scenes.ts` scripts the same ids, and
 * each id has a `docs.demo.scene.<scene>.step.<id>` label. */
export const DEMO_SCENE_STEPS = {
  walkthrough: ['newConversation', 'typing', 'send', 'process', 'answer'],
  mesh: ['open', 'devices', 'approve', 'invite'],
  smart: ['open', 'plan', 'handoff', 'workMode'],
  'smart-settings': ['open', 'planModel', 'planSkill', 'executeModel'],
  'plan-steps': ['open', 'planBar', 'notices'],
  'execution-group': ['open', 'group', 'step'],
  'background-tasks': ['open', 'ring', 'stop'],
  home: ['board', 'customize', 'cards', 'done'],
  'computer-live': ['open', 'screen', 'cursor'],
  'agent-browser': ['open', 'engine', 'approval', 'hosts'],
  'linked-skills': ['open', 'badge', 'preview'],
  'config-sync': ['open', 'preview', 'same'],
  'offline-sidebar': ['open', 'expand', 'workspaces'],
} as const satisfies Record<DemoScene, readonly string[]>;
export type DemoSceneStep<S extends DemoScene> = (typeof DEMO_SCENE_STEPS)[S][number];

/** Builds the `/demo` URL for a docs embed. Every scene plays itself
 * (`autoplay&controls`); `startStep` fast-forwards to that step on boot. */
export function demoSceneUrl(scene: DemoScene, locale: string, startStep = 0): string {
  const params = new URLSearchParams({ lang: locale });
  if (scene !== 'walkthrough') params.set('scene', scene);
  if (scene === 'mesh') params.set('mesh', '1');
  if (scene === 'home') params.set('board', 'busy');
  if (scene === 'computer-live') params.set('live', 'computer');
  if (scene === 'config-sync') params.set('backends', '2');
  if (scene === 'offline-sidebar') params.set('backends', 'offline');
  if (startStep > 0) params.set('step', String(startStep));
  return `${DEMO_PATH}?${params.toString()}&autoplay&controls`;
}

/** Host → demo: run or hold the demo. The landing page pauses it while it is
 * scrolled out of view; the docs player also maps its play/pause button onto
 * this. */
export type DemoPlaybackMessage = { type: 'todex-demo-playback'; playing: boolean };

export function isDemoPlaybackMessage(value: unknown): value is DemoPlaybackMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoPlaybackMessage).type === 'todex-demo-playback'
    && typeof (value as DemoPlaybackMessage).playing === 'boolean';
}

/** Host → demo (docs player): fast-forward to a later step. Earlier steps are
 * reached by reloading the frame with `step=<n>` instead. */
export type DemoSeekMessage = { type: 'todex-demo-seek'; step: number };

export function isDemoSeekMessage(value: unknown): value is DemoSeekMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoSeekMessage).type === 'todex-demo-seek'
    && Number.isInteger((value as DemoSeekMessage).step);
}

/** Demo → host, only with `?controls` (the docs player): which step plays
 * (`-1` while the workbench loads), whether it is still fast-forwarding to a
 * requested step, and whether the demo has finished (or could not continue);
 * `ended` stays set until the host reloads the frame. */
export type DemoStatusMessage = { type: 'todex-demo-status'; step: number; seeking: boolean; ended: boolean };

export function isDemoStatusMessage(value: unknown): value is DemoStatusMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoStatusMessage).type === 'todex-demo-status'
    && Number.isInteger((value as DemoStatusMessage).step)
    && typeof (value as DemoStatusMessage).seeking === 'boolean'
    && typeof (value as DemoStatusMessage).ended === 'boolean';
}

/** Frame size for an embed `containerWidth` wide. Wide hosts get the desktop
 * layout scaled down so the three panes keep their real proportions; phones
 * get the workbench's own phone layout at close to 1:1, which stays readable
 * instead of shrinking a desktop to ~6px text. */
export function demoFrameSize(containerWidth: number): { width: number; height: number } {
  return containerWidth < 640 ? { width: 390, height: 700 } : { width: Math.max(containerWidth, 1440), height: 880 };
}
