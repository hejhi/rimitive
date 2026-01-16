import { devtoolsState } from './devtoolsCtx';
import { updateContextFromEvent } from './contextManager';
import { processLogEntry } from './logProcessor';

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
    case 'LATTICE_DETECTED':
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
  devtoolsState.connected(true);

  // Reset state for a fresh start
  devtoolsState.logEntries([]);

  // Create context from the detection payload if contextId is provided
  if (data && typeof data === 'object') {
    const payload = data as { contextId?: string; contextName?: string };
    if (payload.contextId) {
      devtoolsState.contexts([
        {
          id: payload.contextId,
          name: payload.contextName || 'Service 1',
          created: Date.now(),
        },
      ]);
      devtoolsState.selectedContext(payload.contextId);
      return;
    }
  }

  // Fallback: clear contexts if no contextId in payload
  devtoolsState.contexts([]);
  devtoolsState.selectedContext(null);
}

function handleTransaction(data: unknown) {
  if (!data || typeof data !== 'object') return;

  const event = data as RimitiveEvent;

  // Update context metadata
  updateContextFromEvent(event);

  // Process log entries
  processLogEntry(event);
}

function handleNavigation() {
  // Clear all state on navigation
  devtoolsState.connected(false);
  devtoolsState.contexts([]);
  devtoolsState.selectedContext(null);
  devtoolsState.logEntries([]);
}
