import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Website } from './Website';
import './website.css';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(<StrictMode><Website /></StrictMode>);
