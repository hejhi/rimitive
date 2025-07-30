// Subscribe implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, ScheduledNode, StatefulNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';
import { createDependencyHelpers } from './helpers/dependency-tracking';

const { NOTIFIED, DISPOSED, SKIP_EQUALITY } = CONSTANTS;

export interface SubscribeNode<T> extends ScheduledNode, StatefulNode {
  _callback: (value: T) => void;
  _lastValue: T;
  dispose(): void;
}

export function createSubscribeFactory(ctx: SignalContext): LatticeExtension<'subscribe', <T>(source: Readable<T> & ProducerNode, callback: (value: T) => void, options?: { skipEqualityCheck?: boolean }) => (() => void)> {
  const { disposeAllSources } = createSourceCleanupHelpers(createDependencyHelpers());
  const { invalidateConsumer, disposeConsumer } = createScheduledConsumerHelpers(ctx);
  
  class Subscribe<T> implements SubscribeNode<T> {
    __type = 'subscribe' as const;
    _callback: (value: T) => void;
    _flags = 0;
    _lastValue: T;
    _sources: Edge | undefined = undefined;
    _nextScheduled?: ScheduledNode = undefined;

    constructor(source: Readable<T> & ProducerNode, callback: (value: T) => void) {
      this._callback = callback;
      this._lastValue = source.value;
      // Note: source is linked via _sources in _setupDependency
    }

    _invalidate(): void {
      invalidateConsumer(this, NOTIFIED | DISPOSED, NOTIFIED);
    }

    _flush(): void {
      if (this._flags & DISPOSED) return;
      this._flags &= ~NOTIFIED;
      
      // Get source from _sources edge
      if (!this._sources) return;
      const source = this._sources.source as Readable<T> & ProducerNode;
      
      const currentValue = source.value;
      const skipEqualityCheck = this._flags & SKIP_EQUALITY;
      
      if (skipEqualityCheck || currentValue !== this._lastValue) {
        this._lastValue = currentValue;
        this._callback(currentValue);
      }
    }


    dispose(): void {
      disposeConsumer(this, disposeAllSources);
    }

    _setupDependency(source: Readable<T> & ProducerNode): void {
      // Get or create dependency node
      const node = {} as Edge;

      // Setup the node
      node.source = source;
      node.target = this;
      node.version = source._version;
      node.nextSource = undefined;
      node.prevSource = undefined;
      
      // Link into source's targets list
      node.nextTarget = source._targets;
      node.prevTarget = undefined;
      
      if (source._targets) {
        source._targets.prevTarget = node;
      }
      source._targets = node;
      
      // Set as the single source
      this._sources = node;
    }
  }

  const subscribe = function subscribe<T>(
    source: Readable<T> & ProducerNode,
    callback: (value: T) => void,
    options?: { skipEqualityCheck?: boolean }
  ): (() => void) {
    
    const sub = new Subscribe(source, callback);
    
    // If raw mode, mark it so _execute skips equality check
    if (options?.skipEqualityCheck) {
      sub._flags |= SKIP_EQUALITY;
    }
    
    // Setup dependency tracking
    sub._setupDependency(source);
    
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