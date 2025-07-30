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
  _recompute(): void;
  dispose(): void;
}

const {
  RUNNING,
  DISPOSED,
  OUTDATED,
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
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Track dependency if we're in a computation context
      const consumer = ctx.currentConsumer;
      if (consumer && '_flags' in consumer && (consumer as StatefulNode)._flags & RUNNING) {
        addDependency(this, consumer, this._version);
      }
      
      // Recompute if outdated
      if (this._flags & OUTDATED) this._recompute();
      
      return this._value!;
    }

    peek(): T {
      if (this._flags & OUTDATED) this._recompute();
      return this._value!;
    }

    _recompute(): void {
      // Early exit if sources haven't changed (skip for first run)
      if (this._version > 0 && !this._sourcesChanged()) {
        this._flags &= ~OUTDATED;
        return;
      }

      // Set running flag and clear outdated
      this._flags = (this._flags | RUNNING) & ~OUTDATED;
      
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
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._flags &= ~RUNNING;
        cleanupSources(this);
      }
    }

    _invalidate(): void {
      // Skip if already outdated (no need to propagate again)
      if (this._flags & OUTDATED) return;
      
      // Mark as outdated
      this._flags |= OUTDATED;

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
        if ('_flags' in source.source && (source.source as StatefulNode)._flags & OUTDATED) {
          return true;
        }
        
        source = source.nextSource;
      }
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
