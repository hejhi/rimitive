/**
 * ALGORITHM: Push-Pull Reactive Signal Implementation
 * 
 * This module implements the core Signal primitive using a hybrid push-pull algorithm:
 * 
 * PUSH PHASE (Write):
 * - When a signal's value changes, it traverses its dependency graph
 * - Marks all transitively dependent nodes as "possibly dirty" (NOTIFIED)
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
import type { SignalContext } from './context';
import { Edge, Writable, ProducerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';

const { RUNNING } = CONSTANTS;

// PATTERN: Interface Segregation
// SignalInterface combines multiple concerns through interface composition:
// - Writable<T>: Public API for reading/writing values
// - ProducerNode: Internal graph node that can have dependents
// - EdgeCache: Performance optimization for repeated access
export interface SignalInterface<T = unknown> extends Writable<T>, ProducerNode, EdgeCache {
  __type: 'signal';
  value: T;  // User-facing getter/setter for reactive access
  _value: T; // Internal storage of the actual value
  
  // PATTERN: Immutable Update Helpers
  // These methods enforce immutability for proper change detection.
  // React developers will recognize this pattern from setState.
  // Vue developers will recognize this from Vue 3's reactive arrays/objects.
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>> {
  // Dependency tracking helper for establishing producer-consumer edges
  const { addDependency } = createDependencyHelpers();
  
  // Scheduled consumer helpers for deferred effect execution
  // Uses a circular buffer queue for O(1) enqueue/dequeue operations
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  const { flushScheduled } = scheduledConsumerHelpers;
  
  // Graph traversal helper for propagating invalidations through the dependency graph
  // Uses depth-first traversal with version checks to avoid redundant invalidations
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  
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
    // When this signal changes, we traverse _targets to notify dependents.
    // Using undefined instead of null for slightly better performance.
    _targets: Edge | undefined = undefined;
    
    // OPTIMIZATION: Edge Cache for Hot Path
    // Caches the last edge to optimize repeated access from the same consumer.
    // In typical reactive patterns, the same computed often reads the same signal
    // multiple times. This cache turns O(n) linked list search into O(1) lookup.
    // Inspired by V8's inline caches and alien-signals' edge caching.
    _lastEdge: Edge | undefined = undefined;
    
    // ALGORITHM: Version-based Cache Invalidation
    // Monotonically increasing counter, incremented on each value change.
    // Edges store the version when created, enabling O(1) staleness checks.
    // This is more efficient than dirty flags or timestamp comparisons.
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
      if (
        !current
        || !('_flags' in current)
        || typeof current._flags !== 'number'
        || !(current._flags & RUNNING)
      ) return this._value;

      // ALGORITHM: Edge Registration
      // Create a bidirectional edge between this signal (producer) and the consumer
      // The edge includes the current version for later staleness checks
      addDependency(this, current, this._version);
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
      // Increment both local and global versions:
      // - Local version: Used to detect if specific dependencies are stale
      // - Global version: Used as a generation counter for optimizations
      this._version++;
      ctx.version++;
      
      // OPTIMIZATION: Skip traversal if no targets
      if (!this._targets) return;
      
      // ALGORITHM: Automatic Batching (inspired by React's batching strategy)
      // All synchronous updates are automatically batched to prevent redundant computations
      // This is crucial for performance when multiple signals change together
      ctx.batchDepth++;
      try {
        // ALGORITHM: Push-Based Invalidation Propagation
        // Traverse the dependency graph starting from this signal's targets
        // Mark all dependent computeds as "outdated" and schedule effects
        // This uses depth-first traversal to ensure proper ordering
        traverseAndInvalidate(this._targets);
      } finally {
        // When the outermost batch completes (batchDepth reaches 0),
        // flush all scheduled effects in the order they were scheduled
        if (--ctx.batchDepth === 0) {
          flushScheduled();
        }
      }
    }

    set(key: unknown, value: unknown): void {
      // ALGORITHM: Immutable Update Helper
      // Provides a convenient way to update nested properties while maintaining immutability
      // This ensures the signal's equality check (===) will detect the change
      const currVal = this._value;
      
      // Handle array updates
      if (Array.isArray(currVal)) {
        // Create a shallow copy of the array
        const arr = [...currVal];
        // Update the specific index
        arr[key as number] = value;
        // Trigger signal update with new array reference
        this.value = arr as T;
      } else if (typeof currVal === 'object' && currVal !== null) {
        // Handle object updates using spread syntax for shallow cloning
        // FLAG: This only does shallow cloning - deep nested updates require manual handling
        this.value = { ...currVal, [key as keyof T]: value };
      }
      // FIXME: Should we warn or throw when trying to set on primitive values?
    }

    patch(key: unknown, partial: unknown): void {
      // ALGORITHM: Partial Update Helper (similar to React's setState with partial updates)
      // Allows updating nested objects by merging partial values
      const currVal = this._value;

      if (Array.isArray(currVal)) {
        // For arrays, patch the element at the given index
        const arr = [...currVal];
        const index = key as number;
        const current = arr[index];
        
        // If the current element is an object, merge the partial
        // Otherwise, replace entirely
        arr[index] =
          typeof current === 'object' && current !== null
            ? { ...current, ...(partial as object) }
            : partial;
        this.value = arr as T;
      } else if (typeof currVal === 'object' && currVal !== null) {
        // For objects, patch the property at the given key
        const objKey = key as keyof T;
        const current = currVal[objKey];
        
        // Deep merge one level - if the property is an object, spread both
        // FLAG: Only merges one level deep - deeply nested updates need multiple patches
        this.value = {
          ...currVal,
          [objKey]:
            typeof current === 'object' && current !== null
              ? { ...current, ...(partial as object) }
              : partial,
        } as T;
      }
      // TODO: Consider adding deep merge utility or warning about shallow merge limitations
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