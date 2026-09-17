export type WebFilePayload = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
  text?: string;
};

export type TodeXWebApi = {
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  fs: {
    readFile: (filePath: string) => Promise<WebFilePayload>;
  };
  app: {
    focus: () => void;
    windowChrome: 'hidden-inset' | 'native';
  };
  theme: {
    shouldUseDark: () => Promise<boolean>;
    onUpdated: (listener: (dark: boolean) => void) => () => void;
  };
};

declare global {
  interface Window {
    todexWeb: TodeXWebApi;
  }
}

export {};
