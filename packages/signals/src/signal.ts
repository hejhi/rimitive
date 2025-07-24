// Signal implementation with factory pattern for performance
import type { SignalContext } from './context';
import { RUNNING } from './context';
import { Signal as SignalInterface, DependencyNode } from './types'

export function createSignalFactory(ctx: SignalContext) {
  class Signal<T> implements SignalInterface<T> {
    __type = 'signal' as const;
    _value: T;
    _version = 0;
    _targets: DependencyNode | undefined = undefined;
    _node: DependencyNode | undefined = undefined;

    constructor(value: T) {
      this._value = value;
    }

    get value(): T {
      // Fast path: no tracking needed
      if (!ctx.currentComputed || !(ctx.currentComputed._flags & RUNNING)) {
        return this._value;
      }

      const current = ctx.currentComputed;

      // Node reuse pattern - check if we can reuse existing node
      let node = this._node;
      if (node !== undefined && node.target === current) {
        node.version = this._version;
        return this._value;
      }

      // Check if already tracking this signal in current computed
      node = current._sources;
      while (node) {
        if (node.source === this) {
          node.version = this._version;
          return this._value;
        }
        node = node.nextSource;
      }

      // Create new dependency node - INLINE acquireNode for performance
      ctx.allocations++;
      const newNode =
        ctx.poolSize > 0
          ? (ctx.poolHits++, ctx.nodePool[--ctx.poolSize]!)
          : (ctx.poolMisses++, {} as DependencyNode);

      newNode.source = this;
      newNode.target = current;
      newNode.version = this._version;
      newNode.nextSource = current._sources;
      newNode.nextTarget = this._targets;
      newNode.prevSource = undefined;
      newNode.prevTarget = undefined;

      if (current._sources) {
        current._sources.prevSource = newNode;
      }
      current._sources = newNode;

      if (this._targets) {
        this._targets.prevTarget = newNode;
      }
      this._targets = newNode;

      // Store node for reuse
      this._node = newNode;

      return this._value;
    }

    set value(value: T) {
      if (this._value === value) return;

      this._value = value;
      this._version++;
      ctx.version++;

      // Notify all targets
      let node = this._targets;
      while (node) {
        node.target._notify();
        node = node.nextTarget;
      }
    }

    _refresh(): boolean {
      return true;
    }

    set(key: unknown, value: unknown): void {
      if (Array.isArray(this._value)) {
        const arr = [...this._value];
        const index = key as number;
        arr[index] = value;
        this.value = arr as T;
      } else if (typeof this._value === 'object' && this._value !== null) {
        const objKey = key as keyof T;
        this.value = { ...this._value, [objKey]: value } as T;
      }
    }

    patch(key: unknown, partial: unknown): void {
      if (Array.isArray(this._value)) {
        const arr = [...this._value];
        const index = key as number;
        const current = arr[index];
        arr[index] =
          typeof current === 'object' && current !== null
            ? { ...current, ...(partial as object) }
            : partial;
        this.value = arr as T;
      } else if (typeof this._value === 'object' && this._value !== null) {
        const objKey = key as keyof T;
        const current = this._value[objKey];
        this.value = {
          ...this._value,
          [objKey]:
            typeof current === 'object' && current !== null
              ? { ...current, ...(partial as object) }
              : partial,
        } as T;
      }
    }

    peek(): T {
      return this._value;
    }
  }

  return function signal<T>(value: T): SignalInterface<T> {
    return new Signal(value);
  };
}