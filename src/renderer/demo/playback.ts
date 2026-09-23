// Shared by the landing page and the embedded demo; keep this file free of
// imports so the site bundle does not pull in workbench code.

export const DEMO_PATH = '/demo';

/** The landing page pauses the demo while it is scrolled out of view. */
export type DemoPlaybackMessage = { type: 'todex-demo-playback'; playing: boolean };

export function isDemoPlaybackMessage(value: unknown): value is DemoPlaybackMessage {
  return typeof value === 'object' && value !== null
    && (value as DemoPlaybackMessage).type === 'todex-demo-playback'
    && typeof (value as DemoPlaybackMessage).playing === 'boolean';
}
