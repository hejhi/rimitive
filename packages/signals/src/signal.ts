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
import { Edge, Writable, ProducerNode, ConsumerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph, EdgeCache } from './helpers/dependency-graph';
import type { SignalContext } from './context';

const { RUNNING, NOTIFIED, DISPOSED } = CONSTANTS;

// PATTERN: Interface Segregation
// SignalInterface combines multiple concerns through interface composition:
// - Writable<T>: Public API for reading/writing values
// - ProducerNode: Internal graph node that can have dependents
// - EdgeCache: Performance optimization for repeated access
export interface SignalInterface<T = unknown> extends Writable<T>, ProducerNode, EdgeCache {
  __type: 'signal';
  value: T;  // User-facing getter/setter for reactive access
  _value: T; // Internal storage of the actual value
}

interface SignalFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
}

export function createSignalFactory(ctx: SignalFactoryContext): LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>> {
  const {
    dependencies: { ensureLink },
  } = ctx;
  
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
      if (!current || !(current._flags & RUNNING)) return this._value;

      // ALGORITHM: Edge Registration
      // Create a bidirectional edge between this signal (producer) and the consumer
      // The edge includes the current version for later staleness checks
      ensureLink(this, current, this._version);
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
      // Increment local version: Used to detect if specific dependencies are stale
      this._version++;
      
      // OPTIMIZATION: Skip global version bump if no dependents
      // Avoids invalidating unrelated computeds' global fast path when this
      // signal has no consumers. Only bump global version if we actually
      // have targets to notify.
      if (!this._targets) return;
      
      // Increment global version as we are about to notify dependents
      ctx.version++;
      
      // ALGORITHM: Inline Immediate Propagation with Linked List Queue
      // Optimized traversal with minimal overhead
      if (!this._targets) return;
      
      // Inline queue helper - avoids function call overhead
      const queueEffect = (node: ConsumerNode): void => {
        if ('_nextScheduled' in node) {
          const scheduled = node as ScheduledNode;
          if (!scheduled._nextScheduled) {
            scheduled._nextScheduled = scheduled; // Sentinel
            if (ctx.queueTail) {
              ctx.queueTail._nextScheduled = scheduled;
              ctx.queueTail = scheduled;
            } else {
              ctx.queueHead = ctx.queueTail = scheduled;
            }
          }
        }
      };
      
      // OPTIMIZATION: Fast path for single target
      let edge: Edge | undefined = this._targets;
      if (edge && !edge.nextTarget) {
        // Single target - no stack needed
        while (edge) {
          const target: ConsumerNode = edge.target;
          if (!(target._flags & (NOTIFIED | DISPOSED | RUNNING))) {
            target._flags |= NOTIFIED;
            queueEffect(target);
            // Continue with target's targets if it's a computed
            edge = ('_targets' in target && '_version' in target) ? (target as ConsumerNode & ProducerNode)._targets : undefined;
          } else {
            edge = undefined;
            break;
          }
        }
      } else {
        // Multiple targets - need traversal with stack
        // Using array stack for simplicity (could optimize with linked list later)
        const stack: Edge[] = [];
        let current: Edge | undefined = edge;
        
        while (current) {
          const target: ConsumerNode = current.target;
          
          if (!(target._flags & (NOTIFIED | DISPOSED | RUNNING))) {
            target._flags |= NOTIFIED;
            queueEffect(target);
            
            // If target has dependents, traverse them
            const childTargets: Edge | undefined = ('_targets' in target && '_version' in target) ? (target as ConsumerNode & ProducerNode)._targets : undefined;
            if (childTargets) {
              // Save siblings for later
              if (current.nextTarget) {
                stack.push(current.nextTarget);
              }
              current = childTargets;
              continue;
            }
          }
          
          // Move to sibling or pop from stack
          current = current.nextTarget || stack.pop();
        }
      }
      
      // Flush effects immediately if not in a batch
      if (ctx.batchDepth === 0) {
        let current = ctx.queueHead;
        ctx.queueHead = ctx.queueTail = undefined;
        
        while (current) {
          const next = current._nextScheduled === current ? undefined : current._nextScheduled;
          current._nextScheduled = undefined;
          current._flush();
          current = next;
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
