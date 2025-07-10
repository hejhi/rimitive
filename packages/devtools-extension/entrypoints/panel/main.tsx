import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './globals.css';
import './style.css';
import { ThemeProvider } from '@/components/theme-provider';

console.log('[DevTools Panel] main.tsx loading');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

console.log('[DevTools Panel] React app mounted');
