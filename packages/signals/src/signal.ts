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
import { CONSTANTS } from './constants';
import { ProducerNode, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';
import type { GraphWalker } from './helpers/graph-walker';
import type { WorkQueue } from './helpers/work-queue';

const { RUNNING } = CONSTANTS;

// Single function interface for both read and write
// The function also implements ProducerNode to expose graph properties
export interface SignalFunction<T = unknown> extends ProducerNode {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

// Signal state object that gets bound to the function
// This IS the actual signal - no indirection through properties
interface SignalState<T> extends ProducerNode {
  value: T;
}

interface SignalFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  graphWalker: GraphWalker;
  workQueue: WorkQueue;
}

export function createSignalFactory(ctx: SignalFactoryContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    dependencies: { link },
    graphWalker: { dfs },
    workQueue: { enqueue, flush }
  } = ctx;
  
  const notifyNode = (node: ConsumerNode): void => {
    if ('_nextScheduled' in node) enqueue(node as ScheduledNode);
  };
  
  // CLOSURE PATTERN: Create signal with closure-captured state for better V8 optimization
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    // State object captured in closure - no binding needed
    const state: SignalState<T> = {
      __type: 'signal',
      value: initialValue,
      _out: undefined,
      _outTail: undefined,
      _dirty: false,
    };
    
    // Signal function using closure instead of bound this
    const signal = ((...args: [] | [T]): T | void => {
      // WRITE
      if (args.length) {
        const newValue = args[0];
        
        if (state.value === newValue) return;
        
        // Update value and set dirty flag (no arithmetic in hot path!)
        state.value = newValue;
        state._dirty = true;

        // Skip propagation if no dependents
        if (!state._out) return;
        
        // IMMEDIATE PROPAGATION: Traverse graph immediately
        // This eliminates double traversal overhead
        dfs(state._out, notifyNode);

        // If no batch, flush
        if (!ctx.batchDepth) flush();
      } else {
        // READ
        // The currently executing consumer in the context, if there is one
        const current = ctx.currentConsumer;
        
        // If an executing consumer is reading a signal, we need to establish a link to it here
        if (current && (current._flags & RUNNING)) link(state, current, ctx.trackingVersion);

        return state.value;
      }
    }) as SignalFunction<T>;
    
    // Add peek method using closure
    signal.peek = () => state.value;
    
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