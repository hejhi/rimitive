/**
 * ALGORITHM: Push-Pull Reactive Signal Implementation
 * 
 * This module implements the core Signal primitive using a hybrid push-pull algorithm:
 * 
 * PUSH PHASE (Write):
 * - When a signal's value changes, it traverses its dependency graph
 * - Marks all transitively dependent nodes as "possibly stale" (INVALIDATED)
 * - Schedules effects for execution after the current batch
 * 
 * PULL PHASE (Read):
 * - When a computed/effect reads a signal, it establishes a dependency edge
 * - The edge tracks version numbers for efficient cache invalidation
 * - Uses automatic dependency discovery during execution
 * 
 * KEY ALGORITHMS:
 * 1. Automatic Dependency Tracking: Dependencies discovered at runtime
 * 2. Version-based Invalidation: O(1) staleness checks via version numbers
 * 3. Automatic Batching: All sync updates batched to prevent redundant work
 * 4. Intrusive Linked Lists: Memory-efficient bidirectional graph edges
 * 
 * INSPIRATION: This design combines ideas from:
 * - MobX (automatic tracking)
 * - Vue 3 (proxy-free signals)
 * - SolidJS (fine-grained reactivity)
 * - alien-signals (optimized graph traversal)
 */
import { CONSTANTS } from './constants';
import { ProducerNode, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';
import type { GraphWalker } from './helpers/graph-walker';
import type { Propagator } from './helpers/propagator';
import type { WorkQueue } from './helpers/work-queue';

const { RUNNING } = CONSTANTS;

// ALIEN-SIGNALS PATTERN: Single function interface for both read and write
// The function also implements ProducerNode to expose graph properties
export interface SignalFunction<T = unknown> extends ProducerNode {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

// ALIEN-SIGNALS PATTERN: Signal state object that gets bound to the function
// This IS the actual signal - no indirection through properties
interface SignalState<T> extends ProducerNode {
  value: T;                 // Current value (alien uses 'value' directly)
}

interface SignalFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  graphWalker: GraphWalker;
  propagator: Propagator;
  workQueue: WorkQueue;
}

export function createSignalFactory(ctx: SignalFactoryContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    dependencies: { link },
    graphWalker: { dfs },
    propagator: { invalidate },
    workQueue: { enqueue, flush }
  } = ctx;
  
  // Pre-bind notification handler for hot path
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
      _version: 0,
    };
    
    // Signal function using closure instead of bound this
    const signal = ((...args: [] | [T]): T | void => {
      if (args.length) {
        // WRITE OPERATION
        const newValue = args[0];
        
        // OPTIMIZATION: Early exit on unchanged value
        if (state.value === newValue) return;
        
        // Update value and version
        state.value = newValue;
        state._version++;
        
        // Skip propagation if no dependents
        if (!state._out) return;
        
        // Update global version
        ctx.version++;
        
        // Propagate changes
        if (ctx.batchDepth > 0) {
          // During batch: accumulate roots for batch-end traversal
          invalidate(state._out, true, dfs, notifyNode);
        } else {
          // Outside batch: direct traversal
          dfs(state._out, notifyNode);
          flush();
        }
      } else {
        // READ OPERATION - CRITICAL HOT PATH
        const value = state.value;
        
        // Direct context access from closure
        // No WeakMap lookup, no indirection - ctx is captured in closure
        const current = ctx.currentConsumer;
        
        // V8 OPTIMIZATION: Predictable branch pattern
        if (current && (current._flags & RUNNING)) {
          link(state, current, state._version);
        }
        
        return value;
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