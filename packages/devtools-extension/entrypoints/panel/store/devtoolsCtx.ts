import { createLattice } from '@lattice/lattice';
import type { LatticeContext, SignalState } from '@lattice/lattice';
import type { DevToolsState } from './types';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createLattice();

// Create the devtools store - convert initial state to signals
function createStoreFromContext<T>(
  initialState: T,
  context: LatticeContext
): { state: SignalState<T> } {
  const state = {} as SignalState<T>;
  
  // Type assertion needed due to generic constraints
  const entries = Object.entries(initialState as Record<string, unknown>);
  for (const [key, value] of entries) {
    state[key as keyof T] = context.signal(value) as SignalState<T>[keyof T];
  }
  
  return { state };
}

// Create the devtools store
export const devtoolsStore = createStoreFromContext<DevToolsState>(
  {
    connected: false,
    contexts: [],
    selectedContext: null,
    selectedTransaction: null,
    selectedTab: 'logs',
    filter: {
      type: 'all',
      search: '',
      hideInternal: true,
    },
    dependencyGraph: {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
    },
    lastSnapshot: null,
    logEntries: [],
  },
  devtoolsContext
);
