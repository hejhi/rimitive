// Lattice Core API - Component-based state management

// Export component API
export {
  createComponent,
  partial,
} from './component';

// Note: signal and computed are provided via component context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  SignalState,
  ComponentContext,
  ComponentFactory,
  ComponentMiddleware,
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

// Export convenience functions
export { select } from './utils';

// Export middleware
export { withDevtools, withLogger, withPersistence } from './middleware';
