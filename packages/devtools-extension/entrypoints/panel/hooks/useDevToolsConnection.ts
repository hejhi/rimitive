import { useEffect, useRef } from 'react';
import { useDevtools } from '../store/DevtoolsProvider';
import { createMessageHandler, type DevToolsMessage } from '../store/messageHandler';

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useDevToolsConnection() {
  const devtools = useDevtools();
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    // Create message handler for this devtools instance
    const handleDevToolsMessage = createMessageHandler(devtools);

    function connect() {
      if (unmountedRef.current) return;

      console.log('[DevTools Panel] Attempting to connect...');

      try {
        const port = chrome.runtime.connect({ name: 'devtools-panel' });
        portRef.current = port;

        port.postMessage({
          type: 'INIT',
          tabId: chrome.devtools.inspectedWindow.tabId,
        });

        console.log('[DevTools Panel] Connected, sent INIT');

        port.onMessage.addListener((message: DevToolsMessage) => {
          console.log('[DevTools Panel] Received message:', message.type);
          handleDevToolsMessage(message);
        });

        port.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          console.log(
            '[DevTools Panel] Disconnected',
            error ? `Error: ${error.message}` : '(no error)'
          );
          portRef.current = null;

          // Attempt to reconnect if not unmounted
          if (
            !unmountedRef.current &&
            reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
          ) {
            // Show reconnecting state instead of disconnected
            devtools.connectionStatus('reconnecting');

            reconnectAttemptsRef.current++;
            console.log(
              `[DevTools Panel] Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
            );
            reconnectTimeoutRef.current = setTimeout(
              connect,
              RECONNECT_DELAY_MS
            );
          } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[DevTools Panel] Max reconnect attempts reached');
            // Only now show disconnected state
            devtools.connected(false);
            devtools.connectionStatus('disconnected');
            devtools.contexts([]);
            devtools.selectedContext(null);
            devtools.logEntries([]);
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
  }, [devtools]);
}
