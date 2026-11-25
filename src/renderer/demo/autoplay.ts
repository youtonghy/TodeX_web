// Plays the scripted demos (./scenes) on the real workbench:
// - `/demo?autoplay` (landing page): loops the walkthrough, pausing while the
//   host reports it scrolled away; stays still under reduced motion.
// - `/demo?scene=<scene>&autoplay&controls` (docs player): plays the scene's
//   steps once, follows the host's play/pause, fast-forwards on a seek
//   (`step=<n>` on boot) and reports the step back.
// - `/demo?scene=<scene>` without `autoplay`: quietly opens the scene's first
//   step. Plain `/demo` stays identical to the desktop's `?demo`.
import { DEMO_SCENE_STEPS, isDemoPlaybackMessage, isDemoScene, isDemoSeekMessage, type DemoScene, type DemoStatusMessage } from './playback';
import { Stopped, createClock, createDriver, type DemoDriver } from './driver';
import { sceneScripts } from './scenes';
import { setDemoTurnScript } from './transport';
import { scriptedTurn, walkthroughPrompt } from './walkthrough';

const LOOP_PAUSE_MS = 8000;
/** The docs player lets the last step sit this long before it ends. */
const END_HOLD_MS = 1500;
/** How much faster the demo runs while it fast-forwards to a step. */
const SEEK_SPEED = 14;

function stepsOf(scene: DemoScene): ((d: DemoDriver) => Promise<void>)[] {
  const steps = sceneScripts[scene].steps as Record<string, (d: DemoDriver) => Promise<void>>;
  return DEMO_SCENE_STEPS[scene].map((id) => steps[id]);
}

export function startDemoAutoplay(): void {
  const params = new URLSearchParams(window.location.search);
  const autoplay = params.has('autoplay');
  const controlled = autoplay && params.has('controls');
  const rawScene = params.get('scene');
  const scene: DemoScene | null = rawScene && isDemoScene(rawScene) ? rawScene : autoplay ? 'walkthrough' : null;
  if (!scene) return;
  // Reduced motion keeps the still demo on the landing page; the docs player
  // only moves when the reader presses play.
  if (autoplay && !controlled && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const clock = createClock();
  const prompt = walkthroughPrompt();
  setDemoTurnScript((text, turnId) => (text.trim() === prompt ? scriptedTurn(prompt, turnId) : null), clock.after);
  const script = sceneScripts[scene];
  const steps = stepsOf(scene);

  if (!autoplay) {
    // A still scene for local checks: open it without a pointer and stop.
    clock.setSpeed(SEEK_SPEED);
    const driver = createDriver(clock, { pointer: false });
    void script.prepare(driver).then(() => steps[0](driver)).catch(() => {
      // Best effort; leave the reader on whatever view opened.
    });
    return;
  }

  const driver = createDriver(clock);
  let step = -1;
  let target = 0;
  let ended = false;
  const report = () => {
    if (!controlled || window.parent === window) return;
    const message: DemoStatusMessage = { type: 'todex-demo-status', step, seeking: !ended && step < target, ended };
    window.parent.postMessage(message, window.location.origin);
  };
  const seekTo = (next: number) => {
    target = Math.min(Math.max(next, 0), steps.length - 1);
    clock.setSpeed(step < target ? SEEK_SPEED : 1);
    report();
  };

  // The landing page pauses the demo while it is scrolled away; the docs
  // player also pauses it on request, and starts it explicitly (opened on its
  // own, the page just plays).
  if (controlled) {
    if (window.parent !== window) clock.setRunning(false);
    const start = Number(params.get('step'));
    if (Number.isInteger(start) && start > 0) seekTo(start);
    // A heartbeat, so a host that starts listening late still hears it.
    window.setInterval(report, 500);
  }
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (isDemoPlaybackMessage(event.data)) clock.setRunning(event.data.playing);
    else if (controlled && isDemoSeekMessage(event.data) && !ended && event.data.step > step) seekTo(event.data.step);
  });
  report();

  const run = async () => {
    await script.prepare(driver);
    for (let index = 0; index < steps.length; index += 1) {
      step = index;
      if (step >= target) clock.setSpeed(1);
      report();
      await steps[index](driver);
    }
    driver.hidePointer();
    // Let the finished demo sit, then start over (landing) or stop (docs
    // player, which offers a replay).
    if (!controlled) {
      await clock.wait(LOOP_PAUSE_MS);
      window.location.reload();
      return;
    }
    await clock.wait(END_HOLD_MS);
    ended = true;
    report();
  };
  void run().catch((error: unknown) => {
    driver.hidePointer();
    ended = true;
    clock.setSpeed(1);
    report();
    if (!(error instanceof Stopped)) console.error('TodeX demo autoplay stopped', error);
    else console.warn(`TodeX demo "${scene}" stopped at step ${step}: a target did not show up`);
  });
}
