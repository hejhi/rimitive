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
import type { ProducerNode, Dependency } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { GlobalContext } from './context';
import { CONSTANTS } from './constants';
import { GraphEdges } from './helpers/graph-edges';

const { CLEAN, PRODUCER, DIRTY } = CONSTANTS;

// Predefined status combinations for signal nodes
const SIGNAL_CLEAN = PRODUCER | CLEAN;
const SIGNAL_DIRTY = PRODUCER | DIRTY;

export interface SignalFunction<T = unknown> {
  (): T;                    // Read operation (monomorphic)
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

export type SignalOpts = {
  ctx: GlobalContext;
  trackDependency: GraphEdges['trackDependency'];
  propagate: (subscribers: Dependency) => void;
};

// Re-export types needed for type inference
export type { GlobalContext } from './context';
export type { GraphEdges } from './helpers/graph-edges';

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
      subscribers: undefined,
      subscribersTail: undefined,
      status: SIGNAL_CLEAN,
    };

    // Direct function declaration for better optimization
    function signal(value?: T): T | void {
      // Read path - track dependency inline
      if (!arguments.length) {
        const consumer = ctx.consumerScope;
        if (consumer) trackDependency(node, consumer);
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

  return {
    name: 'signal',
    method: createSignal,
  };
}
