export { compose, type CreateContextOptions } from './compose';
export { defineService } from './defineService';
export type {
  Service,
  ServiceDefinition,
  ServiceContext,
  InstrumentationContext,
  LatticeContext,
  ServiceImpl,
  ServiceName,
  DefinedService,
  Svc,
  Use,
  ExtractDeps,
  UnionToIntersection,
} from './types';
export { createInstrumentation } from './instrumentation';
export type {
  InstrumentationEvent,
  InstrumentationProvider,
  InstrumentationConfig,
} from './instrumentation';
export { devtoolsProvider } from './instrumentation/providers';
export type { DevtoolsProviderOptions } from './instrumentation/providers';
