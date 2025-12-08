// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
  createHook,
  SignalProvider,
  useSignalSvc,
} from './signals';

export { useLatticeContext } from './lattice';

// Types
export type {
  SignalValue,
  SignalSetter,
  SignalProviderProps,
  SignalSvc,
  Readable,
  Writable,
} from './signals';

export type { Module, ComposedContext } from '@lattice/lattice';
