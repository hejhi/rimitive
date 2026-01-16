import { CONSTANTS } from './constants';
import { Dependency, DerivedNode } from './types';
import { defineModule, getCallerLocationFull, type InstrumentationContext, type SourceLocation } from '@rimitive/core';
import {
  GraphEdgesModule,
  type GraphEdges,
  type Consumer,
} from './deps/graph-edges';
import {
  PullPropagatorModule,
  type PullPropagator,
} from './deps/pull-propagator';

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
 * Wired automatically by modules - only needed for custom compositions.
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
 * Computed factory function type - creates computed values from computation functions
 */
export type ComputedFactory = <T>(compute: () => T) => ComputedFunction<T>;

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
 * Create a computed factory function.
 *
 * Computeds are derived values that automatically track their dependencies
 * and recompute lazily when those dependencies change.
 *
 * @example Basic composition
 * ```ts
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule, ComputedModule);
 * const { signal, computed } = svc;
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
export function createComputedFactory({
  consumer,
  trackDependency,
  pullUpdates,
  track,
  shallowPropagate,
}: ComputedDeps): ComputedFactory {
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

  function computed<T>(compute: () => T): ComputedFunction<T> {
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
    const computedFn = computedImpl.bind(
      node
    ) as unknown as ComputedFunction<T>;
    computedFn.peek = peekImpl.bind(node) as () => T;

    return computedFn;
  }

  return computed;
}

/**
 * ComputedModule - provides the computed primitive for reactive computations.
 * Depends on GraphEdges for dependency tracking and PullPropagator for update propagation.
 */
export const ComputedModule = defineModule({
  name: 'computed',
  dependencies: [GraphEdgesModule, PullPropagatorModule],
  create: ({ graphEdges, pullPropagator }) =>
    createComputedFactory({
      consumer: graphEdges.consumer,
      trackDependency: graphEdges.trackDependency,
      pullUpdates: pullPropagator.pullUpdates,
      track: graphEdges.track,
      shallowPropagate: pullPropagator.shallowPropagate,
    }),
  instrument(
    impl: ComputedFactory,
    instr: InstrumentationContext
  ): ComputedFactory {
    return <T>(compute: () => T): ComputedFunction<T> => {
      const location = getCallerLocationFull();
      const comp = impl(compute);
      const name = location?.display ?? 'Computed';
      const { id } = instr.register(comp, 'computed', name);

      const sourceLocation: SourceLocation | undefined = location;

      function instrumentedComputed(): T {
        instr.emit({
          type: 'computed:read',
          timestamp: Date.now(),
          data: { computedId: id, name, sourceLocation },
        });

        const value = comp();

        instr.emit({
          type: 'computed:value',
          timestamp: Date.now(),
          data: { computedId: id, name, value, sourceLocation },
        });

        return value;
      }

      instrumentedComputed.peek = () => comp.peek();

      return instrumentedComputed as ComputedFunction<T>;
    };
  },
});
