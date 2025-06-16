// Lattice Core API - Pure state management with slices

// Export compose utilities
export { compose } from './compose';

// Export resolve utility for bound computed views
export { resolve } from './resolve';

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

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
export { createStore, type StoreTools, type StoreSliceFactory } from './store';

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

// Type for runtime slice factory that returns full LatticeSlice
export type RuntimeSliceFactory<State> = <Methods>(
  factory: (tools: StoreTools<State>) => Methods
) => LatticeSlice<Methods, State>;

/**
 * Factory function that creates a slice factory when provided with tools.
 * This is used internally by the runtime to create adapter-backed stores.
 */
export type StoreFactory<State> = (
  tools: StoreTools<State>
) => import('./store').StoreSliceFactory<State>;
