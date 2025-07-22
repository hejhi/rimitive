import { devtoolsState } from './devtoolsCtx';
import { updateContextFromEvent } from './contextManager';
import { processLogEntry } from './logProcessor';

export interface DevToolsMessage {
  type: string;
  data?: unknown;
}

export interface LatticeEvent {
  type: string;
  contextId: string;
  timestamp?: number;
  data?: unknown;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  switch (message.type) {
    case 'LATTICE_DETECTED':
      handleLatticeDetected();
      break;

    case 'TRANSACTION':
      handleTransaction(message.data);
      break;
      
    case 'NAVIGATION':
      handleNavigation();
      break;
  }
}

function handleLatticeDetected() {
  devtoolsState.connected.value = true;
  
  // Reset state for a fresh start
  devtoolsState.contexts.value = [];
  devtoolsState.selectedContext.value = null;
  devtoolsState.logEntries.value = [];
}

function handleTransaction(data: unknown) {
  if (!data || typeof data !== 'object') return;

  const event = data as LatticeEvent;

  // Update context metadata
  updateContextFromEvent(event);

  // Process log entries
  processLogEntry(event);
}

function handleNavigation() {
  // Clear all state on navigation
  devtoolsState.connected.value = false;
  devtoolsState.contexts.value = [];
  devtoolsState.selectedContext.value = null;
  devtoolsState.logEntries.value = [];
}
