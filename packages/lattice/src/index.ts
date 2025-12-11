export { compose, merge, type ComposeOptions } from './compose';
export { defineModule, isModule, STATUS_MODULE } from './module';
export type {
  Module,
  ModuleDefinition,
  ModuleImpl,
  ModuleName,
  ModuleDeps,
} from './module';
export type {
  ServiceContext,
  InstrumentationContext,
  Use,
  ComposedContext,
  UnionToIntersection,
  ModuleImpl as ServiceImpl,
  ModuleName as ServiceName,
} from './types';
export { createInstrumentation } from './instrumentation';
export type {
  InstrumentationEvent,
  InstrumentationProvider,
  InstrumentationConfig,
} from './instrumentation';
export { devtoolsProvider, isDevtoolsAvailable } from './instrumentation/providers';
export type { DevtoolsProviderOptions } from './instrumentation/providers';
