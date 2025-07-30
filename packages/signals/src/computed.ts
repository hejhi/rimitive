import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Readable, ProducerNode, ConsumerNode, StatefulNode, Disposable } from './types';
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
      this._addDependency(ctx.currentConsumer);
      
      // Early return if we're up to date and not outdated
      if (!(this._flags & OUTDATED) && this._version > 0) {
        return this._value!;
      }
      
      this._recompute();
      return this._value!;
    }

    _recompute(): boolean {
      // Clear NOTIFIED flag early to prevent duplicate work
      this._flags &= ~NOTIFIED;

      if (this._flags & RUNNING) throw new Error('Cycle detected');
      
      // Skip if already up to date
      if (this._isUpToDate()) {
        this._flags &= ~OUTDATED;
        return true;
      }

      this._flags |= RUNNING;

      if (this._version > 0 && !this._checkSources()) {
        this._flags &= ~RUNNING;
        return true;
      }

      const prevConsumer = ctx.currentConsumer;
      try {
        this._prepareSourcesTracking();
        ctx.currentConsumer = this;
        this._updateValue();
        this._lastComputedAt = ctx.version;
      } finally {
        ctx.currentConsumer = prevConsumer;
        this._cleanupSources();
        this._flags &= ~RUNNING;
      }

      return true;
    }

    _invalidate(): void {
      // Early exit if already notified or disposed
      if (this._flags & (NOTIFIED | DISPOSED)) return;
      
      // Mark as notified and outdated
      this._flags |= NOTIFIED | OUTDATED;

      // Skip propagation if we're already in the process of recomputing
      // This helps with diamond patterns and grid propagation
      if (this._flags & RUNNING) return;

      // Only propagate if we have targets
      if (!this._targets) return;

      // In batch mode, we can propagate more efficiently
      if (ctx.batchDepth > 0) {
        let node = this._targets;
        while (node) {
          const target = node.target;
          // Check if target is already notified to avoid redundant work
          if ('_flags' in target && !((target as StatefulNode)._flags & NOTIFIED)) {
            target._invalidate();
          }
          node = node.nextTarget!;
        }
      } else {
        // Not in batch, propagate normally
        let node = this._targets;
        while (node) {
          node.target._invalidate();
          node = node.nextTarget!;
        }
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

    _addDependency(target: ConsumerNode | null): void {
      if (!target || !('_flags' in target) || !((target as StatefulNode)._flags & RUNNING)) return;

      addDependency(this, target, this._version);
    }

    _isUpToDate(): boolean {
      return (
        !(this._flags & OUTDATED) &&
        this._version > 0 &&
        this._lastComputedAt === ctx.version
      );
    }

    _checkSources(): boolean {
      for (
        let node = this._sources;
        node !== undefined;
        node = node.nextSource
      ) {
        const source = node.source;

        // For computed sources, just check if they're outdated
        // Don't force recomputation here - let lazy evaluation handle it
        if ('_flags' in source && (source as StatefulNode)._flags & OUTDATED) {
          return true;
        }
        if (node.version !== source._version) return true;
      }
      return false;
    }

    _prepareSourcesTracking(): void {
      for (
        let node = this._sources;
        node !== undefined;
        node = node.nextSource
      ) {
        node.version = -1;
      }
    }

    _updateValue(): boolean {
      const newValue = this._callback();
      const changed = newValue !== this._value || this._version === 0;
      if (changed) {
        this._value = newValue;
        this._version++;
      }
      return changed;
    }

    _cleanupSources(): void {
      cleanupSources(this);
    }
  }

  return {
    name: 'computed',
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
