import { createLattice, createStore } from '@lattice/lattice';
import { DevToolsState } from './types';

// Create a Lattice context for the devtools panel itself
export const devtoolsContext = createLattice();

// Create the devtools store
export const devtoolsStore = createStore<DevToolsState>(
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
