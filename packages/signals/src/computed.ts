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
      
      this._updateIfNeeded();
      return this._value!;
    }

    peek(): T {
      this._updateIfNeeded();
      return this._value!;
    }

    _recompute(): boolean {
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
        
        // Check if value changed
        const changed = newValue !== oldValue || this._version === 0;
        if (changed) {
          this._value = newValue;
          this._version++;
        }
        
        this._globalVersion = ctx.version;
        return changed;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
    }

    _invalidate(): void {
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      this._flags |= NOTIFIED;
      if (this._targets) {
        traverseAndInvalidate(this._targets);
      }
    }

    _updateIfNeeded(): boolean {
      const flags = this._flags;
      
      // Fast path: already clean
      if (!(flags & (OUTDATED | NOTIFIED))) return false;
      
      // If OUTDATED, always recompute
      if (flags & OUTDATED) return this._recompute();
      
      // NOTIFIED only - check if actually dirty
      // Fast path: global version hasn't changed
      if (this._globalVersion === ctx.version) {
        this._flags &= ~NOTIFIED;
        return false;
      }
      
      // Check if any source changed
      let source = this._sources;
      while (source) {
        const sourceNode = source.source;
        
        // For computed sources, recursively update and check if changed
        if ('_updateIfNeeded' in sourceNode) {
          if ((sourceNode as Computed<any>)._updateIfNeeded()) {
            this._flags |= OUTDATED;
            return this._recompute();
          }
          // Update edge version after recursive check
          source.version = sourceNode._version;
        } else if (source.version !== sourceNode._version) {
          // Signal changed
          this._flags |= OUTDATED;
          return this._recompute();
        }
        
        source = source.nextSource;
      }
      
      // All sources clean
      this._flags &= ~NOTIFIED;
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
