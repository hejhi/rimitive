// Lattice Core API - Pure signal-based state management

// Export context API
export { createLattice } from './context';

// Note: signal, computed, and effect are provided via context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  SignalState,
  LatticeContext,
  SetState,
} from './types';

// Export store API
export { createStore, partial, type Store } from './store';
