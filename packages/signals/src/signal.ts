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
import { NodeScheduler } from './helpers/node-scheduler';

const { HAS_CHANGED } = CONSTANTS;

export interface SignalFunction<T = unknown> {
  (): T;                    // Read operation (monomorphic)
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

export type SignalContext = GlobalContext & {
  graphEdges: GraphEdges;
  pushPropagator: PushPropagator;
  nodeScheduler: NodeScheduler;
};

interface SignalState<T> extends ProducerNode {
  value: T;
}

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    graphEdges: { trackDependency },
    pushPropagator: { pushUpdates },
    nodeScheduler: { flush },
  } = ctx;
  
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    const node: SignalState<T> = {
      __type: 'signal',
      value: initialValue,
      dependents: undefined,
      dependentsTail: undefined,
      flags: 0,
    };

    
    const signal = function(value?: T): T | undefined {
      if (arguments.length) {
        let flags = node.flags;
        const hasChanged = (flags & HAS_CHANGED) !== 0;
        const dependents = node.dependents;

        if (node.value === value!) {
          // Batch flag operation: only write if needed
          if (hasChanged) node.flags = flags & ~HAS_CHANGED;
          return;
        }

        node.value = value!;

        if (!dependents) return;

        // Batch flag operation: single write combining all flag changes
        if (!hasChanged) node.flags = flags | HAS_CHANGED;

        // Invalidate and propagate
        // The pushUpdates function will skip stale dependencies automatically
        pushUpdates(dependents);

        // Batch check and flush
        if (!ctx.batchDepth) flush();
        return;
      }

      const consumer = ctx.currentConsumer;
      if (consumer) trackDependency(node, consumer, ctx.trackingVersion);
      return node.value;
    } as SignalFunction<T>;
    
    signal.peek = () => node.value;
    
    return signal;
  }
  
  return {
    name: 'signal',
    method: createSignal
  };
}

// ALIEN-SIGNALS PATTERN: Export the function-based Signal type
export type Signal<T = unknown> = SignalFunction<T>;

// BACKWARDS COMPATIBILITY: Export interface alias
export type SignalInterface<T = unknown> = SignalFunction<T>;