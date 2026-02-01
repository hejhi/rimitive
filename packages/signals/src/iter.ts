/**
 * Reactive Linked List - O(1) operations with dependency tracking
 */

import { defineModule } from '@rimitive/core';
import {
  SignalModule,
  type SignalFactory,
  type SignalFunction,
} from './signal';

export type IterNode<T> = {
  key: string | number;
  value: T;
  prev: IterNode<T> | null;
  next: IterNode<T> | null;
};

export type Iter<T> = {
  (): T[];
  [Symbol.iterator](): Iterator<T>;
  append(value: T): IterNode<T>;
  prepend(value: T): IterNode<T>;
  insertBefore(refKey: string | number, value: T): IterNode<T> | null;
  insertAfter(refKey: string | number, value: T): IterNode<T> | null;
  remove(key: string | number): IterNode<T> | null;
  update(value: T): { node: IterNode<T>; oldValue: T } | null;
  moveBefore(
    key: string | number,
    refKey: string | number | null
  ): IterNode<T> | null;
  moveNodeBefore(node: IterNode<T>, refNode: IterNode<T> | null): IterNode<T>;
  clear(): void;
  get(key: string | number): T | undefined;
  has(key: string | number): boolean;
  getNode(key: string | number): IterNode<T> | undefined;
  peek(): T[];
  peekKeys(): IterableIterator<string | number>;
  keys(): IterableIterator<string | number>;
  nodes(): IterableIterator<IterNode<T>>;
  readonly size: number;
  readonly head: IterNode<T> | null;
  readonly tail: IterNode<T> | null;
  readonly keyFn: (value: T) => string | number;
};

export type IterDeps = { signal: SignalFactory };
export type IterFactory = <T>(
  keyFn: (value: T) => string | number,
  initialItems?: T[]
) => Iter<T>;

export function createIterFactory(deps: IterDeps): IterFactory {
  const { signal } = deps;

  return function createIter<T>(
    keyFn: (value: T) => string | number,
    initialItems?: T[]
  ): Iter<T> {
    const version: SignalFunction<number> = signal(0);
    let head: IterNode<T> | null = null;
    let tail: IterNode<T> | null = null;
    const byKey = new Map<string | number, IterNode<T>>();

    const notify = () => version(version.peek() + 1);

    const unlinkNode = (node: IterNode<T>): void => {
      if (node.prev) node.prev.next = node.next;
      else head = node.next;
      if (node.next) node.next.prev = node.prev;
      else tail = node.prev;
    };

    const linkBefore = (node: IterNode<T>, ref: IterNode<T> | null): void => {
      if (ref === null) {
        node.prev = tail;
        node.next = null;
        if (tail) tail.next = node;
        else head = node;
        tail = node;
        return;
      }

      node.prev = ref.prev;
      node.next = ref;
      if (ref.prev) ref.prev.next = node;
      else head = node;
      ref.prev = node;
    };

    const createNode = (key: string | number, value: T): IterNode<T> => {
      const node: IterNode<T> = { key, value, prev: null, next: null };
      byKey.set(key, node);
      return node;
    };

    const append = (value: T): IterNode<T> => {
      const key = keyFn(value);
      if (byKey.has(key)) throw new Error(`Key "${key}" already exists`);
      const node = createNode(key, value);
      linkBefore(node, null);
      notify();
      return node;
    };

    const prepend = (value: T): IterNode<T> => {
      const key = keyFn(value);
      if (byKey.has(key)) throw new Error(`Key "${key}" already exists`);
      const node = createNode(key, value);
      linkBefore(node, head);
      notify();
      return node;
    };

    const insertBefore = (
      refKey: string | number,
      value: T
    ): IterNode<T> | null => {
      const ref = byKey.get(refKey);
      if (!ref) return null;
      const key = keyFn(value);
      if (byKey.has(key)) throw new Error(`Key "${key}" already exists`);
      const node = createNode(key, value);
      linkBefore(node, ref);
      notify();
      return node;
    };

    const insertAfter = (
      refKey: string | number,
      value: T
    ): IterNode<T> | null => {
      const ref = byKey.get(refKey);
      if (!ref) return null;
      const key = keyFn(value);
      if (byKey.has(key)) throw new Error(`Key "${key}" already exists`);
      const node = createNode(key, value);
      linkBefore(node, ref.next);
      notify();
      return node;
    };

    const remove = (key: string | number): IterNode<T> | null => {
      const node = byKey.get(key);
      if (!node) return null;
      byKey.delete(key);
      unlinkNode(node);
      notify();
      return node;
    };

    const update = (value: T): { node: IterNode<T>; oldValue: T } | null => {
      const key = keyFn(value);
      const node = byKey.get(key);
      if (!node) return null;
      const oldValue = node.value;
      node.value = value;
      notify();
      return { node, oldValue };
    };

    const moveBefore = (
      key: string | number,
      refKey: string | number | null
    ): IterNode<T> | null => {
      const node = byKey.get(key);
      if (!node) return null;
      const ref = refKey !== null ? (byKey.get(refKey) ?? null) : null;
      if (refKey !== null && !ref) return null;
      if (ref === null && node === tail) return node;
      if (ref !== null && node.next === ref) return node;
      unlinkNode(node);
      linkBefore(node, ref);
      notify();
      return node;
    };

    const moveNodeBefore = (
      node: IterNode<T>,
      refNode: IterNode<T> | null
    ): IterNode<T> => {
      if (refNode === null && node === tail) return node;
      if (refNode !== null && node.next === refNode) return node;
      unlinkNode(node);
      linkBefore(node, refNode);
      notify();
      return node;
    };

    const clear = (): void => {
      head = tail = null;
      byKey.clear();
      notify();
    };

    const toArray = (): T[] => {
      const result: T[] = [];
      for (let cur = head; cur; cur = cur.next) result.push(cur.value);
      return result;
    };

    function* iterateValues(): Iterator<T> {
      version();
      for (let cur = head; cur; cur = cur.next) yield cur.value;
    }

    function* iterateNodes(): IterableIterator<IterNode<T>> {
      version();
      for (let cur = head; cur; cur = cur.next) yield cur;
    }

    function* iterateKeys(): IterableIterator<string | number> {
      version();
      for (let cur = head; cur; cur = cur.next) yield cur.key;
    }

    function* peekKeys(): IterableIterator<string | number> {
      for (let cur = head; cur; cur = cur.next) yield cur.key;
    }

    // Initialize with items
    if (initialItems) {
      for (const item of initialItems) {
        const key = keyFn(item);
        if (byKey.has(key)) throw new Error(`Key "${key}" already exists`);
        const node = createNode(key, item);
        linkBefore(node, null);
      }
    }

    function iter(): T[] {
      version();
      return toArray();
    }

    iter.append = append;
    iter.prepend = prepend;
    iter.insertBefore = insertBefore;
    iter.insertAfter = insertAfter;
    iter.remove = remove;
    iter.update = update;
    iter.moveBefore = moveBefore;
    iter.moveNodeBefore = moveNodeBefore;
    iter.clear = clear;
    iter.get = (key: string | number) => byKey.get(key)?.value;
    iter.has = (key: string | number) => byKey.has(key);
    iter.getNode = (key: string | number) => byKey.get(key);
    iter.peek = toArray;
    iter.peekKeys = peekKeys;
    iter.keys = iterateKeys;
    iter.nodes = iterateNodes;
    iter[Symbol.iterator] = iterateValues;
    iter.keyFn = keyFn;

    Object.defineProperties(iter, {
      size: {
        get: () => {
          version();
          return byKey.size;
        },
      },
      head: { get: () => head },
      tail: { get: () => tail },
    });

    return iter as Iter<T>;
  };
}

export const IterModule = defineModule({
  name: 'iter',
  dependencies: [SignalModule],
  create: ({ signal }: { signal: SignalFactory }) =>
    createIterFactory({ signal }),
});
