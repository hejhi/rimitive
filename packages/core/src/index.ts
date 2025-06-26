// Lattice Core API - Component-based state management

// Export component API
export { 
  createComponent, 
  createStore, 
  createStoreWithAdapter,
  partial 
} from './component';

// Note: signal and computed are provided via component context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  SignalState,
  LatticeContext,
  ComponentFactory,
  SetState,
} from './runtime-types';

// Export adapter contract
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapter-contract';

// Export built-in adapters
export { vanillaAdapter } from './adapters';

// Export Svelte-specific store creator
export { createSvelteStore } from './svelte';

// Export memoization utilities
export { memoizeParameterizedView, type MemoizeOptions } from './utils/memoize';

// Export convenience functions
export { select } from './utils';
