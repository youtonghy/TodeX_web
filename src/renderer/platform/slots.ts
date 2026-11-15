// Web pieces of the shared screens (see ./types.ts PlatformSlots): none of
// the desktop's local backend, container, update or browser-tab features.
import type { PlatformSlots } from './types';

const NO_FLOW = { body: null, footer: null };

export const slots: PlatformSlots = {
  useSessionEffects: () => undefined,
  useAppEffects: () => undefined,
  AppOverlays: null,
  settingsSections: [],
  AboutExtras: null,
  BrowserPane: null,
  containerWorkspaces: false,
  useContainerWorkspaceFlow: () => NO_FLOW,
};
