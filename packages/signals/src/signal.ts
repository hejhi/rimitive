import type { ProducerNode, Dependency, Writable } from './types';
import type { InstrumentationContext, SourceLocation } from '@rimitive/core';
import { defineModule, getCallerLocationFull } from '@rimitive/core';
import { CONSTANTS } from './constants';
import { GraphEdgesModule, type GraphEdges } from './deps/graph-edges';
import { SchedulerModule, type Scheduler } from './deps/scheduler';

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
 * Dependencies required by the Signal module.
 * @internal
 */
export type SignalDeps = {
  graphEdges: GraphEdges;
  propagate: (subscribers: Dependency) => void;
};

// Re-export types needed for type inference
export type { Consumer, GraphEdges } from './deps/graph-edges';

type SignalNode<T> = ProducerNode & {
  __type: 'signal';
  value: T;
};

/**
 * The signal factory function type
 */
export type SignalFactory = <T>(value: T) => SignalFunction<T>;

/**
 * Create a signal factory with the given dependencies.
 */
export function createSignalFactory(deps: SignalDeps): SignalFactory {
  const { graphEdges, propagate } = deps;
  const { consumer, trackDependency } = graphEdges;

  return function createSignal<T>(initialValue: T): SignalFunction<T> {
    const node: SignalNode<T> = {
      __type: 'signal',
      value: initialValue,
      subscribers: undefined,
      subscribersTail: undefined,
      status: SIGNAL_CLEAN,
    };

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

      // Mark signal as DIRTY before propagating
      // graph-traversal checks producer's DIRTY bit to mark consumers as DIRTY
      // This allows consumers to skip pullUpdates on read
      node.status = SIGNAL_DIRTY;
      propagate(subs);
    }

    signal.peek = () => node.value;

    return signal as SignalFunction<T>;
  };
}

/**
 * Signal module - provides the reactive signal primitive.
 *
 * Dependencies:
 * - graphEdges: Provides consumer tracking and dependency tracking
 * - scheduler: Provides propagate function for notifying subscribers
 */
export const SignalModule = defineModule({
  name: 'signal',
  dependencies: [GraphEdgesModule, SchedulerModule],
  create: ({
    graphEdges,
    scheduler,
  }: {
    graphEdges: GraphEdges;
    scheduler: Scheduler;
  }): SignalFactory => {
    return createSignalFactory({ graphEdges, propagate: scheduler.propagate });
  },
  instrument(
    impl: SignalFactory,
    instr: InstrumentationContext
  ): SignalFactory {
    return <T>(initialValue: T): SignalFunction<T> => {
      const location = getCallerLocationFull();
      const sig = impl(initialValue);
      const name = location?.display ?? `Signal<${typeof initialValue}>`;
      const { id } = instr.register(sig, 'signal', name);

      // Build source location data for events
      const sourceLocation: SourceLocation | undefined = location;

      function instrumentedSignal(value?: T): T | void {
        if (!arguments.length) {
          const currentValue = sig();
          instr.emit({
            type: 'signal:read',
            timestamp: Date.now(),
            data: { signalId: id, name, value: currentValue, sourceLocation },
          });
          return currentValue;
        }

        const oldValue = sig.peek();
        instr.emit({
          type: 'signal:write',
          timestamp: Date.now(),
          data: { signalId: id, name, oldValue, newValue: value, sourceLocation },
        });
        sig(value!);
      }

      instrumentedSignal.peek = () => sig.peek();

      return instrumentedSignal as SignalFunction<T>;
    };
  },
});
