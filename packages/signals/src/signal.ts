// Signal implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Edge, Producer } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers } from './helpers/node-pool';
import { createDependencyHelpers } from './helpers/dependency-tracking';

const { RUNNING } = CONSTANTS;

export interface SignalInterface<T = unknown> extends Producer<T> {
  __type: 'signal';
  value: T;
  _value: T;
  // Object/array update methods
  set<K extends keyof T>(key: K, value: T[K]): void;
  patch<K extends keyof T>(
    key: K,
    partial: T[K] extends object ? Partial<T[K]> : never
  ): void;
}

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>> {
  const { addDependency } = createDependencyHelpers(createNodePoolHelpers(ctx));
  
  class Signal<T> implements SignalInterface<T> {
    __type = 'signal' as const;
    _value: T;
    _targets: Edge | undefined = undefined;
    _lastEdge: Edge | undefined = undefined;
    _version = 0;

    constructor(value: T) {
      this._value = value;
    }

    get value(): T {
      const current = ctx.currentConsumer;

      if (!current || !(current._flags & RUNNING)) return this._value;

      addDependency(this, current, this._version);
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
        node.target._invalidate();
        node = node.nextTarget;
      }
    }

    set(key: unknown, value: unknown): void {
      const currVal = this._value;
      if (Array.isArray(currVal)) {
        const arr = [...currVal];
        arr[key as number] = value;
        this.value = arr as T;
      } else if (typeof currVal === 'object' && currVal !== null) {
        this.value = { ...currVal, [key as keyof T]: value };
      }
    }

    patch(key: unknown, partial: unknown): void {
      const currVal = this._value;

      if (Array.isArray(currVal)) {
        const arr = [...currVal];
        const index = key as number;
        const current = arr[index];
        arr[index] =
          typeof current === 'object' && current !== null
            ? { ...current, ...(partial as object) }
            : partial;
        this.value = arr as T;
      } else if (typeof currVal === 'object' && currVal !== null) {
        const objKey = key as keyof T;
        const current = currVal[objKey];
        this.value = {
          ...currVal,
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

  return {
    name: 'signal',
    method: <T>(value: T): SignalInterface<T> => new Signal(value)
  };
}