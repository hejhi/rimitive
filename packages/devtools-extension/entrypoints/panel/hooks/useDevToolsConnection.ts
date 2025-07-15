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
        console.log(
          '[DevTools Panel] Received message from background:',
          message
        );
        handleDevToolsMessage(message);
      });

      port.onDisconnect.addListener(() => {
        devtoolsStore.state.connected.value = false;
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
