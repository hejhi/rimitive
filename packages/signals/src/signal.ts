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
import { GraphTraversal } from './helpers/graph-traversal';

const { STATUS_DIRTY, STATUS_CLEAN } = CONSTANTS;

export interface SignalFunction<T = unknown> {
  (): T;                    // Read operation (monomorphic)
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

export type SignalOpts = {
  ctx: GlobalContext;
  trackDependency: GraphEdges['trackDependency'];
  propagate: GraphTraversal['propagate'];
};

// Re-export types needed for type inference
export type { GlobalContext } from './context';
export type { GraphEdges } from './helpers/graph-edges';
export type { GraphTraversal } from './helpers/graph-traversal';

interface SignalNode<T> extends ProducerNode {
  __type: 'signal';
  value: T;
}

// Export the factory return type for better type inference
export type SignalFactory = LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>>;

export function createSignalFactory(
  opts: SignalOpts
): SignalFactory {
  const {
    trackDependency,
    propagate,
    ctx,
  } = opts;

  function createSignal<T>(initialValue: T): SignalFunction<T> {
    const node: SignalNode<T> = {
      __type: 'signal',
      value: initialValue,
      version: 0,
      subscribers: undefined,
      subscribersTail: undefined,
      status: STATUS_CLEAN,
    };

    // Direct function declaration for better optimization
    function signal(value?: T): T | void {
      // Read path - track dependency inline
      if (!arguments.length) {
        const consumer = ctx.currentConsumer;
        if (consumer) {
          // Use triggering version if available (during pull phase)
          const triggeringVersion = ctx.triggeringVersions?.get(node);
          trackDependency(node, consumer, triggeringVersion);
        }
        return node.value;
      }

      // Skip if unchanged
      if (node.value === value) {
        if (node.status === STATUS_DIRTY) node.status = STATUS_CLEAN;
        return;
      }

      node.value = value!;
      // NO version increment here - that happens during pull phase

      const subs = node.subscribers;
      // Early exit if no subscribers
      if (!subs) return;

      // Mark dirty and propagate (scheduler handles flushing automatically)
      node.status = STATUS_DIRTY;
      propagate(subs);
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
