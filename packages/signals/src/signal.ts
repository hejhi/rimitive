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
import { Edge, ProducerNode, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';
import type { GraphWalker } from './helpers/graph-walker';
import type { Propagator } from './helpers/propagator';
import type { WorkQueue } from './helpers/work-queue';

const { RUNNING } = CONSTANTS;

// ALIEN-SIGNALS PATTERN: Single function interface for both read and write
// No backward compatibility - pure functional approach
export interface SignalFunction<T = unknown> {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

// ALIEN-SIGNALS PATTERN: Signal state object that gets bound to the function
// This IS the actual signal - no indirection through properties
interface SignalState<T> extends ProducerNode {
  value: T;                 // Current value (alien uses 'value' directly)
  previousValue: T;         // For change detection
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
  
  // ALIEN-SIGNALS PATTERN: Signal operation function that will be bound to state
  // Using rest parameters like alien-signals for cleaner argument handling
  function signalOper<T>(this: SignalState<T>, ...args: [] | [T]): T | void {
    if (args.length) {
      // WRITE OPERATION
      const newValue = args[0];
      
      // OPTIMIZATION: Early exit on unchanged value
      if (this.value === newValue) return;
      
      // Update previous value for change tracking
      this.previousValue = this.value;
      this.value = newValue;
      this._version++;
      
      // Skip propagation if no dependents
      if (!this._out) return;
      
      // Update global version
      ctx.version++;
      
      // Propagate changes
      if (ctx.batchDepth > 0) {
        // During batch: accumulate roots for batch-end traversal
        invalidate(this._out, true, dfs, notifyNode);
      } else {
        // Outside batch: direct traversal
        dfs(this._out, notifyNode);
        flush();
      }
    } else {
      // READ OPERATION - CRITICAL HOT PATH
      const value = this.value;
      
      // ALIEN-SIGNALS PATTERN: Direct context access from closure
      // No WeakMap lookup, no indirection - ctx is captured in closure
      const current = ctx.currentConsumer;
      
      // V8 OPTIMIZATION: Predictable branch pattern
      if (current && (current._flags & RUNNING)) {
        link(this, current, this._version);
      }
      
      return value;
    }
  }
  
  // ALIEN-SIGNALS PATTERN: Non-tracking peek function
  function peekOper<T>(this: SignalState<T>): T {
    return this.value;
  }
  
  // ALIEN-SIGNALS PATTERN: Create signal with bound functions
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    // ALIEN-SIGNALS PATTERN: State object that will become 'this' in bound functions
    // This object IS the signal - no property definitions needed
    const state: SignalState<T> = {
      __type: 'signal',
      value: initialValue,
      previousValue: initialValue,
      _out: undefined,
      _outTail: undefined,
      _version: 0,
    };
    
    // ALIEN-SIGNALS CORE: Bind the operation function to the state object
    // The bound function IS the signal - clean and simple
    const signal = signalOper.bind(state) as SignalFunction<T>;
    
    // Add the peek method
    signal.peek = peekOper.bind(state);
    
    // That's it! No property definitions, no compatibility layers
    // The signal function has direct access to state via 'this'
    return signal;
  }
  
  return {
    name: 'signal',
    method: createSignal
  };
}

// ALIEN-SIGNALS PATTERN: Export the function-based Signal type
export type Signal<T = unknown> = SignalFunction<T>;