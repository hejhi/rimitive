export { compose, type ComposeOptions } from './compose';
export { merge } from './merge';
export { override, isOverriddenModule } from './override';
export type { OverriddenModule } from './override';
export { fork, type ForkOptions } from './fork';
export { defineModule, isModule, transient, isTransient, lazy, isLazy, STATUS_MODULE } from './module';
export type { LazyModule, TransientModule } from './module';
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
  ContainsLazy,
} from './types';
export {
  createInstrumentation,
  getCallerLocation,
  getCallerLocationFull,
} from './instrumentation';
export type {
  InstrumentationEvent,
  InstrumentationProvider,
  InstrumentationConfig,
  SourceLocation,
} from './instrumentation';
export { devtoolsProvider, isDevtoolsAvailable } from './instrumentation/providers';
export type { DevtoolsProviderOptions } from './instrumentation/providers';
