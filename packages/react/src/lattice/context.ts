import { createContext } from 'react';
import type {
  Store,
  LatticeContext as BaseLatticeContext,
} from '@lattice/lattice';

/**
 * React context for providing a Lattice instance to the component tree.
 * This allows all child components to access the same Lattice context
 * for creating signals, computed values, and effects.
 */
export const LatticeContext = createContext<BaseLatticeContext | null>(null);

/**
 * React context for providing a Store instance to the component tree.
 * This allows child components to access the store without prop drilling.
 */
// We use a generic object type here since the actual store type is determined at usage time
// The type assertion in useStoreContext ensures type safety
export const StoreContext = createContext<Store<object> | null>(null);
