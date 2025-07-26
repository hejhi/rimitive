// Subscribe implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Unsubscribe, Producer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';

const { NOTIFIED, DISPOSED } = CONSTANTS;

interface SubscribeNode<T> {
  _source: Producer<T>;
  _callback: (value: T) => void;
  _flags: number;
  _dependency: Edge | undefined;
  _notify(): void;
  dispose(): void;
}

export function createSubscribeFactory(ctx: SignalContext): LatticeExtension<'subscribe', <T>(source: Producer<T>, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => Unsubscribe> {
  const { removeFromTargets, acquireNode, releaseNode } = createNodePoolHelpers(ctx);
  
  class Subscribe<T> implements SubscribeNode<T> {
    _source: Producer<T>;
    _callback: (value: T) => void;
    _flags = 0;
    _dependency: Edge | undefined = undefined;
    _lastValue: T;
    _sources?: Edge; // Add this to satisfy Consumer interface

    constructor(source: Producer<T>, callback: (value: T) => void) {
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
        this._callback(currentValue);
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
          releaseNode(this._dependency);
          
          this._dependency = undefined;
        }
      }
    }

    _setupDependency(): void {
      // Get or create dependency node
      const node = acquireNode();

      // Setup the node
      node.source = this._source; // source is the subscribable
      node.target = this; // target is this subscribe node
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

  const subscribe = function subscribe<T>(
    source: Producer<T>,
    callback: (value: T) => void,
    options?: { skipEqualityCheck?: boolean }
  ): Unsubscribe {
    
    const sub = new Subscribe(source, callback);
    
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

  return {
    name: 'subscribe',
    method: subscribe
  };
}