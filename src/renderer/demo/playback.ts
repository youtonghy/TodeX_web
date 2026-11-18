// Shared by the site pages that embed the demo and by the demo itself; keep
// this file free of imports so the site bundle does not pull in workbench code.

export const DEMO_PATH = '/demo';

/** Workbench feature scenes embedded in `/docs` (`:::demo` / `:::demo <scene>`). */
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

/** Builds the `/demo` URL with every query parameter the scene needs on boot. */
export function demoSceneUrl(scene: DemoScene, locale: string): string {
  if (scene === 'walkthrough') {
    return `${DEMO_PATH}?lang=${encodeURIComponent(locale)}&autoplay&controls`;
  }
  const params = new URLSearchParams({ lang: locale, scene });
  if (scene === 'mesh') params.set('mesh', '1');
  if (scene === 'home') params.set('board', 'busy');
  if (scene === 'computer-live') params.set('live', 'computer');
  if (scene === 'config-sync') params.set('backends', '2');
  if (scene === 'offline-sidebar') params.set('backends', 'offline');
  return `${DEMO_PATH}?${params.toString()}`;
}

/** Host → demo: run or hold the walkthrough. The landing page pauses it while
 * it is scrolled out of view; the docs player also maps its play/pause button
 * onto this. */
export type DemoPlaybackMessage = { type: 'todex-demo-playback'; playing: boolean };

export function isDemoPlaybackMessage(value: unknown): value is DemoPlaybackMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoPlaybackMessage).type === 'todex-demo-playback'
    && typeof (value as DemoPlaybackMessage).playing === 'boolean';
}

/** The walkthrough's chapters, in order. */
export const DEMO_STEPS = ['loading', 'newConversation', 'typing', 'send', 'process', 'answer', 'done'] as const;
export type DemoStep = typeof DEMO_STEPS[number];

/** Demo → host, only with `?controls` (the docs player): where the walkthrough
 * is. `progress` runs 0..1; `ended` is set once it has finished (or could not
 * continue) and stays set until the host reloads the frame. */
export type DemoStatusMessage = { type: 'todex-demo-status'; step: DemoStep; progress: number; ended: boolean };

export function isDemoStatusMessage(value: unknown): value is DemoStatusMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoStatusMessage).type === 'todex-demo-status'
    && (DEMO_STEPS as readonly string[]).includes((value as DemoStatusMessage).step)
    && typeof (value as DemoStatusMessage).progress === 'number'
    && typeof (value as DemoStatusMessage).ended === 'boolean';
}

/** Frame size for an embed `containerWidth` wide. Wide hosts get the desktop
 * layout scaled down so the three panes keep their real proportions; phones
 * get the workbench's own phone layout at close to 1:1, which stays readable
 * instead of shrinking a desktop to ~6px text. */
export function demoFrameSize(containerWidth: number): { width: number; height: number } {
  return containerWidth < 640 ? { width: 390, height: 700 } : { width: Math.max(containerWidth, 1440), height: 880 };
}
