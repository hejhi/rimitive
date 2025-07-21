/**
 * @fileoverview Main entry point for Lattice DevTools
 */

// Primary API - instrumentation
export { createInstrumentation, enableDevTools } from './instrumentation';

// Legacy middleware export
export { withDevTools } from './middleware';

// Dependency utilities exports
export {
  getSubscribers,
  getDependencies,
  getCurrentValue,
  type DependencyInfo,
} from './dependency-utils';

// Type exports
export type {
  DevToolsOptions,
  DevToolsEvent,
  DevToolsEventType,
  DevToolsAPI,
  ContextEventData,
  SignalEventData,
  ComputedEventData,
  EffectEventData,
  BatchEventData,
  DependencyUpdateData,
  SelectorEventData,
  GraphSnapshotData,
} from './types';

// Advanced exports for extensions and tools
export { createEventEmitter, type EventEmitter } from './events/emitter';
export { createDevToolsAPIManager, getDevToolsAPI, isDevToolsEnabled, type DevToolsAPIManager } from './events/api';
export { createPrimitiveRegistry, type PrimitiveRegistry } from './tracking/registry';
export { createExecutionContextManager, executionContext, type ExecutionContextManager } from './tracking/execution-context';
export { isSignal, isComputed, isEffect, isReactivePrimitive } from './type-guards';
export { DEVTOOLS_VERSION, DEVTOOLS_WINDOW_KEY } from './constants';
