/**
 * Core Signals Preset
 *
 * Pre-configured bundle of signal primitives with all necessary deps wired up.
 * This is the recommended way to use Lattice signals - it eliminates the boilerplate
 * of manually creating and wiring the reactive graph infrastructure.
 *
 * @example Quick start
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const { signal, computed, effect, batch } = createSignals()();
 *
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 *
 * effect(() => {
 *   console.log(`Count: ${count()}, Doubled: ${doubled()}`);
 * });
 *
 * count(5); // logs: "Count: 5, Doubled: 10"
 * ```
 *
 * @example With batching
 * ```ts
 * const { signal, effect, batch } = createSignals()();
 *
 * const a = signal(0);
 * const b = signal(0);
 *
 * effect(() => console.log(a() + b()));
 *
 * batch(() => {
 *   a(1);
 *   b(2);
 * }); // Effect runs once, logs: 3
 * ```
 *
 * @module
 */

import { createGraphEdges, type GraphEdges } from '../deps/graph-edges';
import {
  createGraphTraversal,
  type GraphTraversal,
} from '../deps/graph-traversal';
import {
  createPullPropagator,
  type PullPropagator,
} from '../deps/pull-propagator';
import { createScheduler, type Scheduler } from '../deps/scheduler';
import { createUntracked } from '../untrack';
import { createSignalFactory, type SignalFactory } from '../signal';
import { createComputedFactory, type ComputedFactory } from '../computed';
import { createEffectFactory, type EffectFactory } from '../effect';
import { createSubscribeFactory, type SubscribeFunction } from '../subscribe';
import type { Use } from '@lattice/lattice';

/**
 * Combined deps type - all reactive graph operations.
 *
 * This is the dependency type required by signal primitives.
 * Created by `deps()` and passed to factory functions.
 *
 * @internal Typically you don't need to use this directly - use `createSignals()()`.
 */
export type Helpers = {
  untrack: <T>(fn: () => T) => T;
} & GraphEdges &
  GraphTraversal &
  PullPropagator &
  Scheduler;

// Re-export user-facing types
export type { SignalFactory, SignalFunction } from '../signal';
export type { ComputedFactory, ComputedFunction } from '../computed';
export type { EffectFactory } from '../effect';
export type { BatchFactory } from '../batch';
export type {
  SubscribeFunction,
  SubscribeCallback,
  UnsubscribeFunction,
} from '../subscribe';

/**
 * Create all the reactive graph infrastructure.
 * This wires up the dependencies between graph components.
 */
export function deps(): Helpers {
  const edges = createGraphEdges();
  const untrack = createUntracked({ consumer: edges.consumer });
  const traversal = createGraphTraversal();
  const pull = createPullPropagator({ track: edges.track });
  const scheduler = createScheduler({
    detachAll: edges.detachAll,
    withVisitor: traversal.withVisitor,
  });

  return {
    untrack,
    ...edges,
    ...traversal,
    ...pull,
    ...scheduler,
  };
}

/**
 * The type of the signals service returned by `createSignals()()`.
 *
 * Contains all signal primitives: `signal`, `computed`, `effect`, `batch`, `subscribe`,
 * plus a `dispose()` method for cleanup.
 *
 * @example Type annotation
 * ```ts
 * import { createSignals, type SignalsSvc } from '@lattice/signals/presets/core';
 *
 * function initApp(svc: SignalsSvc) {
 *   const count = svc.signal(0);
 *   // ...
 * }
 *
 * const svc = createSignals()();
 * initApp(svc);
 * ```
 */
export type SignalsSvc = {
  signal: SignalFactory;
  computed: ComputedFactory;
  effect: EffectFactory;
  batch: <T>(fn: () => T) => T;
  subscribe: SubscribeFunction;
  dispose(): void;
};

/**
 * Create a fully-configured signals service.
 *
 * This is the main entry point for using Lattice signals. Returns a service
 * with all primitives wired up and ready to use.
 *
 * @example Basic usage
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 *
 * const { signal, computed, effect, batch, subscribe } = createSignals()();
 *
 * // Create reactive state
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 *
 * // React to changes
 * effect(() => {
 *   console.log(`Count: ${count()}, Doubled: ${doubled()}`);
 * });
 *
 * // Update state
 * count(5); // Effect runs, logs: "Count: 5, Doubled: 10"
 * ```
 *
 * @example With cleanup
 * ```ts
 * const svc = createSignals()();
 *
 * // ... use signals ...
 *
 * // Clean up when done (e.g., in tests or when unmounting)
 * svc.dispose();
 * ```
 *
 * @example Subscribing to changes
 * ```ts
 * const { signal, subscribe } = createSignals()();
 *
 * const name = signal('Alice');
 *
 * // Subscribe only re-runs when the tracked value changes
 * const unsubscribe = subscribe(
 *   () => name(),
 *   (value) => console.log(`Name changed to: ${value}`)
 * );
 *
 * name('Bob');   // logs: "Name changed to: Bob"
 * name('Bob');   // no log (value unchanged)
 * unsubscribe(); // stop listening
 * ```
 *
 * @returns A signals service with all primitives and a dispose method
 */
export function createSignals(): Use<SignalsSvc> {
  // Create all the reactive graph infrastructure
  const helpers = deps();

  // Create all the signal factories
  const signal = createSignalFactory({
    graphEdges: helpers,
    propagate: helpers.propagate,
  });

  const computed = createComputedFactory({
    consumer: helpers.consumer,
    trackDependency: helpers.trackDependency,
    pullUpdates: helpers.pullUpdates,
    track: helpers.track,
    shallowPropagate: helpers.shallowPropagate,
  });

  const effect = createEffectFactory({
    track: helpers.track,
    dispose: helpers.dispose,
  });

  const subscribe = createSubscribeFactory({
    track: helpers.track,
    dispose: helpers.dispose,
  });

  // Batch function
  function batch<T>(fn: () => T): T {
    helpers.startBatch();
    try {
      return fn();
    } finally {
      helpers.endBatch();
    }
  }

  // Build the service object
  const svc: SignalsSvc = {
    signal,
    computed,
    effect,
    batch,
    subscribe,
    dispose: () => {
      // Cleanup logic could go here
    },
  };

  // Return a Use function that provides access to the service
  const use = <TResult>(
    callback?: (ctx: SignalsSvc) => TResult
  ): SignalsSvc | TResult => {
    if (callback === undefined) {
      return svc;
    }
    return callback(svc);
  };

  return use as Use<SignalsSvc>;
}
