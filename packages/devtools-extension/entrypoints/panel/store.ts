import { createLattice, createStore } from '@lattice/core';

// Create a Lattice context for the devtools panel itself
const devtoolsContext = createLattice();

export interface DevToolsState {
  connected: boolean;
  contexts: ContextInfo[];
  transactions: Transaction[];
  selectedContext: string | null;
  selectedTab: 'timeline' | 'graph' | 'inspector';
  filter: {
    type: 'all' | 'signal' | 'computed' | 'effect';
    search: string;
    hideInternal: boolean;
  };
}

export interface ContextInfo {
  id: string;
  name: string;
  signalCount: number;
  computedCount: number;
  effectCount: number;
  signals: SignalInfo[];
  computeds: ComputedInfo[];
  effects: EffectInfo[];
}

export interface SignalInfo {
  id: string;
  name?: string;
  value: unknown;
  lastUpdated: number;
}

export interface ComputedInfo {
  id: string;
  name?: string;
  value: unknown;
  dependencies: string[];
  lastComputed: number;
}

export interface EffectInfo {
  id: string;
  name?: string;
  isActive: boolean;
  lastRun: number;
}

// Transaction data types
export interface SignalReadData {
  id: string;
  name?: string;
  value: unknown;
  internal?: string;
  readContext?: {
    type: string;
    id: string;
    name?: string;
  };
}

export interface SignalWriteData {
  id: string;
  name?: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface SignalCreatedData {
  id: string;
  name?: string;
  initialValue: unknown;
}

export interface NamedItemData {
  id: string;
  name?: string;
}

export type TransactionData =
  | SignalReadData
  | SignalWriteData
  | SignalCreatedData
  | NamedItemData
  | unknown;

export interface Transaction {
  id: string;
  timestamp: number;
  contextId: string;
  type: 'signal' | 'computed' | 'effect' | 'batch';
  eventType: string;
  data: TransactionData;
}

// Create the devtools store
export const devtoolsStore = createStore<DevToolsState>(
  {
    connected: false,
    contexts: [],
    transactions: [],
    selectedContext: null,
    selectedTab: 'timeline',
    filter: {
      type: 'all',
      search: '',
      hideInternal: true,
    },
  },
  devtoolsContext
);

// Computed values
export const filteredTransactions = devtoolsContext.computed(() => {
  const transactions = devtoolsStore.state.transactions.value;
  const filter = devtoolsStore.state.filter.value;

  let filtered = transactions;

  // Filter by type
  if (filter.type !== 'all') {
    filtered = filtered.filter((t) => t.type === filter.type);
  }

  // Filter by search
  if (filter.search) {
    const search = filter.search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.eventType.toLowerCase().includes(search) ||
        JSON.stringify(t.data).toLowerCase().includes(search)
    );
  }

  // Filter internal reads if enabled
  if (filter.hideInternal) {
    filtered = filtered.filter((t) => {
      if (t.eventType !== 'SIGNAL_READ') return true;
      const data = t.data as SignalReadData;
      return !data.internal;
    });
  }

  return filtered;
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsStore.state.selectedContext.value;
  if (!selectedId) return null;

  return devtoolsStore.state.contexts.value.find((c) => c.id === selectedId);
});

export const stats = devtoolsContext.computed(() => {
  const contexts = devtoolsStore.state.contexts.value;

  return {
    totalSignals: contexts.reduce((sum, c) => sum + c.signalCount, 0),
    totalComputeds: contexts.reduce((sum, c) => sum + c.computedCount, 0),
    totalEffects: contexts.reduce((sum, c) => sum + c.effectCount, 0),
    totalTransactions: devtoolsStore.state.transactions.value.length,
  };
});

// Helper functions
export interface DevToolsMessage {
  type: string;
  data?: unknown;
}

export function handleDevToolsMessage(message: DevToolsMessage) {
  console.log('[DevTools Store] Handling message:', message);

  switch (message.type) {
    case 'LATTICE_DETECTED':
      console.log('[DevTools Store] Setting connected to true');
      devtoolsStore.state.connected.value = true;
      break;

    case 'STATE_UPDATE':
      console.log('[DevTools Store] Updating state with:', message.data);
      if (message.data && typeof message.data === 'object') {
        const stateData = message.data as {
          connected?: boolean;
          contexts?: ContextInfo[];
          transactions?: Transaction[];
          selectedContext?: string | null;
        };
        if (stateData.connected !== undefined) {
          devtoolsStore.state.connected.value = stateData.connected;
        }
        if (stateData.contexts) {
          devtoolsStore.state.contexts.value = stateData.contexts;
        }
        if (stateData.transactions) {
          devtoolsStore.state.transactions.value = stateData.transactions;
        }
        if (stateData.selectedContext !== undefined) {
          devtoolsStore.state.selectedContext.value = stateData.selectedContext;
        }
      }
      break;

    case 'TRANSACTION':
      if (message.data && typeof message.data === 'object') {
        const event = message.data as LatticeEvent;
        const transaction: Transaction = {
          id: `tx_${Date.now()}_${Math.random()}`,
          timestamp: event.timestamp || Date.now(),
          contextId: event.contextId,
          type: getEventCategory(event.type),
          eventType: event.type,
          data: event.data || {},
        };

        // Add transaction (keep last 1000)
        devtoolsStore.state.transactions.value = [
          ...devtoolsStore.state.transactions.value.slice(-999),
          transaction,
        ];

        // Update context metadata
        updateContextFromEvent(event);
      }
      break;
  }
}

function getEventCategory(
  eventType: string
): 'signal' | 'computed' | 'effect' | 'batch' {
  if (eventType.startsWith('SIGNAL_')) return 'signal';
  if (eventType.startsWith('COMPUTED_')) return 'computed';
  if (eventType.startsWith('EFFECT_')) return 'effect';
  return 'batch';
}

interface LatticeEvent {
  type: string;
  contextId: string;
  timestamp?: number;
  data?: unknown;
}

function updateContextFromEvent(event: LatticeEvent) {
  const contexts = [...devtoolsStore.state.contexts.value];
  const contextIndex = contexts.findIndex((c) => c.id === event.contextId);

  if (event.type === 'CONTEXT_CREATED' && contextIndex === -1) {
    contexts.push({
      id: event.contextId,
      name: event.data?.name || `Context ${event.contextId}`,
      signalCount: 0,
      computedCount: 0,
      effectCount: 0,
      signals: [],
      computeds: [],
      effects: [],
    });
  } else if (contextIndex !== -1) {
    const context = { ...contexts[contextIndex] };

    switch (event.type) {
      case 'SIGNAL_CREATED':
        context.signalCount++;
        context.signals.push({
          id: event.data.id,
          name: event.data.name,
          value: event.data.initialValue,
          lastUpdated: event.timestamp || Date.now(),
        });
        break;

      case 'SIGNAL_WRITE':
        const signalIndex = context.signals.findIndex(
          (s) => s.id === event.data.id
        );
        if (signalIndex !== -1) {
          context.signals[signalIndex] = {
            ...context.signals[signalIndex],
            value: event.data.newValue,
            lastUpdated: event.timestamp || Date.now(),
          };
        }
        break;

      case 'COMPUTED_CREATED':
        context.computedCount++;
        context.computeds.push({
          id: event.data.id,
          name: event.data.name,
          value: undefined,
          dependencies: [],
          lastComputed: 0,
        });
        break;

      case 'EFFECT_CREATED':
        context.effectCount++;
        context.effects.push({
          id: event.data.id,
          name: event.data.name,
          isActive: true,
          lastRun: 0,
        });
        break;
    }

    contexts[contextIndex] = context;
  }

  devtoolsStore.state.contexts.value = contexts;
}

// Removed time travel functionality

// Export context for disposal
export const devtoolsLatticeContext = devtoolsContext;
