// Lattice Core - Generic extension composition framework

// Export core extension system
export { compose } from './extension';
export type {
  ServiceDefinition,
  ServiceContext,
  InstrumentationContext,
  CreateContextOptions,
  LatticeContext,
  ServiceImpl,
} from './extension';

// Export factory-based API (separate for tree-shaking)
export { composeFrom } from './api';
export type { DefinedService } from './api';

// Export component composition pattern
export { defineService } from './component';
export type { Service } from './types';

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
