// Signal hooks - the foundation
export {
  useSubscribe,
  useSignal,
  useComputed,
  useSignalEffect,
  useSelector,
} from './signals';

// Core hooks - store and context management
export {
  useLattice,
  useStore,
  useStoreContext,
  useSelect,
  createStoreHook,
} from './lattice';

// Components
export { LatticeProvider, StoreProvider } from './lattice';

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
} from './lattice';

// Re-export commonly used types from @lattice packages
export type { Signal, Computed, Selected } from '@lattice/signals';

export type { Store, LatticeContext } from '@lattice/lattice';
