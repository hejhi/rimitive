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

const { STATUS_DIRTY, MASK_STATUS } = CONSTANTS;

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

interface SignalNode<T> extends ProducerNode {
  __type: 'signal';
  value: T;
}

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    graphEdges: { trackDependency },
    pushPropagator: { pushUpdates },
    nodeScheduler: { flush },
  } = ctx;
  
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    const node: SignalNode<T> = {
      __type: 'signal',
      value: initialValue,
      subscribers: undefined,
      subscribersTail: undefined,
      flags: 0,
    };

    
    const signal = function(value?: T): T | undefined {
      if (arguments.length) {
        const flags = node.flags;
        const status = flags & MASK_STATUS;
        
        if (node.value === value) {
          // Clear dirty status if value unchanged
          if (status === STATUS_DIRTY) node.flags = 0;
          return;
        }
        
        node.value = value!;

        const subscribers = node.subscribers;

        if (!subscribers) return;

        // Mark as dirty - value has changed
        node.flags = STATUS_DIRTY;

        // Invalidate and propagate
        // The pushUpdates function will skip stale dependencies automatically
        pushUpdates(subscribers);

        // Batch check and flush
        if (!ctx.batchDepth) flush();
        return;
      }

      const consumer = ctx.currentConsumer;
      if (consumer) trackDependency(node, consumer);
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
