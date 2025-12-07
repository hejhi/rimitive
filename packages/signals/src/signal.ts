import type { ProducerNode, Dependency, Writable } from './types';
import type {
  ServiceDefinition,
  InstrumentationContext,
  ServiceContext,
} from '@lattice/lattice';
import { defineService } from '@lattice/lattice';
import { CONSTANTS } from './constants';
import { GraphEdges, Consumer } from './deps/graph-edges';

const { CLEAN, PRODUCER, DIRTY } = CONSTANTS;

// Predefined status combinations for signal nodes
const SIGNAL_CLEAN = PRODUCER | CLEAN;
const SIGNAL_DIRTY = PRODUCER | DIRTY;

/**
 * Signal function type - a callable that acts as both getter and setter.
 *
 * Call with no arguments to read, call with a value to write.
 * Use `.peek()` to read without tracking dependencies.
 *
 * @example
 * ```ts
 * const count: SignalFunction<number> = signal(0);
 *
 * count();      // read: 0
 * count(5);     // write
 * count();      // read: 5
 * count.peek(); // read without tracking: 5
 * ```
 */
export type SignalFunction<T> = Writable<T> & { peek(): T };

/**
 * Dependencies required by the Signal factory.
 * Wired automatically by presets - only needed for custom compositions.
 * @internal
 */
export type SignalDeps = {
  consumer: Consumer;
  trackDependency: GraphEdges['trackDependency'];
  propagate: (subscribers: Dependency) => void;
};

/**
 * Options for customizing Signal behavior.
 *
 * @example Adding instrumentation
 * ```ts
 * const signalService = Signal({
 *   instrument(impl, instr, ctx) {
 *     return (value) => {
 *       const sig = impl(value);
 *       instr.register(sig, 'signal');
 *       return sig;
 *     };
 *   },
 * });
 * ```
 */
export type SignalOptions = {
  /** Custom instrumentation wrapper for debugging/profiling */
  instrument?: (
    impl: <T>(value: T) => SignalFunction<T>,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ) => <T>(value: T) => SignalFunction<T>;
};

// Re-export types needed for type inference
export type { Consumer } from './deps/graph-edges';
export type { GraphEdges } from './deps/graph-edges';

type SignalNode<T> = ProducerNode & {
  __type: 'signal';
  value: T;
};

/**
 * ServiceDefinition for the signal primitive.
 * This is what gets composed into a service context.
 */
export type SignalFactory = ServiceDefinition<
  'signal',
  <T>(value: T) => SignalFunction<T>
>;

/**
 * The instantiable service returned by Signal().
 *
 * @example
 * ```ts
 * import { Signal, type SignalService } from '@lattice/signals/signal';
 *
 * const signalService: SignalService = Signal();
 * const factory = signalService.create(deps); // SignalFactory
 * ```
 */
export type SignalService = ReturnType<typeof Signal>;

/**
 * Create a Signal service factory.
 *
 * Signals are reactive containers that notify subscribers when their value changes.
 * They are the foundation of the reactivity system.
 *
 * **Most users should use the preset instead:**
 * ```ts
 * import { createSignalsSvc } from '@lattice/signals/presets/core';
 * const { signal } = createSignalsSvc();
 * ```
 *
 * @example Basic usage (via preset)
 * ```ts
 * const { signal } = createSignalsSvc();
 *
 * const count = signal(0);
 * count();     // read: 0
 * count(1);    // write
 * count();     // read: 1
 * ```
 *
 * @example Reading without tracking
 * ```ts
 * const name = signal('Alice');
 *
 * effect(() => {
 *   // This creates a dependency
 *   console.log(name());
 * });
 *
 * // Read without creating dependency
 * const current = name.peek();
 * ```
 *
 * @example Custom composition (advanced)
 * ```ts
 * import { Signal } from '@lattice/signals/signal';
 * import { compose } from '@lattice/lattice';
 *
 * const ctx = compose(
 *   { signal: Signal() },
 *   myCustomHelpers
 * );
 * ```
 */
export const Signal = defineService(
  ({ trackDependency, propagate, consumer }: SignalDeps) =>
    ({ instrument }: SignalOptions = {}): SignalFactory => {
      function createSignal<T>(initialValue: T): SignalFunction<T> {
        const node: SignalNode<T> = {
          __type: 'signal',
          value: initialValue,
          subscribers: undefined,
          subscribersTail: undefined,
          status: SIGNAL_CLEAN,
        };

        // Direct function declaration for better optimization
        function signal(value?: T): T | void {
          // Read path - track dependency inline
          if (!arguments.length) {
            const activeConsumer = consumer.active;
            if (activeConsumer) trackDependency(node, activeConsumer);
            return node.value;
          }

          // Skip if unchanged
          if (node.value === value) return;

          node.value = value!;

          const subs = node.subscribers;

          // Early exit if no subscribers
          if (!subs) return;

          // Mark dirty and propagate (scheduler handles flushing automatically)
          node.status = SIGNAL_DIRTY;
          propagate(subs);
        }

        // Direct property assignment
        signal.peek = () => node.value;

        return signal as SignalFunction<T>;
      }

      const extension: SignalFactory = {
        name: 'signal',
        impl: createSignal,
        ...(instrument && { instrument }),
      };

      return extension;
    }
);
