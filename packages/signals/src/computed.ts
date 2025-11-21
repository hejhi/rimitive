/**
 * ALGORITHM: Lazy Computed Values with Push-Pull Reactivity
 *
 * Computed values are the heart of the reactive system.
 */

import { CONSTANTS } from './constants';
import { Dependency, DerivedNode } from './types';
import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { GraphEdges, Consumer } from './helpers/graph-edges';
import { PullPropagator } from './helpers/pull-propagator';

// Single function interface for both read and peek
// The function also implements ProducerNode and ConsumerNode to expose graph properties
export interface ComputedFunction<T = unknown> {
  (): T;
  peek(): T;
}

export type ComputedOpts = {
  consumer: Consumer;
  trackDependency: GraphEdges['trackDependency'];
  pullUpdates: PullPropagator['pullUpdates'];
  track: GraphEdges['track'];
  shallowPropagate: (sub: Dependency) => void;
};

export type ComputedProps = {
  instrument?: (
    impl: <T>(compute: () => T) => ComputedFunction<T>,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => <T>(compute: () => T) => ComputedFunction<T>;
};

// Re-export types for proper type inference
export type { Consumer } from './helpers/graph-edges';
export type { GraphEdges } from './helpers/graph-edges';
export type { PullPropagator } from './helpers/pull-propagator';

// Internal computed state that gets bound to the function
interface ComputedNode<T> extends DerivedNode<T> {
  __type: 'computed';
  value: T;
}

const { PENDING, DIRTY, PRODUCER, CONSUMER, CLEAN } = CONSTANTS;

const COMPUTED = PRODUCER | CONSUMER;
// Predefined status combinations for computed nodes
const COMPUTED_CLEAN = COMPUTED | CLEAN;
const COMPUTED_DIRTY = COMPUTED | DIRTY;

// Export the factory return type for better type inference
export type ComputedFactory = ServiceDefinition<
  'computed',
  <T>(compute: () => T) => ComputedFunction<T>
>;

export const Computed = defineService(
  ({
    consumer,
    trackDependency,
    pullUpdates,
    track,
    shallowPropagate,
  }: ComputedOpts) =>
    (props?: ComputedProps): ComputedFactory => {
      const { instrument } = props ?? {};

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
