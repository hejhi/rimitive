// Lattice Core API - Pure signal-based state management

// Export context API
export { createLattice } from './context';

export type { SignalState, LatticeContext, SetState } from './types';

// Export store API
export { createStore, partial, type Store } from './store';
