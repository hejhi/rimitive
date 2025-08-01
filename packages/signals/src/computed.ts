import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { createGraphTraversalHelpers } from './helpers/graph-traversal';
import { createScheduledConsumerHelpers } from './helpers/scheduled-consumer';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;
  peek(): T;
  dispose(): void;
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
  NOTIFIED,
  IS_COMPUTED,
} = CONSTANTS;

export function createComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  const depHelpers = createDependencyHelpers();
  const { addDependency } = depHelpers
  const { disposeAllSources, cleanupSources } =
    createSourceCleanupHelpers(depHelpers);
  const scheduledConsumerHelpers = createScheduledConsumerHelpers(ctx);
  const { traverseAndInvalidate } = createGraphTraversalHelpers(ctx, scheduledConsumerHelpers);
  
  class Computed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;
    _callback: () => T;
    _value: T | undefined = undefined;
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;
    _globalVersion = -1;

    constructor(compute: () => T) {
      this._callback = compute;
    }

    get value(): T {
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Track dependency if in computation context
      const consumer = ctx.currentConsumer;
      if (consumer && '_flags' in consumer && typeof consumer._flags === 'number' && consumer._flags & RUNNING) {
        addDependency(this, consumer, this._version);
      }
      
      this._update();
      return this._value!;
    }

    peek(): T {
      this._update();
      return this._value!;
    }

    _recompute(): void {
      // Single flag update: set RUNNING, clear OUTDATED and NOTIFIED
      this._flags = (this._flags | RUNNING) & ~(OUTDATED | NOTIFIED);
      
      // Mark sources for dependency tracking
      let source = this._sources;
      while (source) {
        source.version = -1;
        source = source.nextSource;
      }
      
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      try {
        const oldValue = this._value;
        const newValue = this._callback();
        
        // Update value and version if changed or first run
        if (newValue !== oldValue || this._version === 0) {
          this._value = newValue;
          this._version++;
        }
        
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
    }

    _invalidate(): void {
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      this._flags |= NOTIFIED;
      if (this._targets) traverseAndInvalidate(this._targets);
    }

    _update(): void {
      const flags = this._flags;
      
      // Fast path: already clean
      if (!(flags & (OUTDATED | NOTIFIED))) return;
      
      // If OUTDATED or NOTIFIED, always recompute
      if (flags & OUTDATED || this._checkDirty()) return this._recompute();

      this._flags &= ~NOTIFIED;
    }
    
    _checkDirty(): boolean {
      // Fast path: global version hasn't changed
      if (this._globalVersion === ctx.version) return false;
      
      // Check if any source changed
      let source = this._sources;
      while (source) {
        const sourceNode = source.source;
        
        // For computed sources, recursively update and check if changed
        if ('_update' in sourceNode) {
          const oldVersion = sourceNode._version;
          (sourceNode as Computed<unknown>)._update();
          if (oldVersion !== sourceNode._version) return true;
        } else if (source.version !== sourceNode._version) {
          // Signal changed
          return true;
        }
        
        // Update edge version to match source
        source.version = sourceNode._version;
        source = source.nextSource;
      }
      
      // All sources clean - update global version
      this._globalVersion = ctx.version;
      return false;
    }


    dispose(): void {
      if (this._flags & DISPOSED) return;
      
      this._flags |= DISPOSED;
      disposeAllSources(this);
      this._value = undefined;
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
