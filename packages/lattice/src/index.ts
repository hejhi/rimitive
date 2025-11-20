// Lattice Core - Generic extension composition framework

// Export core extension system
export { createContext } from './extension';
export type {
  LatticeExtension,
  ExtensionContext,
  InstrumentationContext,
  CreateContextOptions,
  ExtensionsToContext,
  ExtensionMethod,
} from './extension';

// Export factory-based API (separate for tree-shaking)
export { createApi } from './api';
export type { InstantiableExtension } from './api';

// Export component composition pattern
export { create } from './component';
export type { Instantiatable } from './component';

// Export instrumentation system
export {
  withInstrumentation,
  createInstrumentation,
  composeProviders,
} from './instrumentation';
export type {
  InstrumentationEvent,
  InstrumentationProvider,
  InstrumentationConfig,
} from './instrumentation';

// Export built-in providers
export {
  performanceProvider,
  devtoolsProvider,
  isDevtoolsAvailable,
} from './instrumentation/providers';
export type {
  PerformanceProviderOptions,
  DevtoolsProviderOptions,
} from './instrumentation/providers';
