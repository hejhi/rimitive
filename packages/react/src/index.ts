// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
} from './signals';

export { useStore, createStore } from './lattice';

// Types
export type {
  SignalLike,
  SignalValue,
  SignalSetter,
} from './signals';

export type { StoreFactory, Store } from './lattice';

// Re-export commonly used types from @lattice packages
export type { Signal, Computed, Selected } from '@lattice/signals';
export type { LatticeContext } from '@lattice/lattice';
