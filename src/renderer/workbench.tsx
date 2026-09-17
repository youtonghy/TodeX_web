import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installWebPlatformBridge } from './lib/webPlatform';
import '@fontsource-variable/inter';
import './styles/global.css';

installWebPlatformBridge();

// Keep parity with the desktop renderer: the window-chrome attribute drives
// drag-region CSS, which is inert in a browser ('native').
document.documentElement.dataset.windowChrome = window.todexWeb.app.windowChrome;

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(<StrictMode><App /></StrictMode>);
