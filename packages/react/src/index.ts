// Essential hooks for React integration
export {
  useSubscribe,
  useSignal,
  useSelector,
  useComponent,
  SignalProvider,
  useSignalAPI,
} from './signals';

export { useLatticeContext } from './lattice';

// Types
export type { SignalValue, SignalSetter, SignalProviderProps } from './signals';

export type { ServiceDefinition, LatticeContext } from '@lattice/lattice';
