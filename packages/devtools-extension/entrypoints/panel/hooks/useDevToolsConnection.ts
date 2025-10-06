import { useEffect } from 'react';
import { handleDevToolsMessage, type DevToolsMessage } from '../store/store';
import { devtoolsState } from '../store/devtoolsCtx';

export function useDevToolsConnection() {
  useEffect(() => {
    let port: chrome.runtime.Port = null!;

    try {
      port = chrome.runtime.connect({ name: 'devtools-panel' });

      port.postMessage({
        type: 'INIT',
        tabId: chrome.devtools.inspectedWindow.tabId,
      });

      port.onMessage.addListener((message: DevToolsMessage) => {
        handleDevToolsMessage(message);
      });

      port.onDisconnect.addListener(() => {
        // Reset all state on disconnect
        devtoolsState.connected(false);
        devtoolsState.contexts([]);
        devtoolsState.selectedContext(null);
        devtoolsState.logEntries([]);
      });
    } catch (error) {
      console.error('[DevTools Panel] Error connecting to background:', error);
    }

    return () => {
      port?.disconnect();
    };
  }, []);
}
