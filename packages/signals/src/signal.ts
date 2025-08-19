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
import { Edge, Writable, ProducerNode, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';
import type { GraphWalker } from './helpers/graph-walker';
import type { Propagator } from './helpers/propagator';
import type { WorkQueue } from './helpers/work-queue';

const { RUNNING } = CONSTANTS;

// PATTERN: Interface Segregation
// SignalInterface combines multiple concerns through interface composition:
// - Writable<T>: Public API for reading/writing values
// - ProducerNode: Internal graph node that can have dependents
export interface SignalInterface<T = unknown> extends Writable<T>, ProducerNode {
  __type: 'signal';
  value: T;  // User-facing getter/setter for reactive access
  _value: T; // Internal storage of the actual value
}

interface SignalFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  graphWalker: GraphWalker;
  propagator: Propagator;
  workQueue: WorkQueue;
}

export function createSignalFactory(ctx: SignalFactoryContext): LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>> {
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
  
  // PATTERN: Class-based Implementation
  // Using a class instead of factory functions for better performance:
  // - V8 optimizes class shapes better than object literals
  // - Predictable memory layout improves cache locality
  // - Methods on prototype save memory vs closures
  class Signal<T> implements SignalInterface<T> {
    __type = 'signal' as const;
    _value: T; // The actual value stored in the signal
    
    // ALGORITHM: Producer's Target List
    // Linked list of consumers (computeds/effects) that depend on this signal.
    // When this signal changes, we traverse _out to notify dependents.
    // Using undefined instead of null for slightly better performance.
    _out: Edge | undefined = undefined;
    _outTail: Edge | undefined;
    
    // OPTIMIZATION: Edge Cache for Hot Path
    // Caches the last edge to optimize repeated access from the same consumer.
    // In typical reactive patterns, the same computed often reads the same signal
    // multiple times. This cache turns O(n) linked list search into O(1) lookup.
    // Inspired by V8's inline caches and alien-signals' edge caching.
    _lastEdge: Edge | undefined = undefined;
    
    // ALGORITHM: Version-based Cache Invalidation
    // Monotonically increasing counter, incremented on each value change.
    // Edges store the version when created, enabling O(1) staleness checks.
    // This is more efficient than stale flags or timestamp comparisons.
    _version = 0;

    constructor(value: T) {
      this._value = value;
    }


    get value(): T {
      // OPTIMIZATION: Read value first, then handle tracking
      const value = this._value;
      const current = ctx.currentConsumer;
      
      // V8 OPTIMIZATION: Predictable branch pattern - most reads are untracked
      if (current && (current._flags & RUNNING)) {
        // V8 OPTIMIZATION: Direct function call instead of method indirection
        link(this, current, this._version);
      }
      
      return value;
    }

    set value(value: T) {
      // OPTIMIZATION: Early exit on unchanged value
      if (this._value === value) return;

      // Skip if no dependents
      if (!this._out) {
        // Update value and version only
        this._value = value;
        this._version++;
        return;
      }
      
      // Update value and version
      this._value = value;
      this._version++;
      
      // Update global version
      ctx.version++;
      
      // OPTIMIZATION: Remove double batch wrapper
      // Batching is already handled by the batch() function
      if (ctx.batchDepth > 0) {
        // During batch: accumulate roots for batch-end traversal
        invalidate(this._out, true, dfs, notifyNode);
      } else {
        // Outside batch: direct traversal without creating a batch
        dfs(this._out, notifyNode);
        flush();
      }
    }


    peek(): T {
      // ALGORITHM: Non-Tracking Read
      // Provides a way to read the signal's value without establishing a dependency
      // This is crucial for conditional logic where you want to check a value
      // without subscribing to changes
      // Common use case: Checking a value to decide which dependencies to track
      return this._value;
    }
  }

  return {
    name: 'signal',
    method: <T>(value: T): SignalInterface<T> => new Signal(value)
  };
}
// Type alias for external usage
export type Signal<T = unknown> = SignalInterface<T>;
