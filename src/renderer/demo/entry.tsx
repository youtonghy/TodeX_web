import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installDemoPlatformBridge } from './demoPlatform';
import { DemoApp } from './DemoApp';
import '@fontsource-variable/inter';
import '../styles/global.css';

installDemoPlatformBridge();

// The demo only exists to be embedded by the landing page.
const robots = document.createElement('meta');
robots.name = 'robots';
robots.content = 'noindex';
document.head.append(robots);

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(<StrictMode><DemoApp /></StrictMode>);
