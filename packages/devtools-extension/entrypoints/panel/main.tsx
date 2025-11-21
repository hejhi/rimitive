import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { SignalProvider } from '@lattice/react';
import { devtoolsContext } from './store/devtoolsCtx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SignalProvider svc={devtoolsContext}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </SignalProvider>
  </React.StrictMode>
);
