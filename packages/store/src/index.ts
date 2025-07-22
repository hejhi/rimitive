// Lattice Store - State management extensions using signals

// Re-export core extension system from lattice
export { createContext } from '@lattice/lattice';
export type { LatticeExtension, ExtensionContext, InstrumentationContext, CreateContextOptions } from '@lattice/lattice';

// Export context creation with all signal extensions
export { createLattice } from './context';

// Export individual extensions for tree-shaking
export { signalExtension } from './extensions/signal';
export { computedExtension } from './extensions/computed';
export { effectExtension } from './extensions/effect';
export { batchExtension } from './extensions/batch';
export { selectExtension } from './extensions/select';
export { subscribeExtension } from './extensions/subscribe';

// Export types
export type { SignalState, LatticeContext, SetState } from './types';

// Re-export instrumentation from lattice
export { withInstrumentation } from '@lattice/lattice';
export type { InstrumentationEvent, InstrumentationProvider, InstrumentationConfig } from '@lattice/lattice';

// Re-export built-in providers from lattice
export { performanceProvider, devtoolsProvider, isDevtoolsAvailable } from '@lattice/lattice';
export type { PerformanceProviderOptions, DevtoolsProviderOptions } from '@lattice/lattice';