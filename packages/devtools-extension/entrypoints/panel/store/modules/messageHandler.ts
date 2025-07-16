import { devtoolsStore } from '../devtoolsCtx';
import { ContextInfo, Transaction } from '../types';
import { createTransaction } from './transactionProcessor';
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
  transactions?: Transaction[];
  selectedContext?: string | null;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  console.log('[DevTools Store] Handling message:', message);

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
  console.log('[DevTools Store] Setting connected to true');
  devtoolsStore.state.connected.value = true;
}

function handleStateUpdate(data: unknown) {
  console.log('[DevTools Store] Updating state with:', data);
  
  if (!data || typeof data !== 'object') return;
  
  const stateData = data as StateUpdateData;
  
  if (stateData.connected !== undefined) {
    devtoolsStore.state.connected.value = stateData.connected;
  }
  
  if (stateData.contexts) {
    devtoolsStore.state.contexts.value = stateData.contexts;
    autoSelectFirstContext(stateData.contexts);
  }
  
  if (stateData.transactions) {
    devtoolsStore.state.transactions.value = stateData.transactions;
  }
  
  if (stateData.selectedContext !== undefined) {
    devtoolsStore.state.selectedContext.value = stateData.selectedContext;
  }
}

function handleTransaction(data: unknown) {
  if (!data || typeof data !== 'object') return;
  
  const event = data as LatticeEvent;
  const transaction = createTransaction(event);
  
  // Add transaction (keep last 1000)
  devtoolsStore.state.transactions.value = [
    ...devtoolsStore.state.transactions.value.slice(-999),
    transaction,
  ];
  
  // Update context metadata
  updateContextFromEvent(event);
  
  // Process log entries
  console.log('About to process log entry for:', event.type);
  processLogEntry(event);
}

function autoSelectFirstContext(contexts: ContextInfo[]) {
  if (!devtoolsStore.state.selectedContext.value && contexts.length > 0) {
    devtoolsStore.state.selectedContext.value = contexts[0].id;
  }
}