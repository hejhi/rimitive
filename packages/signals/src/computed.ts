import { CONSTANTS } from './constants';
import { Dependency, DerivedNode } from './types';
import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { GraphEdges, Consumer } from './deps/graph-edges';
import { PullPropagator } from './deps/pull-propagator';

/**
 * Computed function type - a callable that derives values from other reactives.
 *
 * Computeds are lazy: they only recompute when read and their dependencies have changed.
 * Use `.peek()` to read without tracking dependencies.
 *
 * @example
 * ```ts
 * const count = signal(5);
 * const doubled: ComputedFunction<number> = computed(() => count() * 2);
 *
 * doubled();     // computes: 10
 * doubled();     // cached: 10
 * count(10);     // marks doubled as stale
 * doubled();     // recomputes: 20
 * doubled.peek(); // read without tracking: 20
 * ```
 */
export type ComputedFunction<T = unknown> = {
  (): T;
  peek(): T;
};

/**
 * Dependencies required by the Computed factory.
 * Wired automatically by presets - only needed for custom compositions.
 * @internal
 */
export type ComputedDeps = {
  consumer: Consumer;
  trackDependency: GraphEdges['trackDependency'];
  pullUpdates: PullPropagator['pullUpdates'];
  track: GraphEdges['track'];
  shallowPropagate: (sub: Dependency) => void;
};

/**
 * Options for customizing Computed behavior.
 *
 * @example Adding instrumentation
 * ```ts
 * const computedService = Computed({
 *   instrument(impl, instr, ctx) {
 *     return (compute) => {
 *       const c = impl(compute);
 *       instr.register(c, 'computed');
 *       return c;
 *     };
 *   },
 * });
 * ```
 */
export type ComputedOptions = {
  /** Custom instrumentation wrapper for debugging/profiling */
  instrument?: (
    impl: <T>(compute: () => T) => ComputedFunction<T>,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => <T>(compute: () => T) => ComputedFunction<T>;
};

// Re-export types for proper type inference
export type { Consumer } from './deps/graph-edges';
export type { GraphEdges } from './deps/graph-edges';
export type { PullPropagator } from './deps/pull-propagator';

// Internal computed state that gets bound to the function
type ComputedNode<T> = DerivedNode<T> & {
  __type: 'computed';
  value: T;
};

const { PENDING, DIRTY, PRODUCER, CONSUMER, CLEAN } = CONSTANTS;

const COMPUTED = PRODUCER | CONSUMER;
// Predefined status combinations for computed nodes
const COMPUTED_CLEAN = COMPUTED | CLEAN;
const COMPUTED_DIRTY = COMPUTED | DIRTY;

/**
 * ServiceDefinition for the computed primitive.
 * This is what gets composed into a service context.
 */
export type ComputedFactory = ServiceDefinition<
  'computed',
  <T>(compute: () => T) => ComputedFunction<T>
>;

/**
 * The instantiable service returned by Computed().
 *
 * @example
 * ```ts
 * import { Computed, type ComputedService } from '@lattice/signals/computed';
 *
 * const computedService: ComputedService = Computed();
 * const factory = computedService.create(deps); // ComputedFactory
 * ```
 */
export type ComputedService = ReturnType<typeof Computed>;

/**
 * Create a Computed service factory.
 *
 * Computeds are derived values that automatically track their dependencies
 * and recompute lazily when those dependencies change.
 *
 * **Most users should use the preset instead:**
 * ```ts
 * import { createSignals } from '@lattice/signals/presets/core';
 * const { computed } = createSignals()();
 * ```
 *
 * @example Basic derived value
 * ```ts
 * const { signal, computed } = createSignals()();
 *
 * const firstName = signal('Alice');
 * const lastName = signal('Smith');
 * const fullName = computed(() => `${firstName()} ${lastName()}`);
 *
 * fullName(); // 'Alice Smith'
 * lastName('Jones');
 * fullName(); // 'Alice Jones' (recomputed)
 * fullName(); // 'Alice Jones' (cached)
 * ```
 *
 * @example Diamond dependencies
 * ```ts
 * //      A
 * //     / \
 * //    B   C
 * //     \ /
 * //      D
 * const a = signal(1);
 * const b = computed(() => a() * 2);
 * const c = computed(() => a() * 3);
 * const d = computed(() => b() + c());
 *
 * d(); // 5 (each node computed once)
 * ```
 *
 * @example Dynamic dependencies
 * ```ts
 * const showDetails = signal(false);
 * const summary = signal('Short');
 * const details = signal('Long description...');
 *
 * // Dependencies change based on condition
 * const display = computed(() =>
 *   showDetails() ? details() : summary()
 * );
 * ```
 */
export const Computed = defineService(
  ({
    consumer,
    trackDependency,
    pullUpdates,
    track,
    shallowPropagate,
  }: ComputedDeps) =>
    ({ instrument }: ComputedOptions = {}): ComputedFactory => {
      // Shared computed function - uses `this` binding
      function computedImpl<T>(this: ComputedNode<T>): T {
        const status = this.status;
        const isPending = status & PENDING;

        // Check if we need to pull updates
        update: if (status & DIRTY || (isPending && pullUpdates(this))) {
          // Recompute the value
          const prev = this.value;
          this.value = track(this, this.compute);

          // Propagate if value changed and there are multiple subscribers
          if (prev === this.value) break update;

          const subs = this.subscribers;
          if (subs && subs.nextConsumer !== undefined) shallowPropagate(subs);
        } else if (isPending) this.status = COMPUTED_CLEAN;

        // Track dependency AFTER pulling updates
        const activeConsumer = consumer.active;
        if (activeConsumer) trackDependency(this, activeConsumer);

        return this.value;
      }

      // Shared peek function - uses `this` binding
      function peekImpl<T>(this: ComputedNode<T>): T {
        // Save and clear consumer to prevent tracking
        const prevConsumer = consumer.active;
        consumer.active = null;

        try {
          const status = this.status;
          const isPending = status & PENDING;

          if (status & DIRTY || (isPending && pullUpdates(this))) {
            this.value = track(this, this.compute);
          } else if (isPending) this.status = COMPUTED_CLEAN;

          return this.value;
        } finally {
          consumer.active = prevConsumer;
        }
      }

      function createComputed<T>(compute: () => T): ComputedFunction<T> {
        const node: ComputedNode<T> = {
          __type: 'computed' as const,
          value: undefined as T,
          subscribers: undefined,
          subscribersTail: undefined,
          dependencies: undefined,
          dependencyTail: undefined,
          status: COMPUTED_DIRTY,
          trackingVersion: 0,
          compute,
        };

        // Bind shared functions to this node
        const computed = computedImpl.bind(
          node
        ) as unknown as ComputedFunction<T>;
        computed.peek = peekImpl.bind(node) as () => T;

        return computed;
      }

      return {
        name: 'computed',
        impl: createComputed,
        ...(instrument && { instrument }),
      };
    }
);
