// Lattice Core API - Component-based state management

// Export component API
export { createComponent, partial } from './component/component';

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
} from './component/types';

// Export adapter contract
export {
  type StoreAdapter,
  type AdapterFactory,
  isStoreAdapter,
  isAdapterFactory,
} from './adapters/contract';

// Export built-in adapters
export { vanillaAdapter } from './adapters/vanilla';

// Export middleware
export { withDevtools, withLogger, withPersistence } from './middleware/index';
