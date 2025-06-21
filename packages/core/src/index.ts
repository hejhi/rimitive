// Lattice Core API - Pure state management with slices

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export slice metadata utilities
export { getSliceMetadata } from './utils';

// Export internal metadata functions for framework packages
export { 
  storeSliceMetadata, 
  storeCompositionMetadata, 
  getCompositionMetadata 
} from './lib/metadata';

// Export runtime
export { createLatticeStore, type ComponentFactory } from './runtime';

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

// Export types that are needed by the runtime
export type {
  Selector,
  Selectors,
  SetState,
  ReactiveSliceFactory,
  SliceHandle,
} from './runtime-types';

// Import types needed for interfaces
import type { ReactiveSliceFactory } from './runtime-types';

// Re-export ReactiveSliceFactory for backwards compatibility
export type RuntimeSliceFactory<State> = ReactiveSliceFactory<State>;
