import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createDependencyHelpers, EdgeCache } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;
  _callback(): T;
  _value: T | undefined;
  _globalVersion: number;
  _recompute(): void;
  _checkDirty(): boolean;
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
      if (
        consumer
          && '_flags' in consumer
          && typeof consumer._flags === 'number'
          && consumer._flags & RUNNING
      ) {
        addDependency(this, consumer, this._version);
      }
      
      // Push-pull: Check if NOTIFIED but not OUTDATED (lazy dirty checking)
      if (this._flags & NOTIFIED && !(this._flags & OUTDATED)) {
        if (this._checkDirty()) {
          this._flags |= OUTDATED;
        } else {
          this._flags &= ~NOTIFIED;  // Clear notified, it's clean
        }
      }
      
      // Recompute if outdated
      if (this._flags & OUTDATED) this._recompute();
      
      return this._value!;
    }

    peek(): T {
      // Push-pull: Check if NOTIFIED but not OUTDATED (lazy dirty checking)
      if (this._flags & NOTIFIED && !(this._flags & OUTDATED)) {
        if (this._checkDirty()) {
          this._flags |= OUTDATED;
        } else {
          this._flags &= ~NOTIFIED;  // Clear notified, it's clean
        }
      }
      
      if (this._flags & OUTDATED) this._recompute();
      return this._value!;
    }

    _recompute(): void {
      // Fast path: if global version hasn't changed, nothing can have changed
      if (this._globalVersion === ctx.version) {
        this._flags &= ~(OUTDATED | NOTIFIED);
        return;
      }
      
      // Early exit if sources haven't changed (skip for first run)
      if (this._version > 0 && !this._sourcesChanged()) {
        this._flags &= ~(OUTDATED | NOTIFIED);
        this._globalVersion = ctx.version;
        return;
      }

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
      
      try {
        const newValue = this._callback();
        
        // Update value if changed or first run
        if (newValue !== this._value || this._version === 0) {
          this._value = newValue;
          this._version++;
        }
        
        // Update global version after computation
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
    }

    _invalidate(): void {
      // Skip if already notified, disposed, or currently recomputing
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      // Mark as outdated and notified
      this._flags |= NOTIFIED | OUTDATED;

      // Propagate invalidation to dependent computeds/effects
      let target = this._targets;
      while (target) {
        target.target._invalidate();
        target = target.nextTarget!;
      }
    }

    _sourcesChanged(): boolean {
      let source = this._sources;
      while (source) {
        // Check version mismatch
        if (source.version !== source.source._version) return true;
        
        // Check if computed source needs update
        if (
          '_flags' in source.source
          && typeof source.source._flags === 'number'
          && source.source._flags & OUTDATED
        ) {
          return true;
        }
        
        source = source.nextSource;
      }
      return false;
    }

    /**
     * Lazy dirty checking for push-pull algorithm.
     * Recursively checks if any dependencies have actually changed.
     * Returns true if this computed needs to be recomputed.
     */
    _checkDirty(): boolean {
      // Fast path: global version hasn't changed
      if (this._globalVersion === ctx.version) {
        return false;
      }
      
      // Check each source
      let edge = this._sources;
      while (edge) {
        const source = edge.source;
        
        // If source is a computed that's NOTIFIED, recursively check it
        if ('_flags' in source && '_checkDirty' in source) {
          const computedSource = source as unknown as ComputedInterface;
          if (computedSource._flags & NOTIFIED) {
            if (computedSource._checkDirty()) {
              return true;  // Source is dirty, so we are too
            }
          }
        }
        
        // Check version mismatch
        if (edge.version !== source._version) {
          return true;  // Source changed
        }
        
        edge = edge.nextSource;
      }
      
      // All sources are clean, update global version
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
