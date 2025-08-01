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
      // Check for circular dependency
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Track dependency if we're in a computation context
      const consumer = ctx.currentConsumer;
      if (consumer && '_flags' in consumer && typeof consumer._flags === 'number' && consumer._flags & RUNNING) {
        addDependency(this, consumer, this._version);
      }
      
      // Update if needed and return value
      this._updateIfNeeded();
      return this._value!;
    }

    peek(): T {
      this._updateIfNeeded();
      return this._value!;
    }

    _recompute(): boolean {
      // Set running flag and clear outdated/notified
      this._flags = (this._flags | RUNNING) & ~(OUTDATED | NOTIFIED);
      
      // Mark sources for dependency tracking
      let source = this._sources;
      while (source) {
        source.version = -1;
        source = source.nextSource;
      }
      
      // Execute computation with dependency tracking
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      let valueChanged = false;
      try {
        const oldValue = this._value;
        const newValue = this._callback();
        
        // Update value if changed or first run
        if (newValue !== oldValue || this._version === 0) {
          this._value = newValue;
          this._version++;
          valueChanged = true;
        }
        
        // Update global version after computation
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
      
      return valueChanged;
    }

    _invalidate(): void {
      // Skip if already notified, disposed, or currently recomputing
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      // Mark as notified only - OUTDATED will be set lazily if actually dirty
      this._flags |= NOTIFIED;

      // Use iterative traversal instead of recursion
      if (this._targets) {
        traverseAndInvalidate(this._targets);
      }
    }

    _updateIfNeeded(): boolean {
      // Fast path: already clean
      const flags = this._flags;
      if (!(flags & (OUTDATED | NOTIFIED))) {
        return false;
      }
      
      // Fast path: global version check for NOTIFIED
      if (flags & NOTIFIED && !(flags & OUTDATED) && this._globalVersion === ctx.version) {
        this._flags &= ~NOTIFIED;
        return false;
      }
      
      // If OUTDATED, must recompute
      if (flags & OUTDATED) {
        return this._recompute();
      }
      
      // NOTIFIED only - check if sources actually changed
      let source = this._sources;
      while (source) {
        const sourceNode = source.source;
        
        // Check if source is a computed that needs updating
        if ('_updateIfNeeded' in sourceNode) {
          // Recursively update the source
          if ((sourceNode as Computed<any>)._updateIfNeeded()) {
            this._flags |= OUTDATED;
            return this._recompute();
          }
          // Update our edge version to match source
          source.version = sourceNode._version;
        } else {
          // For signals, just check version
          if (source.version !== sourceNode._version) {
            this._flags |= OUTDATED;
            return this._recompute();
          }
        }
        
        source = source.nextSource;
      }
      
      // All sources clean, clear NOTIFIED
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
