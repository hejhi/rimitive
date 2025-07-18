import { useEffect } from 'react';
import { handleDevToolsMessage, type DevToolsMessage } from '../store/store';
import { devtoolsStore } from '../store/devtoolsCtx';

export function useDevToolsConnection() {
  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    let timeoutId: number | null = null;

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
        devtoolsStore.state.connected.value = false;
        devtoolsStore.state.contexts.value = [];
        devtoolsStore.state.selectedContext.value = null;
        devtoolsStore.state.logEntries.value = [];
        devtoolsStore.state.dependencyGraph.value = {
          nodes: new Map(),
          edges: new Map(),
          reverseEdges: new Map(),
        };
      });

      timeoutId = window.setTimeout(() => {
        port?.postMessage({
          type: 'GET_STATE',
          tabId: chrome.devtools.inspectedWindow.tabId,
        });
      }, 100);
    } catch (error) {
      console.error('[DevTools Panel] Error connecting to background:', error);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      port?.disconnect();
    };
  }, []);
}
