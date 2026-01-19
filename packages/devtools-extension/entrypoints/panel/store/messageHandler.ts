import { devtoolsState } from './devtoolsCtx';
import { updateContextFromEvent } from './contextManager';
import { processLogEntry } from './logProcessor';
import { processGraphEvent } from './graphProcessor';
import { clearGraph } from './graphState';

export type DevToolsMessage = {
  type: string;
  data?: unknown;
};

export type RimitiveEvent = {
  type: string;
  contextId: string;
  timestamp?: number;
  data?: unknown;
};

export function handleDevToolsMessage(message: DevToolsMessage) {
  switch (message.type) {
    case 'RIMITIVE_DETECTED':
      handleRimitiveDetected(message.data);
      break;

    case 'TRANSACTION':
      handleTransaction(message.data);
      break;

    case 'NAVIGATION':
      handleNavigation();
      break;
  }
}

function handleRimitiveDetected(data?: unknown) {
  const wasReconnecting = devtoolsState.connectionStatus() === 'reconnecting';

  devtoolsState.connected(true);
  devtoolsState.connectionStatus('connected');

  // Only clear logs on fresh connection, not on reconnection
  if (!wasReconnecting) {
    devtoolsState.logEntries([]);
  }

  // Add context from the detection payload if contextId is provided
  if (data && typeof data === 'object') {
    const payload = data as { contextId?: string; contextName?: string };
    if (payload.contextId) {
      const contexts = [...devtoolsState.contexts()];
      const existingIndex = contexts.findIndex((c) => c.id === payload.contextId);

      if (existingIndex === -1) {
        // Add new context
        contexts.push({
          id: payload.contextId,
          name: payload.contextName || `Service ${contexts.length + 1}`,
          created: Date.now(),
        });
        devtoolsState.contexts(contexts);
      } else {
        // Update existing context name if provided
        if (payload.contextName) {
          contexts[existingIndex] = {
            ...contexts[existingIndex],
            name: payload.contextName,
          };
          devtoolsState.contexts(contexts);
        }
      }

      // Keep "All" as default - don't auto-select first context
      return;
    }
  }
}

function handleTransaction(data: unknown) {
  if (!data || typeof data !== 'object') return;

  const event = data as RimitiveEvent;

  // Update context metadata
  updateContextFromEvent(event);

  // Process log entries
  processLogEntry(event);

  // Process graph events
  processGraphEvent(event);
}

function handleNavigation() {
  // Clear all state on navigation
  devtoolsState.connected(false);
  devtoolsState.contexts([]);
  devtoolsState.selectedContext(null);
  devtoolsState.logEntries([]);
  clearGraph();
}
