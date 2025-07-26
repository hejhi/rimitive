import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Computed as ComputedInterface, Consumer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';
import { isComputed } from './type-guards';

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
    _compute: () => T;
    _value: T | undefined = undefined;
    _lastComputedAt = -1;

    // Graph information
    _sources: Edge | undefined = undefined;
    _flags = OUTDATED | IS_COMPUTED;

    _targets: Edge | undefined = undefined;
    _node: Edge | undefined = undefined;
    _version = 0;

    constructor(compute: () => T) {
      this._compute = compute;
    }

    get value(): T {
      this._addDependency(ctx.currentConsumer);
      this._recompute();
      return this._value!;
    }

    _recompute(): boolean {
      this._flags &= ~NOTIFIED;

      if (this._flags & RUNNING) {
        throw new Error('Cycle detected');
      }

      if (this._isUpToDate()) {
        return true;
      }

      this._flags &= ~OUTDATED;
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

    _notify(): void {
      if (!(this._flags & NOTIFIED)) {
        this._flags |= NOTIFIED | OUTDATED;

        let node = this._targets;
        while (node) {
          node.target._notify();
          node = node.nextTarget;
        }
      }
    }

    dispose(): void {
      if (!(this._flags & DISPOSED)) {
        this._flags |= DISPOSED;
        disposeAllSources(this);
        this._value = undefined;
      }
    }

    peek(): T {
      this._recompute();
      return this._value!;
    }

    _addDependency(target: Consumer | null): void {
      if (!target || !(target._flags & RUNNING)) return;

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
        
        // If source is a computed, ensure it's up to date
        if (isComputed(source)) source._recompute();

        if (node.version !== source._version) {
          return true;
        }
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
      const newValue = this._compute();
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
    method: function computed<T>(compute: () => T): ComputedInterface<T> {
      return new Computed(compute);
    }
  };
}

export function createUntrackFactory(ctx: SignalContext): LatticeExtension<'untrack', <T>(fn: () => T) => T> {
  return {
    name: 'untrack',
    method: function untrack<T>(fn: () => T): T {
      const prev = ctx.currentConsumer;
      ctx.currentConsumer = null;
      try {
        return fn();
      } finally {
        ctx.currentConsumer = prev;
      }
    }
  };
}