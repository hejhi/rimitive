// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
} from './signals';

export { useStore } from './lattice';

// Types
export type {
  SignalLike,
  SignalValue,
  SignalSetter,
} from './signals';

export type { StoreFactory } from './lattice';

// Re-export commonly used types from @lattice packages
export type { Signal, Computed, Selected } from '@lattice/signals';
export type { Store, LatticeContext } from '@lattice/lattice';
