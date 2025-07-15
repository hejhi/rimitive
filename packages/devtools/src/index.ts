/**
 * @fileoverview Main entry point for Lattice DevTools
 */

// Main middleware export
export { withDevTools } from './middleware';

// Dependency utilities exports
export {
  getSubscribers,
  getDependencies,
  isRunning,
  isOutdated,
  hasSubscribers,
  getCurrentValue,
  getVersion,
  buildDependencyGraph,
  type DependencyInfo,
  type DependencyGraph,
  type DependencyGraphNode,
  type DependencyGraphEdge,
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
export { EventEmitter } from './events/emitter';
export { DevToolsAPIManager } from './events/api';
export { PrimitiveRegistry } from './tracking/registry';
export { ExecutionContextManager, executionContext } from './tracking/execution-context';
export { isSignal, isComputed, isEffect, isReactivePrimitive } from './type-guards';
export { DEVTOOLS_VERSION } from './constants';