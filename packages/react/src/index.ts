// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
} from './signals';

export { useLatticeContext } from './lattice';

// Types
export type {
  SignalLike,
  SignalValue,
  SignalSetter,
} from './signals';

// Re-export commonly used types from @lattice packages
export type { Signal, Computed, Selected } from '@lattice/signals';
export type { LatticeExtension, ExtensionsToContext } from '@lattice/lattice';
