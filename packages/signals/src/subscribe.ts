// Subscribe implementation with factory pattern for performance
import type { SignalContext } from './context';
import { DISPOSED, NOTIFIED, MAX_POOL_SIZE, removeFromTargets } from './context';
import { DependencyNode, Unsubscribe, Selected, Signal, Computed } from './types';

interface SubscribeNode<T> {
  _source: Signal<T> | Computed<T>;
  _callback: (value: T) => void;
  _flags: number;
  _dependency: DependencyNode | undefined;
  _notify(): void;
  dispose(): void;
}

export function createSubscribeFactory(ctx: SignalContext) {
  class Subscribe<T> implements SubscribeNode<T> {
    _source: Signal<T> | Computed<T>;
    _callback: (value: T) => void;
    _flags = 0;
    _dependency: DependencyNode | undefined = undefined;
    _lastValue: T;

    constructor(source: Signal<T> | Computed<T>, callback: (value: T) => void) {
      this._source = source;
      this._callback = callback;
      this._lastValue = source.value;
    }

    _notify(): void {
      if (this._flags & (NOTIFIED | DISPOSED)) return;
      this._flags |= NOTIFIED;

      // Handle batching
      if (ctx.batchDepth > 0) {
        // Queue for batch execution
        if (!ctx.subscribeBatch) {
          ctx.subscribeBatch = new Set();
        }
        ctx.subscribeBatch.add(this);
        return;
      }

      // Execute immediately with implicit batch
      ctx.batchDepth++;
      try {
        this._execute();
      } finally {
        if (--ctx.batchDepth === 0) {
          this._processBatchedSubscribes();
        }
      }
    }

    _execute(): void {
      if (this._flags & DISPOSED) return;
      this._flags &= ~NOTIFIED;
      
      const currentValue = this._source.value;
      const skipEqualityCheck = this._flags & (1 << 6);
      
      if (skipEqualityCheck || currentValue !== this._lastValue) {
        this._lastValue = currentValue;
        try {
          this._callback(currentValue);
        } catch (error) {
          // Let errors propagate but ensure cleanup
          throw error;
        }
      }
    }

    _processBatchedSubscribes(): void {
      if (ctx.subscribeBatch && ctx.subscribeBatch.size > 0) {
        const batch = ctx.subscribeBatch;
        ctx.subscribeBatch = undefined;
        for (const subscribe of batch) {
          subscribe._execute();
        }
      }
    }

    dispose(): void {
      if (!(this._flags & DISPOSED)) {
        this._flags |= DISPOSED;
        
        if (this._dependency) {
          removeFromTargets(this._dependency);
          
          // Release node to pool
          if (ctx.poolSize < MAX_POOL_SIZE) {
            this._dependency.source = undefined!;
            this._dependency.target = undefined!;
            this._dependency.version = 0;
            this._dependency.nextSource = undefined;
            this._dependency.prevSource = undefined;
            this._dependency.nextTarget = undefined;
            this._dependency.prevTarget = undefined;
            ctx.nodePool[ctx.poolSize++] = this._dependency;
          }
          
          this._dependency = undefined;
        }
      }
    }

    _setupDependency(): void {
      // Get or create dependency node
      let node: DependencyNode;
      
      if (ctx.poolSize > 0) {
        ctx.poolHits++;
        node = ctx.nodePool[--ctx.poolSize]!;
      } else {
        ctx.poolMisses++;
        node = {} as DependencyNode;
      }
      ctx.allocations++;

      // Setup the node
      node.source = this._source as any; // source is the subscribable
      node.target = this as any; // target is this subscribe node
      node.version = this._source._version;
      node.nextSource = undefined;
      node.prevSource = undefined;
      
      // Link into source's targets list
      node.nextTarget = this._source._targets;
      node.prevTarget = undefined;
      
      if (this._source._targets) {
        this._source._targets.prevTarget = node;
      }
      this._source._targets = node;
      
      this._dependency = node;
    }
  }

  return function subscribe<T>(
    source: Signal<T> | Computed<T> | Selected<T>,
    callback: (value: T) => void,
    options?: { skipEqualityCheck?: boolean }
  ): Unsubscribe {
    // Handle Selected values that have their own _subscribe method
    if ('_subscribe' in source && typeof source._subscribe === 'function') {
      // For Selected values, we need to adapt the callback
      return source._subscribe(() => callback(source.value));
    }
    
    const sub = new Subscribe(source as Signal<T> | Computed<T>, callback);
    
    // If raw mode, mark it so _execute skips equality check
    if (options?.skipEqualityCheck) {
      sub._flags |= 1 << 6; // Use a new flag for raw mode
    }
    
    // Setup dependency tracking
    sub._setupDependency();
    
    // Call callback with initial value
    callback(source.value);
    
    // Return unsubscribe function
    return () => sub.dispose();
  };
}