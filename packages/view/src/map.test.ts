import { describe, it, expect } from 'vitest';
import { createMapFactory } from './map';
import { createViewContext } from './context';
import {
  createMockRenderer,
  createSignal,
  createRefSpec,
  type MockElement,
  type MockText,
  type Reactive,
} from './test-utils';

describe('map primitive', () => {
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item // Key by primitive value
      );

      // Create parent and initialize list
      const parent = renderer.createElement('ul');
      listRef(parent);

      // User cares: all items displayed
      expect(parent.children).toHaveLength(3);
      const itemElements = parent.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('a');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');

      // Add items
      setItems(['a', 'b', 'c', 'd', 'e']);

      // User cares: new items added
      expect(parent.children).toHaveLength(5);
      expect((itemElements[3]!.children[0] as MockText).content).toBe('d');
      expect((itemElements[4]!.children[0] as MockText).content).toBe('e');

      // Remove items
      setItems(['a', 'e']);

      // User cares: items removed
      expect(parent.children).toHaveLength(2);
      const updatedElements = parent.children as MockElement[];
      expect((updatedElements[0]!.children[0] as MockText).content).toBe('a');
      expect((updatedElements[1]!.children[0] as MockText).content).toBe('e');

      // Clear list
      setItems([]);

      // User cares: all items removed
      expect(parent.children).toHaveLength(0);
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item // Key by primitive value
      );

      // Create parent and initialize list
      const parent = renderer.createElement('ul');
      listRef(parent);

      // Store reference to first element
      const firstElement = parent.children[0];

      // Reverse order
      setItems(['c', 'b', 'a']);

      // User cares: order changed
      const itemElements = parent.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('c');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('a');

      // User cares: same element instances (not re-rendered)
      expect(parent.children[2]).toBe(firstElement);
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal().name);
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item.id // Key by ID (not identity)
      );

      // Create parent and initialize list
      const parent = renderer.createElement('ul');
      listRef(parent);

      // Store element reference
      const aliceElement = parent.children[0];

      // Reorder same objects
      setItems([objC, objA, objB]);

      // User cares: same objects recognized by identity
      expect(parent.children[1]).toBe(aliceElement);
      const itemElements = parent.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('Charlie');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('Alice');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('Bob');
    });

    it('maintains position when list becomes empty then refills with siblings present', () => {
      const ctx = createViewContext();
      const { renderer } = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a', 'b']);
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item
      );

      // Create parent with map in middle - wrapped properly
      const header = renderer.createElement('li');
      const headerText = renderer.createTextNode('HEADER');
      renderer.appendChild(header, headerText);

      const footer = renderer.createElement('li');
      const footerText = renderer.createTextNode('FOOTER');
      renderer.appendChild(footer, footerText);

      const parent = renderer.createElement('ul');
      renderer.appendChild(parent, header);
      // Map gets nextSibling reference to footer when processed as sibling
      listRef(parent, footer); // Pass footer as nextSibling explicitly
      renderer.appendChild(parent, footer);

      // Initial: HEADER, a, b, FOOTER
      expect(parent.children).toHaveLength(4);
      expect((parent.children[0] as MockElement).children[0] as MockText).toHaveProperty('content', 'HEADER');
      expect((parent.children[1] as MockElement).children[0] as MockText).toHaveProperty('content', 'a');
      expect((parent.children[2] as MockElement).children[0] as MockText).toHaveProperty('content', 'b');
      expect((parent.children[3] as MockElement).children[0] as MockText).toHaveProperty('content', 'FOOTER');

      // Empty the list
      setItems([]);

      // Should be: HEADER, FOOTER
      expect(parent.children).toHaveLength(2);
      expect((parent.children[0] as MockElement).children[0] as MockText).toHaveProperty('content', 'HEADER');
      expect((parent.children[1] as MockElement).children[0] as MockText).toHaveProperty('content', 'FOOTER');

      // Refill the list
      setItems(['c', 'd']);

      // Should maintain position: HEADER, c, d, FOOTER
      // WITHOUT nextSibling tracking, items might append at end: HEADER, FOOTER, c, d
      expect(parent.children).toHaveLength(4);
      expect((parent.children[0] as MockElement).children[0] as MockText).toHaveProperty('content', 'HEADER');
      expect((parent.children[1] as MockElement).children[0] as MockText).toHaveProperty('content', 'c');
      expect((parent.children[2] as MockElement).children[0] as MockText).toHaveProperty('content', 'd');
      expect((parent.children[3] as MockElement).children[0] as MockText).toHaveProperty('content', 'FOOTER');
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal().name);
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item.id // key by ID
      );

      // Create parent and initialize list
      const parent = renderer.createElement('ul');
      listRef(parent);

      // Store element reference
      const aliceElement = parent.children[0];

      // Update with new objects but same IDs
      setItems([
        { id: 1, name: 'Alicia' }, // different object, same ID
        { id: 2, name: 'Robert' },
      ]);

      // User cares: items recognized by key, not identity
      // Same elements reused
      expect(parent.children[0]).toBe(aliceElement);
      expect(parent.children).toHaveLength(2);
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
      const map = createMapFactory({ ctx, signal, effect, renderer }).method;

      const listRef = map(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createRefSpec(element);
        },
        (item) => item // Key by primitive value
      );

      // Create parent and initialize list
      const parent = renderer.createElement('ul');
      listRef(parent);

      // Store reference to 'd' element
      const dElement = parent.children[3];

      // Transform: d e c (removed: a, b; added: e; reordered: d, c)
      setItems(['d', 'e', 'c']);

      // User cares: final state correct
      expect(parent.children).toHaveLength(3);
      const itemElements = parent.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('d');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('e');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');

      // User cares: existing elements reused
      expect(parent.children[0]).toBe(dElement);
    });
  });
});
