// Lattice Core API - Pure state management with slices

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export convenience functions
export { select } from './utils';


// Export runtime - now using the simple cache implementation as default
export { createLatticeStore, type ComponentFactory, signal, computed, partial } from './runtime';

// Export built-in adapters
export { vanillaAdapter, createStore } from './adapters';

// Export Svelte-specific store creator
export { createSvelteStore } from './svelte';

// Export adapter contract
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';

// Export subscription types (kept for adapter compatibility)
export type SubscribableStore = {
  subscribe: (listener: () => void) => () => void;
};

// Export types that are needed by the runtime
export type {
  Signal,
  Computed,
  SignalState,
  ReactiveSliceFactory,
  SliceHandle,
} from './runtime-types';

// Import types needed for interfaces
import type { ReactiveSliceFactory } from './runtime-types';

// Re-export ReactiveSliceFactory for backwards compatibility
export type RuntimeSliceFactory<State> = ReactiveSliceFactory<State>;
