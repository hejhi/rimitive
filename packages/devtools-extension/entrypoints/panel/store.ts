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
  timeTravel: {
    snapshots: any[];
    currentIndex: number;
    isTimeTraveling: boolean;
    suppressEffects: boolean;
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
  value: any;
  lastUpdated: number;
}

export interface ComputedInfo {
  id: string;
  name?: string;
  value: any;
  dependencies: string[];
  lastComputed: number;
}

export interface EffectInfo {
  id: string;
  name?: string;
  isActive: boolean;
  lastRun: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  contextId: string;
  type: 'signal' | 'computed' | 'effect' | 'batch';
  eventType: string;
  data: any;
}

// Create the devtools store
export const devtoolsStore = createStore<DevToolsState>({
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
  timeTravel: {
    snapshots: [],
    currentIndex: -1,
    isTimeTraveling: false,
    suppressEffects: true,
  },
}, devtoolsContext);

// Computed values
export const filteredTransactions = devtoolsContext.computed(() => {
  const transactions = devtoolsStore.state.transactions.value;
  const filter = devtoolsStore.state.filter.value;
  
  let filtered = transactions;
  
  // Filter by type
  if (filter.type !== 'all') {
    filtered = filtered.filter(t => t.type === filter.type);
  }
  
  // Filter by search
  if (filter.search) {
    const search = filter.search.toLowerCase();
    filtered = filtered.filter(t => 
      t.eventType.toLowerCase().includes(search) ||
      JSON.stringify(t.data).toLowerCase().includes(search)
    );
  }
  
  // Filter internal reads if enabled
  if (filter.hideInternal) {
    filtered = filtered.filter(t => 
      t.eventType !== 'SIGNAL_READ' || !t.data.internal
    );
  }
  
  return filtered;
});

export const selectedContextData = devtoolsContext.computed(() => {
  const selectedId = devtoolsStore.state.selectedContext.value;
  if (!selectedId) return null;
  
  return devtoolsStore.state.contexts.value.find(c => c.id === selectedId);
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
export function handleDevToolsMessage(message: any) {
  console.log('[DevTools Store] Handling message:', message);
  
  switch (message.type) {
    case 'LATTICE_DETECTED':
      console.log('[DevTools Store] Setting connected to true');
      devtoolsStore.state.connected.value = true;
      break;
      
    case 'STATE_UPDATE':
      console.log('[DevTools Store] Updating state with:', message.data);
      if (message.data.connected !== undefined) {
        devtoolsStore.state.connected.value = message.data.connected;
      }
      if (message.data.contexts) {
        devtoolsStore.state.contexts.value = message.data.contexts;
      }
      if (message.data.transactions) {
        devtoolsStore.state.transactions.value = message.data.transactions;
      }
      if (message.data.selectedContext !== undefined) {
        devtoolsStore.state.selectedContext.value = message.data.selectedContext;
      }
      break;
      
    case 'TRANSACTION':
      const event = message.data;
      const transaction: Transaction = {
        id: `tx_${Date.now()}_${Math.random()}`,
        timestamp: event.timestamp || Date.now(),
        contextId: event.contextId,
        type: getEventCategory(event.type),
        eventType: event.type,
        data: event.data,
      };
      
      // Add transaction (keep last 1000)
      devtoolsStore.state.transactions.value = [
        ...devtoolsStore.state.transactions.value.slice(-999),
        transaction,
      ];
      
      // Update context metadata
      updateContextFromEvent(event);
      break;
  }
}

function getEventCategory(eventType: string): 'signal' | 'computed' | 'effect' | 'batch' {
  if (eventType.startsWith('SIGNAL_')) return 'signal';
  if (eventType.startsWith('COMPUTED_')) return 'computed';
  if (eventType.startsWith('EFFECT_')) return 'effect';
  return 'batch';
}

function updateContextFromEvent(event: any) {
  const contexts = [...devtoolsStore.state.contexts.value];
  const contextIndex = contexts.findIndex(c => c.id === event.contextId);
  
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
        const signalIndex = context.signals.findIndex(s => s.id === event.data.id);
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

// Time travel helpers
export function requestTimeTravel(action: string, data?: any) {
  // Send message to content script to execute time travel
  chrome.devtools.inspectedWindow.eval(`
    if (window.__LATTICE_DEVTOOLS__ && window.__LATTICE_DEVTOOLS__.timeTravel) {
      const tt = window.__LATTICE_DEVTOOLS__.timeTravel;
      const result = tt.${action}${data !== undefined ? `(${JSON.stringify(data)})` : '()'};
      if (result !== undefined) {
        ${JSON.stringify({ type: 'TIME_TRAVEL_RESULT', action, result: true })};
      }
    }
  `);
}

export function updateTimeTravelState() {
  chrome.devtools.inspectedWindow.eval(`
    if (window.__LATTICE_DEVTOOLS__ && window.__LATTICE_DEVTOOLS__.timeTravel) {
      const state = window.__LATTICE_DEVTOOLS__.timeTravel.getState();
      const snapshots = window.__LATTICE_DEVTOOLS__.timeTravel.getSnapshots();
      ({ type: 'TIME_TRAVEL_STATE', state, snapshots });
    }
  `, (result, err) => {
    if (!err && result) {
      const data = eval(`(${result})`);
      if (data.type === 'TIME_TRAVEL_STATE') {
        devtoolsStore.set({
          timeTravel: {
            ...devtoolsStore.state.timeTravel.value,
            ...data.state,
            snapshots: data.snapshots,
          },
        });
      }
    }
  });
}

// Export context for disposal
export const devtoolsLatticeContext = devtoolsContext;