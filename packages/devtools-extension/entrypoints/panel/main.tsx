import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';

console.log('[DevTools Panel] main.tsx loading');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[DevTools Panel] React app mounted');
