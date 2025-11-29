// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
  useComponent,
  createHook,
  SignalProvider,
  useSignalAPI,
} from './signals';

export { useLatticeContext } from './lattice';

// Types
export type {
  SignalValue,
  SignalSetter,
  SignalProviderProps,
  Readable,
  Writable,
  ReactiveAdapter,
} from './signals';

export type { ServiceDefinition, LatticeContext } from '@lattice/lattice';
