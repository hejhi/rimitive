import type { DevtoolsState } from './devtoolsBehavior';
import { createContextUpdater } from './contextManager';
import { createLogProcessor } from './logProcessor';
import { createGraphProcessor } from './graphProcessor';

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

/**
 * Create a message handler bound to a specific devtools state instance
 */
export function createMessageHandler(devtools: DevtoolsState) {
  const updateContextFromEvent = createContextUpdater(devtools);
  const processLogEntry = createLogProcessor(devtools);
  const processGraphEvent = createGraphProcessor(devtools);

  function handleRimitiveDetected(data?: unknown) {
    const wasReconnecting = devtools.connectionStatus.peek() === 'reconnecting';

    devtools.connected(true);
    devtools.connectionStatus('connected');

    // Only clear logs on fresh connection, not on reconnection
    if (!wasReconnecting) {
      devtools.logEntries([]);
    }

    // Add context from the detection payload if contextId is provided
    if (data && typeof data === 'object') {
      const payload = data as { contextId?: string; contextName?: string };
      if (payload.contextId) {
        const contexts = [...devtools.contexts.peek()];
        const existingIndex = contexts.findIndex((c) => c.id === payload.contextId);

        if (existingIndex === -1) {
          // Add new context
          contexts.push({
            id: payload.contextId,
            name: payload.contextName || `Service ${contexts.length + 1}`,
            created: Date.now(),
          });
          devtools.contexts(contexts);
        } else {
          // Update existing context name if provided
          if (payload.contextName) {
            contexts[existingIndex] = {
              ...contexts[existingIndex],
              name: payload.contextName,
            };
            devtools.contexts(contexts);
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
    devtools.connected(false);
    devtools.contexts([]);
    devtools.selectedContext(null);
    devtools.logEntries([]);
    // Clear graph state
    devtools.graphNodes(new Map());
    devtools.graphEdges(new Map());
    devtools.graphDependencies(new Map());
    devtools.graphDependents(new Map());
    devtools.selectedNodeId(null);
    devtools.viewMode('full');
    devtools.hoveredNodeId(null);
  }

  return function handleDevToolsMessage(message: DevToolsMessage) {
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
  };
}
