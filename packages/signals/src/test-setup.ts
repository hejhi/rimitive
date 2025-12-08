// Test setup for signal tests
// Provides global-like exports for test compatibility while using scoped implementation

import type { SignalFunction } from './signal';
import type { ComputedFunction } from './computed';
import type { ConsumerNode } from './types';
import type { SubscribeCallback } from './subscribe';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createSubscribeFactory } from './subscribe';
import { createGraphEdges } from './deps/graph-edges';
import { createPullPropagator } from './deps/pull-propagator';
import { createScheduler } from './deps/scheduler';
import { createGraphTraversal } from './deps/graph-traversal';

// Create a complete context with all deps
export function createDefaultContext() {
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll: graphEdges.detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const pull = createPullPropagator({ track: graphEdges.track });

  return {
    propagate: withPropagate(withVisitor),
    ...graphEdges,
    ...scheduler,
    ...pull,
  };
}

// Create a test instance with a stable context
export function createTestInstance() {
  const opts = createDefaultContext();
  const { consumer, propagate } = opts;

  // Create factories with deps
  const signal = createSignalFactory({
    graphEdges: opts,
    propagate,
  });

  const computed = createComputedFactory({
    consumer: opts.consumer,
    trackDependency: opts.trackDependency,
    pullUpdates: opts.pullUpdates,
    track: opts.track,
    shallowPropagate: opts.shallowPropagate,
  });

  const effect = createEffectFactory({
    track: opts.track,
    dispose: opts.dispose,
  });

  const subscribe = createSubscribeFactory({
    track: opts.track,
    dispose: opts.dispose,
  });

  // Batch function
  function batch<T>(fn: () => T): T {
    opts.startBatch();
    try {
      return fn();
    } finally {
      opts.endBatch();
    }
  }

  // Reset function for test cleanup
  const resetGlobalState = () => {
    consumer.active = null;
    // Can't reset batch from outside anymore - tests should use endBatch
  };

  return {
    signal,
    computed,
    effect,
    batch,
    subscribe,

    // Context access for testing
    setCurrentConsumer: (consumerNode: ConsumerNode | null) => {
      consumer.active = consumerNode;
    },
    getCurrentConsumer: () => consumer.active,
    resetGlobalState,

    // Raw access for advanced testing
    consumer,
  };
}

// Create default test instance for backward compatibility
const defaultInstance = createTestInstance();

// Export all functions from default instance
export const signal = <T>(value: T): SignalFunction<T> =>
  defaultInstance.signal(value);

export const computed = <T>(fn: () => T): ComputedFunction<T> =>
  defaultInstance.computed(fn);

export const effect = (fn: () => void | (() => void)): (() => void) =>
  defaultInstance.effect(fn);

export const batch = <T>(fn: () => T): T => defaultInstance.batch(fn);

export const subscribe = <T>(
  fn: () => T,
  cb: SubscribeCallback<T>
): (() => void) => defaultInstance.subscribe(fn, cb);

// Context control exports
export const setCurrentConsumer = (consumer: ConsumerNode | null) =>
  defaultInstance.setCurrentConsumer(consumer);
export const getCurrentConsumer = () => defaultInstance.getCurrentConsumer();

// Global state reset
export function resetGlobalState() {
  defaultInstance.resetGlobalState();
}

// Export the consumer with getters for backward compatibility
export const activeContext = {
  get consumerScope() {
    return defaultInstance.consumer.active;
  },
  set consumerScope(v: ConsumerNode | null) {
    defaultInstance.consumer.active = v;
  },
};

// Export the instance itself for tests that need direct access
export { defaultInstance };
