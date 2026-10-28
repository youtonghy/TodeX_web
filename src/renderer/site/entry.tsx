import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './website.css';
import { Website } from './Website';

// Only /docs needs the docs content; the landing page does not ship it.
const DocsPage = lazy(() => import('./docs/DocsPage').then((module) => ({ default: module.DocsPage })));

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

// /docs is part of the public site but renders its own page shell.
const page = /^\/docs(?:\/|$)/.test(window.location.pathname)
  ? <Suspense fallback={null}><DocsPage /></Suspense>
  : <Website />;

createRoot(root).render(<StrictMode>{page}</StrictMode>);
