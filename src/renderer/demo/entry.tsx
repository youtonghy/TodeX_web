import './isolate';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installDemoMode } from './index';
import { startDemoAutoplay } from './autoplay';
import { AppRoot } from '../AppRoot';
import { applyAppearance } from '../lib/appearance';
import '@fontsource-variable/inter';
import '../styles/global.css';

installDemoMode();
applyAppearance();
document.documentElement.dataset.windowChrome = window.todexWeb.app.windowChrome;

// The demo only exists to be embedded by the landing page.
const robots = document.createElement('meta');
robots.name = 'robots';
robots.content = 'noindex';
document.head.append(robots);

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(<StrictMode><AppRoot /></StrictMode>);
startDemoAutoplay();
