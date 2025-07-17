// Signal hooks - the foundation
export {
  useSubscribe,
  useSignal,
  useComputed,
  useSignalEffect,
  useSelector,
} from './signals';

// Core hooks - store and context management
export { useLattice, useStore, useStoreContext, useSelect, createStoreHook } from './core';

// Components
export { LatticeProvider, StoreProvider } from './core';

// Types
export type {
  // Signal types
  SignalLike,
  SignalValue,
  SignalSetter,
  EffectCleanup,
} from './signals';

export type {
  // Core types
  LatticeProviderProps,
  StoreProviderProps,
  StoreFactory,
} from './core';

// Re-export commonly used types from @lattice packages
export type { Signal, Computed, Selected } from '@lattice/signals';

export type { Store, LatticeContext } from '@lattice/core';
