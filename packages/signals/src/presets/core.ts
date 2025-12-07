/**
 * Core Signals Preset
 *
 * Pre-configured bundle of signal primitives with all necessary helpers wired up.
 * This is the recommended way to use Lattice signals - it eliminates the boilerplate
 * of manually creating and wiring the reactive graph infrastructure.
 *
 * @example Quick start
 * ```ts
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 *
 * const { signal, computed, effect, batch } = createSignalsSvc();
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
 * const { signal, effect, batch } = createSignalsSvc();
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

import { Signal } from '../signal';
import { Computed } from '../computed';
import { Effect } from '../effect';
import { Batch } from '../batch';
import { Subscribe } from '../subscribe';
import { createGraphEdges, type GraphEdges } from '../helpers/graph-edges';
import {
  createGraphTraversal,
  type GraphTraversal,
} from '../helpers/graph-traversal';
import {
  createPullPropagator,
  type PullPropagator,
} from '../helpers/pull-propagator';
import { createScheduler, type Scheduler } from '../helpers/scheduler';
import { createUntracked } from '../untrack';
import { compose, type Svc, type Use } from '@lattice/lattice';
import type { Dependency } from '../types';

/**
 * Combined helpers type - all reactive graph operations.
 *
 * This is the dependency type required by signal primitives.
 * Created by `createHelpers()` and passed to `compose()`.
 *
 * @internal Typically you don't need to use this directly - use `createSignalsSvc()`.
 */
export type Helpers = {
  untrack: <T>(fn: () => T) => T;
  propagate: (subscribers: Dependency) => void;
} & GraphEdges &
  GraphTraversal &
  PullPropagator &
  Omit<Scheduler, 'withPropagate'>;

// Re-export user-facing types
// Note: Internal dependency types (*Deps) are intentionally not exported.
// They are wired automatically by presets and helpers.

// Signal types
export type {
  SignalFactory,
  SignalService,
  SignalOptions,
  SignalFunction,
} from '../signal';

// Computed types
export type {
  ComputedFactory,
  ComputedService,
  ComputedOptions,
  ComputedFunction,
} from '../computed';

// Effect types
export type { EffectFactory, EffectService, EffectOptions } from '../effect';

// Batch types
export type { BatchFactory, BatchService, BatchOptions } from '../batch';

// Subscribe types
export type {
  SubscribeFactory,
  SubscribeService,
  SubscribeOptions,
  SubscribeFunction,
  SubscribeCallback,
  UnsubscribeFunction,
} from '../subscribe';

// Lattice composition types
export type { DefinedService } from '@lattice/lattice';

import type { SignalService } from '../signal';
import type { ComputedService } from '../computed';
import type { EffectService } from '../effect';
import type { BatchService } from '../batch';
import type { SubscribeService } from '../subscribe';

/**
 * Create the reactive graph infrastructure (helpers).
 *
 * This wires together all the low-level machinery: dependency tracking,
 * graph traversal, pull-based updates, and effect scheduling.
 *
 * Most users should use `createSignalsSvc()` instead, which calls this internally.
 *
 * @example Manual composition (advanced)
 * ```ts
 * import { defaultExtensions, createHelpers } from '@lattice/signals/presets/core';
 * import { compose } from '@lattice/lattice';
 *
 * const helpers = createHelpers();
 * const svc = compose(defaultExtensions(), helpers);
 *
 * // Now svc.signal, svc.computed, etc. are available
 * ```
 *
 * @returns The helpers object containing all graph operations
 */
export function createHelpers(): Helpers {
  const edges = createGraphEdges();
  const untrack = createUntracked({ consumer: edges.consumer });
  const traversal = createGraphTraversal();
  const pull = createPullPropagator({ track: edges.track });
  const { withPropagate, ...scheduler } = createScheduler({
    detachAll: edges.detachAll,
  });

  return {
    untrack,
    ...edges,
    ...traversal,
    ...pull,
    ...scheduler,
    propagate: withPropagate(traversal.withVisitor),
  };
}

/**
 * The type of the signals service returned by `createSignalsSvc()`.
 *
 * Contains all signal primitives: `signal`, `computed`, `effect`, `batch`, `subscribe`,
 * plus a `dispose()` method for cleanup.
 *
 * @example Type annotation
 * ```ts
 * import { createSignalsSvc, type SignalsSvc } from '@lattice/signals/presets/core';
 *
 * function initApp(svc: SignalsSvc) {
 *   const count = svc.signal(0);
 *   // ...
 * }
 *
 * const svc = createSignalsSvc();
 * initApp(svc);
 * ```
 */
export type SignalsSvc = Svc<{
  signal: SignalService;
  computed: ComputedService;
  effect: EffectService;
  batch: BatchService;
  subscribe: SubscribeService;
}>;

/**
 * Create a fully-configured signals service.
 *
 * This is the main entry point for using Lattice signals. Returns a service
 * with all primitives wired up and ready to use.
 *
 * @example Basic usage
 * ```ts
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 *
 * const { signal, computed, effect, batch, subscribe } = createSignalsSvc();
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
 * const svc = createSignalsSvc();
 *
 * // ... use signals ...
 *
 * // Clean up when done (e.g., in tests or when unmounting)
 * svc.dispose();
 * ```
 *
 * @example Subscribing to changes
 * ```ts
 * const { signal, subscribe } = createSignalsSvc();
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
export function createSignalsSvc(): Use<SignalsSvc> {
  return compose(
    {
      signal: Signal(),
      computed: Computed(),
      effect: Effect(),
      batch: Batch(),
      subscribe: Subscribe(),
    },
    createHelpers()
  );
}
