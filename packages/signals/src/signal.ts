/**
 * ALGORITHM: Push-Pull Reactive Signal Implementation
 * 
 * This module implements the core Signal primitive using a push-pull algorithm:
 * 
 * PUSH PHASE (Write):
 * - When a signal's value changes, it traverses its dependency graph
 * - Marks all transitively dependent nodes as "possibly stale" (INVALIDATED)
 * - Schedules effects for execution after the current batch
 * 
 * PULL PHASE (Read):
 * - When a computed/effect reads a signal, it establishes a dependency edge
 * - The edge tracks version numbers for efficient cache invalidation
 * - This enables automatic dependency discovery during execution
 */
import type { ProducerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { CONSTANTS } from './constants';
import { GraphEdges } from './helpers/graph-edges';
import { PushPropagator } from './helpers/push-propagator';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

export interface SignalFunction<T = unknown> {
  (): T;                    // Read operation (monomorphic)
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

export type SignalOpts = {
  ctx: GlobalContext;
  graphEdges: GraphEdges;
  push: PushPropagator;
  nodeScheduler?: { flush: () => void; isInBatch: () => boolean };
};

interface SignalNode<T> extends ProducerNode {
  __type: 'signal';
  value: T;
}

export function createSignalFactory(
  opts: SignalOpts
): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    graphEdges: { trackDependency },
    push: { pushUpdates },
    ctx,
    nodeScheduler,
  } = opts;

  function createSignal<T>(initialValue: T): SignalFunction<T> {
    const node: SignalNode<T> = {
      __type: 'signal',
      value: initialValue,
      subscribers: undefined,
      subscribersTail: undefined,
      status: STATUS_CLEAN,
    };

    // Direct function declaration for better optimization
    function signal(value?: T): T | void {
      // Read path - track dependency inline
      if (!arguments.length) {
        const consumer = ctx.currentConsumer;
        if (consumer) trackDependency(node, consumer);
        return node.value;
      }

      // Skip if unchanged
      if (node.value === value) {
        if (node.status === STATUS_DIRTY) node.status = STATUS_CLEAN;
        return;
      }

      node.value = value!;

      const subs = node.subscribers;
      // Early exit if no subscribers
      if (!subs) return;

      // Mark dirty and propagate
      node.status = STATUS_DIRTY;
      pushUpdates(subs);

      // Flush queue if not in batch
      if (nodeScheduler && !nodeScheduler.isInBatch()) {
        nodeScheduler.flush();
      }
    }

    // Direct property assignment
    signal.peek = () => node.value;

    return signal as SignalFunction<T>;
  }

  return {
    name: 'signal',
    method: createSignal,
  };
}
