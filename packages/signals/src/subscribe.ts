// Subscribe implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Producer, ScheduledConsumer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';

const { NOTIFIED, DISPOSED, SKIP_EQUALITY } = CONSTANTS;

export interface SubscribeNode<T> extends ScheduledConsumer {
  _callback: (value: T) => void;
  _dependency: Edge | undefined;
  _lastValue: T;
  dispose(): void;
}

export function createSubscribeFactory(ctx: SignalContext): LatticeExtension<'subscribe', <T>(source: Producer<T>, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => (() => void)> {
  const { removeFromTargets, acquireNode, releaseNode } = createNodePoolHelpers(ctx);
  
  class Subscribe<T> implements SubscribeNode<T> {
    __type = 'subscribe' as const;
    _source: Producer<T>;
    _callback: (value: T) => void;
    _flags = 0;
    _dependency: Edge | undefined = undefined;
    _lastValue: T;
    _sources?: Edge = undefined;
    _nextScheduled?: ScheduledConsumer = undefined;

    constructor(source: Producer<T>, callback: (value: T) => void) {
      this._source = source;
      this._callback = callback;
      this._lastValue = source.value;
    }

    _invalidate(): void {
      if (this._flags & (NOTIFIED | DISPOSED)) return;
      this._flags |= NOTIFIED;

      // Handle batching using ScheduledConsumer pattern
      if (ctx.batchDepth > 0) {
        this._nextScheduled = ctx.scheduled || undefined;
        ctx.scheduled = this;
        return;
      }

      // Execute immediately
      this._flush();
    }

    _flush(): void {
      if (this._flags & DISPOSED) return;
      this._flags &= ~NOTIFIED;
      
      const currentValue = this._source.value;
      const skipEqualityCheck = this._flags & SKIP_EQUALITY;
      
      if (skipEqualityCheck || currentValue !== this._lastValue) {
        this._lastValue = currentValue;
        this._callback(currentValue);
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
  ): (() => void) {
    
    const sub = new Subscribe(source, callback);
    
    // If raw mode, mark it so _execute skips equality check
    if (options?.skipEqualityCheck) {
      sub._flags |= SKIP_EQUALITY;
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