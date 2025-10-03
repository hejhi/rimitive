// Lattice Core - Generic extension composition framework

// Export core extension system
export { createContext } from './extension';
export type { LatticeExtension, ExtensionContext, InstrumentationContext, CreateContextOptions, ExtensionsToContext, ExtensionMethod } from './extension';

// Export factory-based API (separate for tree-shaking)
export { createApi } from './api';
export type { ExtensionFactory } from './api';

// Export instrumentation system
export { withInstrumentation } from './instrumentation';
export type { InstrumentationEvent, InstrumentationProvider, InstrumentationConfig } from './instrumentation';

// Export built-in providers
export { performanceProvider, devtoolsProvider, isDevtoolsAvailable } from './instrumentation/providers';
export type { PerformanceProviderOptions, DevtoolsProviderOptions } from './instrumentation/providers';