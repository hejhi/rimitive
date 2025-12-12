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
      handleRimitiveDetected();
      break;

    case 'TRANSACTION':
      handleTransaction(message.data);
      break;

    case 'NAVIGATION':
      handleNavigation();
      break;
  }
}

function handleRimitiveDetected() {
  devtoolsState.connected(true);

  // Reset state for a fresh start
  devtoolsState.contexts([]);
  devtoolsState.selectedContext(null);
  devtoolsState.logEntries([]);
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
