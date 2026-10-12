export type TodeXWebApi = {
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  app: {
    focus: () => void;
    windowChrome: 'hidden-inset' | 'native';
  };
  theme: {
    shouldUseDark: () => Promise<boolean>;
    /** The Appearance choice; `system` follows the OS scheme. */
    setSource: (source: 'system' | 'light' | 'dark') => void;
    onUpdated: (listener: (dark: boolean) => void) => () => void;
  };
};

declare global {
  interface Window {
    todexWeb: TodeXWebApi;
  }
}

export {};
