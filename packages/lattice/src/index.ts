export { compose, type CreateContextOptions } from './compose';
export { composeFrom } from './composeFrom';
export { defineService } from './defineService';
export type {
  Service,
  ServiceDefinition,
  ServiceContext,
  InstrumentationContext,
  LatticeContext,
  ServiceImpl,
  DefinedService,
} from './types';
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
export {
  devtoolsProvider,
  isDevtoolsAvailable,
} from './instrumentation/providers';
export type { DevtoolsProviderOptions } from './instrumentation/providers';
