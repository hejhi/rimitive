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
    graphWalker: { dfs, dfsMany },
    propagator: { invalidate, propagate },
    workQueue: { enqueue, state, flush }
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
      // Get the currently executing consumer (computed/effect) from context
      // This is set by computed/effect before running their functions
      const current = ctx.currentConsumer;

      // ALGORITHM: Dependency Tracking via Dynamic Graph Construction
      // Only track dependencies if:
      // 1. There is a current consumer (we're inside a computed/effect)
      // 2. The consumer has _flags property (type guard)
      // 3. The consumer is currently RUNNING (not disposed or paused)
      // This implements "automatic dependency tracking" - dependencies are discovered
      // at runtime by observing which signals are accessed during computation
      if (!current || !(current._flags & RUNNING)) return this._value;

      // ALGORITHM: Edge Registration
      // Create a bidirectional edge between this signal (producer) and the consumer
      // The edge includes the current version for later staleness checks
      link(this, current, this._version);
      return this._value;
    }

    set value(value: T) {
      // ALGORITHM: Early Exit Optimization
      // Use JavaScript's === equality to detect changes
      // This is a deliberate choice: signals only update on reference changes
      // For objects/arrays, this means immutable updates are required
      if (this._value === value) return;

      // Update the internal value
      this._value = value;
      
      // ALGORITHM: Version Tracking for Cache Invalidation
      // Increment local fromVersion: Used to detect if specific dependencies are stale
      this._version++;
      
      // OPTIMIZATION: Skip global version bump if no dependents
      // Avoids invalidating unrelated computeds' global fast path when this
      // signal has no consumers. Only bump global version if we actually
      // have targets to notify.
      if (!this._out) return;
      
      // Increment global version as we are about to notify dependents
      ctx.version++;
      
      // ALGORITHM: Delegated Propagation via GraphWalker and Propagator
      // Uses modular components for optimal traversal strategy
      const isNewBatch = ctx.batchDepth === 0;
      if (isNewBatch) ctx.batchDepth++;
      
      // Track queue size to detect if effects were scheduled
      const prevSize = state.size;
      
      // Use propagator's intelligent invalidation strategy
      // - Immediate traversal for unbatched updates
      // - Small batch optimization (threshold = 2)
      // - Multi-root aggregation for large batches
      invalidate(this._out, !isNewBatch, dfs, notifyNode);
      
      // Flush effects if we're ending a batch and effects were queued
      if (isNewBatch && --ctx.batchDepth === 0) {
        // Process any accumulated roots from large batch before flushing effects
        propagate(dfsMany, notifyNode);
        if (state.size !== prevSize) {
          flush();
        }
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
