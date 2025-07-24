// Computed implementation with factory pattern for performance
import type { SignalContext } from './context';
import { MAX_POOL_SIZE, removeFromTargets } from './context';
import { DependencyNode, Computed as ComputedInterface, Effect } from './types';
import type { LatticeExtension } from '@lattice/lattice';

// Inline constants for hot path performance
const RUNNING = 1 << 2;
const DISPOSED = 1 << 3;
const OUTDATED = 1 << 1;
const NOTIFIED = 1 << 0;
const TRACKING = 1 << 4;
const IS_COMPUTED = 1 << 5;

export function createComputedFactory(ctx: SignalContext): LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>> {
  class Computed<T> implements ComputedInterface<T> {
    __type = 'computed' as const;
    _compute: () => T;
    _value: T | undefined = undefined;
    _version = 0;
    _globalVersion = -1;
    _flags = OUTDATED | IS_COMPUTED;
    _sources: DependencyNode | undefined = undefined;
    _targets: DependencyNode | undefined = undefined;
    _node: DependencyNode | undefined = undefined;

    constructor(compute: () => T) {
      this._compute = compute;
    }

    get value(): T {
      this._addDependency(ctx.currentComputed);
      this._refresh();
      return this._value!;
    }

    _refresh(): boolean {
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

      const prevComputed = ctx.currentComputed;
      try {
        this._prepareSourcesTracking();
        ctx.currentComputed = this;
        this._updateValue();
        this._globalVersion = ctx.version;
      } finally {
        ctx.currentComputed = prevComputed;
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
        this._disposeAllSources();
        this._value = undefined;
      }
    }

    peek(): T {
      this._refresh();
      return this._value!;
    }

    _addDependency(target: ComputedInterface | Effect | null): void {
      if (!target || !(target._flags & RUNNING)) return;

      const version = this._version;

      if (this._tryReuseNode(target, version)) return;
      if (this._findExistingDependency(target, version)) return;

      this._createNewDependency(target, version);
    }

    _tryReuseNode(
      target: ComputedInterface | Effect,
      version: number
    ): boolean {
      const node = this._node;
      if (node !== undefined && node.target === target) {
        node.version = version;
        return true;
      }
      return false;
    }

    _findExistingDependency(
      target: ComputedInterface | Effect,
      version: number
    ): boolean {
      let node = target._sources;
      while (node) {
        if (node.source === (this as ComputedInterface<T>)) {
          node.version = version;
          return true;
        }
        node = node.nextSource;
      }
      return false;
    }

    _createNewDependency(
      target: ComputedInterface | Effect,
      version: number
    ): void {
      // INLINE acquireNode for performance
      ctx.allocations++;
      const newNode =
        ctx.poolSize > 0
          ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
          : (ctx.poolMisses++, {} as DependencyNode);

      newNode.source = this;
      newNode.target = target;
      newNode.version = version;
      newNode.nextSource = target._sources;
      newNode.nextTarget = this._targets;
      newNode.prevSource = undefined;
      newNode.prevTarget = undefined;

      if (target._sources) {
        target._sources.prevSource = newNode;
      }
      target._sources = newNode;

      if (this._targets) {
        this._targets.prevTarget = newNode;
      } else {
        this._flags |= TRACKING;
      }
      this._targets = newNode;

      this._node = newNode;
    }

    _isUpToDate(): boolean {
      return (
        !(this._flags & OUTDATED) &&
        this._version > 0 &&
        this._globalVersion === ctx.version
      );
    }

    _checkSources(): boolean {
      for (
        let node = this._sources;
        node !== undefined;
        node = node.nextSource
      ) {
        const source = node.source;
        if (
          node.version !== source._version ||
          !source._refresh() ||
          node.version !== source._version
        ) {
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
      let node = this._sources;
      let prev: DependencyNode | undefined;

      while (node !== undefined) {
        const next = node.nextSource;

        if (node.version === -1) {
          this._removeNode(node, prev);
          // INLINE releaseNode
          if (ctx.poolSize < MAX_POOL_SIZE) {
            node.source = undefined!;
            node.target = undefined!;
            node.version = 0;
            node.nextSource = undefined;
            node.prevSource = undefined;
            node.nextTarget = undefined;
            node.prevTarget = undefined;
            ctx.nodePool[ctx.poolSize++] = node;
          }
        } else {
          prev = node;
        }

        node = next;
      }
    }

    _removeNode(node: DependencyNode, prev: DependencyNode | undefined): void {
      const next = node.nextSource;

      if (prev !== undefined) {
        prev.nextSource = next;
      } else {
        this._sources = next;
      }

      if (next !== undefined) {
        next.prevSource = prev;
      }

      removeFromTargets(node);
    }

    _disposeAllSources(): void {
      let node = this._sources;
      while (node) {
        const next = node.nextSource;
        removeFromTargets(node);

        // Inline releaseNode
        if (ctx.poolSize < MAX_POOL_SIZE) {
          node.source = undefined!;
          node.target = undefined!;
          node.version = 0;
          node.nextSource = undefined;
          node.prevSource = undefined;
          node.nextTarget = undefined;
          node.prevTarget = undefined;
          ctx.nodePool[ctx.poolSize++] = node;
        }

        node = next;
      }
      this._sources = undefined;
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
      const prev = ctx.currentComputed;
      ctx.currentComputed = null;
      try {
        return fn();
      } finally {
        ctx.currentComputed = prev;
      }
    }
  };
}