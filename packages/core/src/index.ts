// Lattice Core API - Pure signal-based state management

// Export context API
export { createLattice } from './context';

// Export type guards from signals package
export { isSignal, isComputed, isEffect, isReactive } from '@lattice/signals';

// Note: signal, computed, and effect are provided via context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  Selected,
  Effect,
  EffectDisposer,
  SignalState,
  LatticeContext,
  SetState,
} from './types';

// Export store API
export { createStore, partial, type Store } from './store';
