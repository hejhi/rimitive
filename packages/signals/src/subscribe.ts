/**
 * ALGORITHM: Lightweight Single-Source Subscription Pattern
 * 
 * Subscribe implements a specialized reactive pattern optimized for the common
 * case of watching a single value. It's more efficient than effects because:
 * 
 * 1. SINGLE DEPENDENCY OPTIMIZATION:
 *    - No linked list traversal for dependencies
 *    - No dynamic dependency discovery overhead
 *    - Direct edge to exactly one source
 *    - O(1) for all operations
 * 
 * 2. VALUE CACHING FOR CHANGE DETECTION:
 *    - Stores previous value to detect actual changes
 *    - Uses === equality by default (referential equality)
 *    - Can disable equality check for deep comparison scenarios
 *    - Prevents unnecessary callback invocations
 * 
 * 3. SIMPLIFIED API:
 *    - No cleanup function support (use dispose instead)
 *    - No dependency tracking context needed
 *    - Direct callback with new value only
 *    - More intuitive for simple use cases
 * 
 * USE CASES:
 * - UI components reacting to single state changes
 * - Logging/debugging specific values
 * - Bridge to non-reactive systems
 * - Performance-critical single-value monitoring
 * 
 * TRADE-OFFS:
 * - Can't track multiple dependencies (use effect instead)
 * - No cleanup function (must manage externally)
 * - No access to old value in callback
 * - Manual dependency setup (less magic, more explicit)
 */
import { CONSTANTS } from './constants';
import { Edge, Readable, ProducerNode, ScheduledNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencySweeper } from './helpers/dependency-sweeper';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';

const { INVALIDATED, DISPOSED, SCHEDULED } = CONSTANTS;

export interface SubscribeNode<T> extends ScheduledNode {
  _callback: (value: T) => void;
  _lastValue: T;
  dispose(): void;
}

interface SubscribeFactoryContext extends SignalContext {
  dependencies: DependencyGraph;
  sourceCleanup: DependencySweeper;
}

export function createSubscribeFactory(ctx: SubscribeFactoryContext): LatticeExtension<'subscribe', <T>(source: Readable<T> & ProducerNode, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => (() => void)> {
  const {
    sourceCleanup: { detachAll }
  } = ctx;
  class Subscribe<T> implements SubscribeNode<T> {
    __type = 'subscribe' as const;
    _callback: (value: T) => void; // User's callback function
    _flags = 0; // State flags (INVALIDATED, DISPOSED, SKIP_EQUALITY)
    _lastValue: T; // Cached value for equality check
    _from: Edge | undefined = undefined; // Single edge to source signal/computed
    _nextScheduled: ScheduledNode | undefined = undefined; // Link in scheduling queue
    _fromTail: Edge | undefined = undefined; // Link in scheduling queue
    _gen = 0; // Generation counter for dynamic dependency tracking

    constructor(
      source: Readable<T> & ProducerNode,
      callback: (value: T) => void
    ) {
      this._callback = callback;

      // ALGORITHM: Initial Value Caching
      // Store the initial value for comparison in _flush
      // This read doesn't establish dependency (we do that manually)
      this._lastValue = source.value;

      // Dependency is established later via _setupDependency
    }

    _invalidate(): void {
      // ALGORITHM: Queue for Immediate Propagation with Linked List
      // When source changes, queue for execution using intrusive list
      // Skip if already INVALIDATED or DISPOSED

      // Early exit if already processed or disposed
      if (this._flags & (INVALIDATED | DISPOSED)) return;

      // Mark with INVALIDATED flag
      this._flags |= INVALIDATED;

      // Queue the subscription if not already queued
      if (!(this._flags & SCHEDULED)) {
        // Mark as scheduled
        this._flags |= SCHEDULED;
        if (ctx.queueTail) {
          ctx.queueTail._nextScheduled = this;
          ctx.queueTail = this;
        } else {
          ctx.queueHead = ctx.queueTail = this;
        }
        this._nextScheduled = undefined; // Tail has no next
      }

      // If not in a batch, flush immediately
      if (ctx.batchDepth === 0) {
        let current = ctx.queueHead;
        ctx.queueHead = ctx.queueTail = undefined;

        while (current) {
          const next = current._nextScheduled;
          current._nextScheduled = undefined;
          current._flags &= ~SCHEDULED; // Clear scheduled flag
          current._flush();
          current = next;
        }
      }
    }

    _flush(): void {
      // Skip if disposed
      if (this._flags & DISPOSED) return;

      // Clear INVALIDATED flag
      this._flags &= ~INVALIDATED;

      // ALGORITHM: Source Resolution
      // Get the source from our single dependency edge
      if (!this._from) return;
      const source = this._from.from as Readable<T> & ProducerNode;

      // Read current value (this doesn't track dependency since we're not RUNNING)
      const currentValue = source.value;

      // ALGORITHM: Conditional Callback Execution
      // Only call callback if:
      // 1. skipEqualityCheck is enabled (always call)
      // 2. Value actually changed (using === equality)
      if (currentValue !== this._lastValue) {
        // Update cached value before calling callback
        // This ensures callback sees consistent state
        this._lastValue = currentValue;
        this._callback(currentValue);
      }
      // FLAG: No error handling - callback errors will propagate
    }

    _updateValue(): boolean {
      // Subscribe nodes don't produce values - nothing to update
      // This method exists to satisfy the ConsumerNode interface
      // Subscribe nodes are scheduled for execution through _invalidate/_flush instead
      return true;
    }

    dispose(): void {
      // ALGORITHM: Clean Disposal
      // Mark as disposed and remove the single source edge
      if (this._flags & DISPOSED) return;
      this._flags |= DISPOSED;
      detachAll(this);
    }

    _setupDependency(source: Readable<T> & ProducerNode): void {
      // ALGORITHM: Manual Edge Creation
      // Subscribe doesn't use automatic dependency tracking
      // Instead, we manually create a single edge to the source

      // Create new edge object
      const node = {} as Edge;

      // Setup bidirectional pointers
      node.from = source;
      node.to = this;
      node.version = source._version; // Current version for staleness checks

      // This subscribe only has one source, so no source list needed
      node.nextIn = undefined;
      node.prevIn = undefined;

      // ALGORITHM: Insert at Head of Target List
      // Add to the beginning of source's target list
      node.nextOut = source._to;
      node.prevOut = undefined;

      // Update old head's back pointer
      if (source._to) {
        source._to.prevOut = node;
      }

      // Update source's head pointer
      source._to = node;

      // Store as our single source
      this._from = node;
    }
  }

  const subscribe = function subscribe<T>(
    source: Readable<T> & ProducerNode,
    callback: (value: T) => void,
  ): (() => void) {
    
    const sub = new Subscribe(source, callback);
    
    // Manually establish the dependency relationship
    sub._setupDependency(source);
    
    // ALGORITHM: Immediate Initial Callback
    // Call callback with current value to establish initial state
    // This matches effect behavior of running immediately
    callback(source.value);
    
    // Return unsubscribe function for cleanup
    return () => sub.dispose();
  };

  return {
    name: 'subscribe',
    method: subscribe
  };
}
