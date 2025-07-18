import { devtoolsStore } from './devtoolsCtx';
import { ContextInfo } from './types';
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

interface StateUpdateData {
  connected?: boolean;
  contexts?: ContextInfo[];
  selectedContext?: string | null;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  switch (message.type) {
    case 'LATTICE_DETECTED':
      handleLatticeDetected();
      break;

    case 'STATE_UPDATE':
      handleStateUpdate(message.data);
      break;

    case 'TRANSACTION':
      handleTransaction(message.data);
      break;
  }
}

function handleLatticeDetected() {
  // Reset all state when Lattice is detected (page refresh/navigation)
  devtoolsStore.state.connected.value = true;
  devtoolsStore.state.contexts.value = [];
  devtoolsStore.state.selectedContext.value = null;
  devtoolsStore.state.logEntries.value = [];

  // Reset dependency graph
  devtoolsStore.state.dependencyGraph.value = {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };
}

function handleStateUpdate(data: unknown) {
  if (!data || typeof data !== 'object') return;

  const stateData = data as StateUpdateData;

  if (stateData.connected !== undefined) {
    devtoolsStore.state.connected.value = stateData.connected;
  }

  if (stateData.contexts) {
    devtoolsStore.state.contexts.value = stateData.contexts;
    autoSelectFirstContext(stateData.contexts);
  }

  if (stateData.selectedContext !== undefined) {
    devtoolsStore.state.selectedContext.value = stateData.selectedContext;
  }
}

function handleTransaction(data: unknown) {
  if (!data || typeof data !== 'object') return;

  const event = data as LatticeEvent;

  // Update context metadata
  updateContextFromEvent(event);

  // Process log entries
  processLogEntry(event);
}

function autoSelectFirstContext(contexts: ContextInfo[]) {
  if (!devtoolsStore.state.selectedContext.value && contexts.length > 0) {
    devtoolsStore.state.selectedContext.value = contexts[0].id;
  }
}
