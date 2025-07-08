// Lattice Core API - Pure signal-based state management

// Export component API
export { createLattice } from './component';

// Note: signal, computed, and effect are provided via component context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  SignalState,
  LatticeContext,
  SetState,
} from './component/types';

// Export store API
export { createStore, partial, type Store } from './store';

// Export middleware
export { withStoreLogger } from './middleware/index';
