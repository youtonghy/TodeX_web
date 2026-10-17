import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoot } from './AppRoot';
import { IosUnsupportedNotice } from './components/IosUnsupportedNotice';
import { installWebPlatformBridge } from './lib/webPlatform';
import { applyAppearance } from './lib/appearance';
import { loadWebDeployment } from './lib/webDeployment';
import '@fontsource-variable/inter';
import './styles/global.css';

// A self-hosted server pins its backends; the session reads them from the
// bridge on its first load, so the bridge is installed only once they are known.
installWebPlatformBridge(await loadWebDeployment());
applyAppearance();

// Keep parity with the desktop renderer: the window-chrome attribute drives
// drag-region CSS, which is inert in a browser ('native').
document.documentElement.dataset.windowChrome = window.todexWeb.app.windowChrome;

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

const reactRoot = createRoot(root);
// A hot update that cannot Fast Refresh re-runs this module: unmount the
// previous app first, or it keeps running unseen with its own state,
// backend sockets and store writes beside the new one.
import.meta.hot?.dispose(() => reactRoot.unmount());
reactRoot.render((
  <StrictMode>
    <AppRoot />
    <IosUnsupportedNotice />
  </StrictMode>
));
