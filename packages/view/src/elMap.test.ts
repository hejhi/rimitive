import { describe, it, expect } from 'vitest';
import { createElMapFactory } from './elMap';
import { createViewContext } from './context';
import {
  createMockRenderer,
  createSignal,
  createElementRef,
  type MockElement,
  type MockText,
  type Reactive,
} from './test-utils';

describe('elMap primitive', () => {
  describe('list rendering', () => {
    it('displays items in list', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a', 'b', 'c']);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        },
        (item) => item // Key by primitive value
      );

      // User cares: all items displayed
      expect(ref.element.children).toHaveLength(3);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('a');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');

      // Add items
      setItems(['a', 'b', 'c', 'd', 'e']);

      // User cares: new items added
      expect(ref.element.children).toHaveLength(5);
      expect((itemElements[3]!.children[0] as MockText).content).toBe('d');
      expect((itemElements[4]!.children[0] as MockText).content).toBe('e');

      // Remove items
      setItems(['a', 'e']);

      // User cares: items removed
      expect(ref.element.children).toHaveLength(2);
      const updatedElements = ref.element.children as MockElement[];
      expect((updatedElements[0]!.children[0] as MockText).content).toBe('a');
      expect((updatedElements[1]!.children[0] as MockText).content).toBe('e');

      // Clear list
      setItems([]);

      // User cares: all items removed
      expect(ref.element.children).toHaveLength(0);
    });
  });

  describe('reordering', () => {
    it('preserves elements when reordering', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a', 'b', 'c']);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        },
        (item) => item // Key by primitive value
      );

      // Store reference to first element
      const firstElement = ref.element.children[0];

      // Reverse order
      setItems(['c', 'b', 'a']);

      // User cares: order changed
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('c');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('a');

      // User cares: same element instances (not re-rendered)
      expect(ref.element.children[2]).toBe(firstElement);
    });
  });

  describe('identity-based tracking', () => {
    it('uses ID for tracking instead of identity', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();

      const objA = { id: 1, name: 'Alice' };
      const objB = { id: 2, name: 'Bob' };
      const objC = { id: 3, name: 'Charlie' };

      const { read: items, write: setItems, subscribers } = createSignal([objA, objB, objC]);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal().name);
          renderer.appendChild(element, text);
          return createElementRef(element);
        },
        (item) => item.id // Key by ID (not identity)
      );

      // Store element reference
      const aliceElement = ref.element.children[0];

      // Reorder same objects
      setItems([objC, objA, objB]);

      // User cares: same objects recognized by identity
      expect(ref.element.children[1]).toBe(aliceElement);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('Charlie');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('Alice');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('Bob');
    });

    it('uses custom keyFn for tracking', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();

      const { read: items, write: setItems, subscribers } = createSignal([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal().name);
          renderer.appendChild(element, text);
          return createElementRef(element);
        },
        (item) => item.id // key by ID
      );

      // Store element reference
      const aliceElement = ref.element.children[0];

      // Update with new objects but same IDs
      setItems([
        { id: 1, name: 'Alicia' }, // different object, same ID
        { id: 2, name: 'Robert' },
      ]);

      // User cares: items recognized by key, not identity
      // Same elements reused
      expect(ref.element.children[0]).toBe(aliceElement);
      expect(ref.element.children).toHaveLength(2);
    });
  });

  describe('complex operations', () => {
    it('handles add + remove + reorder in single update', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a', 'b', 'c', 'd']);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => {
        subscribers.add(fn);
        fn();
        return () => subscribers.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        },
        (item) => item // Key by primitive value
      );

      // Store reference to 'd' element
      const dElement = ref.element.children[3];

      // Transform: d e c (removed: a, b; added: e; reordered: d, c)
      setItems(['d', 'e', 'c']);

      // User cares: final state correct
      expect(ref.element.children).toHaveLength(3);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('d');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('e');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');

      // User cares: existing elements reused
      expect(ref.element.children[0]).toBe(dElement);
    });
  });
});
