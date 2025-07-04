// Lattice Core API - Pure signal-based state management

// Export component API
export { createComponent, partial } from './component/component';

// Note: signal, computed, and effect are provided via component context, not exported globally

// Export types
export type {
  Signal,
  Computed,
  SignalState,
  ComponentContext,
  ComponentFactory,
  SetState,
} from './component/types';

// Export middleware
export { withDevtools, withLogger, withPersistence } from './middleware/index';

// Export raw signal APIs for direct usage (bypasses component layer)
export { signal, computed, effect, batch, set } from './primitives/signals/index';
