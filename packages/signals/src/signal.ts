// Signal implementation with factory pattern for performance
import { CONSTANTS } from './constants';
import type { SignalContext } from './context';
import { Signal as SignalInterface, DependencyNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import { createNodePoolHelpers, createDependencyHelpers } from './shared-helpers';

const { RUNNING } = CONSTANTS;

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>> {
  const pool = createNodePoolHelpers(ctx);
  const { addDependency } = createDependencyHelpers(pool);
  
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

      // Use helper to handle dependency
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

  return {
    name: 'signal',
    method: function signal<T>(value: T): SignalInterface<T> {
      return new Signal(value);
    }
  };
}