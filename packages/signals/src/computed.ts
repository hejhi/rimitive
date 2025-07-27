import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Consumer, Producer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';
import { createDependencyHelpers } from './helpers/dependency-tracking';
import { createSourceCleanupHelpers } from './helpers/source-cleanup';

export interface ComputedInterface<T = unknown> extends Producer<T>, Consumer {
  __type: 'computed';
  readonly value: T;
  peek(): T;
  _compute(): T;
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
    _compute: () => T;
    _value: T | undefined = undefined;
    _lastComputedAt = -1;
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

      if (this._flags & RUNNING) throw new Error('Cycle detected');
      if (this._isUpToDate()) return true;

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
      if (this._flags & NOTIFIED) return;
      this._flags |= NOTIFIED | OUTDATED;

      let node = this._targets;
      while (node) {
        node.target._notify();
        node = node.nextTarget;
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
        // TODO: add Maybe type here? like source: Maybe<Computed<T>>?
        const source = node.source;
        
        if ('_recompute' in source && typeof source._recompute === 'function') {
          (source as Computed<T>)._recompute();
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
    method: <T>(compute: () => T): ComputedInterface<T> => new Computed(compute)
  };
}
