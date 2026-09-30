import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './website.css';
import { Website } from './Website';
import { DocsPage } from './docs/DocsPage';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

// /docs is part of the public site but renders its own page shell.
const page = /^\/docs(?:\/|$)/.test(window.location.pathname) ? <DocsPage /> : <Website />;

createRoot(root).render(<StrictMode>{page}</StrictMode>);
