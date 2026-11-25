import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENES,
  DEMO_SCENE_STEPS,
  isDemoPlaybackMessage,
  isDemoSeekMessage,
  isDemoStatusMessage,
} from '../../src/renderer/demo/playback';
import { sceneScripts } from '../../src/renderer/demo/scenes';

describe('docs demo playback', () => {
  it('scripts exactly the steps the docs player lists, for every scene', () => {
    for (const scene of DEMO_SCENES) {
      expect(Object.keys(sceneScripts[scene].steps).sort(), scene).toEqual([...DEMO_SCENE_STEPS[scene]].sort());
      expect(DEMO_SCENE_STEPS[scene].length, scene).toBeGreaterThan(1);
    }
  });

  it('recognises only well-formed messages between the player and the demo', () => {
    expect(isDemoPlaybackMessage({ type: 'todex-demo-playback', playing: true })).toBe(true);
    expect(isDemoPlaybackMessage({ type: 'todex-demo-playback', playing: 'yes' })).toBe(false);
    expect(isDemoSeekMessage({ type: 'todex-demo-seek', step: 2 })).toBe(true);
    expect(isDemoSeekMessage({ type: 'todex-demo-seek', step: 1.5 })).toBe(false);
    expect(isDemoStatusMessage({ type: 'todex-demo-status', step: -1, seeking: false, ended: false })).toBe(true);
    expect(isDemoStatusMessage({ type: 'todex-demo-status', step: 'send', seeking: false, ended: false })).toBe(false);
    expect(isDemoStatusMessage({ type: 'todex-demo-status', step: 0, ended: false })).toBe(false);
    expect(isDemoStatusMessage(null)).toBe(false);
  });
});
