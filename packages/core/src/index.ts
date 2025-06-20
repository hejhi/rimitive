// Lattice Core API - Pure state management with slices

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export slice metadata utilities  
export { getSliceMetadata } from './utils';

// Export runtime
export {
  createLatticeStore,
  type ComponentFactory,
} from './runtime';

// Export adapter contract
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';

// Export subscription utilities
export {
  subscribeToSlices,
  shallowEqual,
  type SubscribableStore,
  type SubscribeOptions,
} from './subscribe';

// Import and re-export store functionality
export { 
  createStore,
  type StoreTools, 
  type StoreSliceFactory,
  type Selector,
  type Selectors,
  type SetState,
  type ReactiveSliceFactory,
  type SliceHandle
} from './store';

// Import types needed for interfaces
import type { StoreAdapter as Adapter } from './adapter-contract';
import type { StoreTools } from './store';

/**
 * A Lattice slice with methods, subscription, and composition capabilities
 */
export interface LatticeSlice<Methods, State> {
  selector: Methods;
  subscribe: (listener: () => void) => () => void;
  compose: (tools: StoreTools<State>) => LatticeSlice<Methods, State>;
  adapter: Adapter<State>;
}

// Re-export ReactiveSliceFactory for backwards compatibility
export type RuntimeSliceFactory<State> = ReactiveSliceFactory<State>;

/**
 * Factory function that creates a slice factory when provided with tools.
 * This is used internally by the runtime to create adapter-backed stores.
 */
export type StoreFactory<State> = (
  tools: StoreTools<State>
) => import('./store').StoreSliceFactory<State>;
