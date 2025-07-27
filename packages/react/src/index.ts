// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
  SignalProvider,
  useSignalAPI,
} from './signals';

export { useLatticeContext } from './lattice';

// Types
export type {
  SignalValue,
  SignalSetter,
  SignalProviderProps,
} from './signals';

// Re-export commonly used types from @lattice packages
export type { Signal } from '@lattice/signals';
export type { ComputedInterface } from '@lattice/signals/computed';
export type { LatticeExtension, ExtensionsToContext } from '@lattice/lattice';
