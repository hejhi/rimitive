// Lattice Store - State management extensions using signals

// Export all signal extensions
export { coreExtensions } from './context';

// Export individual extensions for tree-shaking
export { signalExtension } from './extensions/signal';
export { computedExtension } from './extensions/computed';
export { effectExtension } from './extensions/effect';
export { batchExtension } from './extensions/batch';
export { selectExtension } from './extensions/select';
export { subscribeExtension } from './extensions/subscribe';

// Export types
export type { SignalState, LatticeContext, SetState } from './types';

// Export instrumentation
export * from './instrumentation';