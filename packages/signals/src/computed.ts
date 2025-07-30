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
  _lastComputedAt: number;
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
    _lastComputedAt = -1;
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;

    constructor(compute: () => T) {
      this._callback = compute;
    }

    get value(): T {
      // Add dependency if we're being tracked
      if (ctx.currentConsumer && '_flags' in ctx.currentConsumer && 
          (ctx.currentConsumer as StatefulNode)._flags & RUNNING) {
        addDependency(this, ctx.currentConsumer, this._version);
      }
      
      // Fast path: already up to date
      if (!(this._flags & OUTDATED) && this._version > 0) {
        return this._value!;
      }
      
      this._recompute();
      return this._value!;
    }

    _recompute(): boolean {
      // Clear flags early
      this._flags &= ~NOTIFIED;

      // Cycle detection
      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Fast path: already computed this version
      if (!(this._flags & OUTDATED) && this._version > 0 && this._lastComputedAt === ctx.version) {
        return true;
      }

      this._flags |= RUNNING;
      this._flags &= ~OUTDATED;

      // Check if sources changed (lazy evaluation)
      if (this._version > 0 && !this._sourcesChanged()) {
        this._flags &= ~RUNNING;
        this._lastComputedAt = ctx.version;
        return true;
      }

      // Prepare for tracking
      this._prepareTracking();
      const prevConsumer = ctx.currentConsumer;
      ctx.currentConsumer = this;
      
      try {
        const newValue = this._callback();
        if (newValue !== this._value || this._version === 0) {
          this._value = newValue;
          this._version++;
        }
        this._lastComputedAt = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        cleanupSources(this);
        this._flags &= ~RUNNING;
      }

      return true;
    }

    _invalidate(): void {
      // Early exit if already handled
      if (this._flags & (NOTIFIED | DISPOSED | RUNNING)) return;
      
      // Mark as notified and outdated
      this._flags |= NOTIFIED | OUTDATED;

      // Propagate to targets
      let node = this._targets;
      while (node) {
        const target = node.target;
        // In batch mode, check if already notified
        if (ctx.batchDepth === 0 || !('_flags' in target) || !((target as StatefulNode)._flags & NOTIFIED)) {
          target._invalidate();
        }
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
      this._recompute();
      return this._value!;
    }


    _sourcesChanged(): boolean {
      let node = this._sources;
      while (node) {
        const source = node.source;
        // Check version mismatch or outdated computed sources
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
