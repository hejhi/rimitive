// Lattice Core API - Pure signal-based state management

// Export context creation
export { createLattice } from './context';
export { createContext } from './extension';

// Export extension system
export type { LatticeExtension, ExtensionContext, InstrumentationContext, CreateContextOptions } from './extension';

// Export individual extensions for tree-shaking
export { signalExtension } from './extensions/signal';
export { computedExtension } from './extensions/computed';
export { effectExtension } from './extensions/effect';
export { batchExtension } from './extensions/batch';
export { selectExtension } from './extensions/select';
export { subscribeExtension } from './extensions/subscribe';

// Export types
export type { SignalState, LatticeContext, SetState } from './types';
