import { useEffect, useRef } from 'react';
import { handleDevToolsMessage, type DevToolsMessage } from '../store/store';
import { devtoolsState } from '../store/devtoolsCtx';

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useDevToolsConnection() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      try {
        const port = chrome.runtime.connect({ name: 'devtools-panel' });
        portRef.current = port;

        port.postMessage({
          type: 'INIT',
          tabId: chrome.devtools.inspectedWindow.tabId,
        });

        port.onMessage.addListener((message: DevToolsMessage) => {
          handleDevToolsMessage(message);
        });

        port.onDisconnect.addListener(() => {
          portRef.current = null;

          // Reset connection state
          devtoolsState.connected(false);

          // Attempt to reconnect if not unmounted
          if (
            !unmountedRef.current &&
            reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
          ) {
            reconnectAttemptsRef.current++;
            reconnectTimeoutRef.current = setTimeout(
              connect,
              RECONNECT_DELAY_MS
            );
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            // Clear state after max attempts
            devtoolsState.contexts([]);
            devtoolsState.selectedContext(null);
            devtoolsState.logEntries([]);
          }
        });

        // Reset reconnect counter on successful connection
        reconnectAttemptsRef.current = 0;
      } catch (error) {
        console.error('[DevTools Panel] Error connecting to background:', error);

        // Retry on error
        if (
          !unmountedRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      }
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      portRef.current?.disconnect();
    };
  }, []);
}
