export {
  useLattice,
  useStore,
  useStoreContext,
} from './hooks';

export { LatticeProvider, StoreProvider } from './components';

export { LatticeContext, StoreContext } from './context';

export type {
  LatticeProviderProps,
  StoreProviderProps,
  StoreFactory,
} from './types';

// Re-export core types for convenience
export type {
  Store,
  LatticeContext as BaseLatticeContext,
} from '@lattice/core';
