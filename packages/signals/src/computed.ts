import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, StatefulNode, Disposable } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers, EdgeCache } from './helpers/node-pool';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';

export interface ComputedInterface<T = unknown> extends Readable<T>, ProducerNode, EdgeCache, StatefulNode, Disposable {
  __type: 'computed';
  readonly value: T;
  _callback(): T;
  _value: T | undefined;
  _recompute(): boolean;
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
  const pool = createNodePoolHelpers(ctx);
  const { addDependency } = createDependencyHelpers(pool);
  const { disposeAllSources, cleanupSources } = createSourceCleanupHelpers(pool);
  
  class Computed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;
    _callback: () => T;
    _value: T | undefined = undefined;
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;

    constructor(compute: () => T) {
      this._callback = compute;
    }

    get value(): T {
      // Check for circular dependency
      if (this._flags & RUNNING) {
        throw new Error('Cycle detected');
      }
      
      // Add dependency if we're being tracked
      if (ctx.currentConsumer && '_flags' in ctx.currentConsumer && 
          (ctx.currentConsumer as StatefulNode)._flags & RUNNING) {
        addDependency(this, ctx.currentConsumer, this._version);
      }
      
      // Recompute if needed
      if (this._flags & OUTDATED) {
        this._recompute();
      }
      
      return this._value!;
    }

    _recompute(): boolean {
      // Clear notified flag
      this._flags &= ~NOTIFIED;
      
      // Check for cycles
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Mark as running
      this._flags |= RUNNING;
      
      // Check if sources actually changed
      if (this._version > 0 && !this._sourcesChanged()) {
        this._flags &= ~(RUNNING | OUTDATED);
        return true;
      }

      // Clear outdated flag after checking sources
      this._flags &= ~OUTDATED;
      
      // Mark dependencies for tracking
      this._prepareTracking();
      
      // Set up tracking context
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      try {
        const newValue = this._callback();
        if (newValue !== this._value || this._version === 0) {
          this._value = newValue;
          this._version++;
        }
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }

      return true;
    }

    _invalidate(): void {
      // Skip if already invalidated or disposed
      if (this._flags & (NOTIFIED | DISPOSED)) return;
      
      // Mark as outdated
      this._flags |= NOTIFIED | OUTDATED;

      // Propagate to targets
      let node = this._targets;
      while (node) {
        node.target._invalidate();
        node = node.nextTarget!;
      }
    }

    dispose(): void {
      if (this._flags & DISPOSED) return;
      this._flags |= DISPOSED;
      disposeAllSources(this);
      this._value = undefined;
    }

    peek(): T {
      // Use the same logic as value getter, but without tracking
      if (this._flags & OUTDATED) {
        this._recompute();
      }
      return this._value!;
    }


    _sourcesChanged(): boolean {
      let node = this._sources;
      while (node) {
        const source = node.source;
        // Check version mismatch or if computed source is outdated
        if (node.version !== source._version || 
            ('_flags' in source && (source as StatefulNode)._flags & OUTDATED)) {
          return true;
        }
        node = node.nextSource;
      }
      return false;
    }

    _prepareTracking(): void {
      let node = this._sources;
      while (node) {
        node.version = -1;
        node = node.nextSource;
      }
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
