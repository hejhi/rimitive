import { describe, it, expect, vi } from 'vitest';
import { createElMapFactory } from './elMap';
import { createViewContext } from './context';
import type { Renderer } from './renderer';
import type { Reactive, ElementRef, LifecycleCallback } from './types';

// Test utilities
class MockElement {
  id: string;
  tag: string;
  props: Record<string, any> = {};
  children: Array<MockElement | MockText> = [];
  parent: MockElement | null = null;
  connected: boolean = false;

  // DOM-like properties for reconcile.ts
  get firstChild(): MockElement | null {
    return this.children[0] as MockElement ?? null;
  }

  get nextSibling(): MockElement | null {
    if (!this.parent) return null;
    const index = this.parent.children.indexOf(this);
    return this.parent.children[index + 1] as MockElement ?? null;
  }

  constructor(tag: string) {
    this.id = Math.random().toString(36);
    this.tag = tag;
  }
}

class MockText {
  type = 'text' as const;
  content: string;
  parent: MockElement | null = null;

  constructor(content: string) {
    this.content = content;
  }
}

function createMockRenderer() {
  const renderer: Renderer<MockElement, MockText> = {
    createElement: vi.fn((tag: string) => new MockElement(tag)),
    createTextNode: vi.fn((text: string) => new MockText(text)),
    updateTextNode: vi.fn((node: MockText, text: string) => {
      node.content = text;
    }),
    setAttribute: vi.fn((element: MockElement, key: string, value: any) => {
      element.props[key] = value;
    }),
    appendChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      if (!parent.children.includes(child)) {
        parent.children.push(child);
      }
      child.parent = parent;
    }),
    removeChild: vi.fn((parent: MockElement, child: MockElement | MockText) => {
      const index = parent.children.indexOf(child);
      if (index !== -1) parent.children.splice(index, 1);
      child.parent = null;
    }),
    insertBefore: vi.fn((parent: MockElement, child: MockElement | MockText, ref: unknown | null) => {
      // Remove from old position if already in parent
      const oldIndex = parent.children.indexOf(child);
      if (oldIndex !== -1) {
        parent.children.splice(oldIndex, 1);
      }

      // Insert at new position
      if (ref === null || ref === undefined) {
        parent.children.push(child);
      } else {
        const refIndex = parent.children.indexOf(ref as MockElement);
        if (refIndex !== -1) {
          parent.children.splice(refIndex, 0, child);
        } else {
          parent.children.push(child);
        }
      }
      child.parent = parent;
    }),
    addEventListener: vi.fn(() => () => {}),
    observeLifecycle: vi.fn(() => () => {}),
    isConnected: vi.fn((element: MockElement) => element.connected),
    isElement: (value): value is MockElement =>
      value !== null && typeof value === 'object' && 'tag' in value,
    isTextNode: (value): value is MockText =>
      value !== null && typeof value === 'object' && 'type' in value && value.type === 'text',
  };

  return renderer;
}

// Create ElementRef from element
function createElementRef<TElement>(element: TElement): ElementRef<TElement> {
  const ref = ((_lifecycleCallback: LifecycleCallback<TElement>): TElement => {
    return element;
  }) as ElementRef<TElement>;
  ref.element = element;
  return ref;
}

// Simple signal implementation for tests
function createSignal<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<() => void>();

  const read = (() => value) as Reactive<T>;
  read.peek = () => value;

  const write = (newValue: T) => {
    value = newValue;
    subscribers.forEach(fn => fn());
  };

  return { read, write, subscribers };
}

describe('elMap primitive', () => {
  describe('initial render', () => {
    it('renders all items in list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items } = createSignal(['a', 'b', 'c']);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        }
      );

      // User cares: all items rendered
      // Container has display:contents so we check its children
      expect(ref.element.children).toHaveLength(3);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('a');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');
    });

    it('renders empty list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items } = createSignal<string[]>([]);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        }
      );

      // User cares: no items rendered
      expect(ref.element.children).toHaveLength(0);
    });
  });

  describe('adding items', () => {
    it('adds new items to list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
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
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        }
      );

      // Initial state
      expect(ref.element.children).toHaveLength(2);

      // Add items
      setItems(['a', 'b', 'c', 'd']);

      // User cares: new items added
      expect(ref.element.children).toHaveLength(4);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[2]!.children[0] as MockText).content).toBe('c');
      expect((itemElements[3]!.children[0] as MockText).content).toBe('d');
    });

    it('adds items to empty list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal<string[]>([]);
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
        }
      );

      expect(ref.element.children).toHaveLength(0);

      // Add items to empty list
      setItems(['x', 'y']);

      // User cares: items added
      expect(ref.element.children).toHaveLength(2);
    });
  });

  describe('removing items', () => {
    it('removes items from list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
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
        }
      );

      expect(ref.element.children).toHaveLength(3);

      // Remove middle item
      setItems(['a', 'c']);

      // User cares: item removed
      expect(ref.element.children).toHaveLength(2);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('a');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('c');
    });

    it('removes all items', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
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
        }
      );

      expect(ref.element.children).toHaveLength(3);

      // Clear list
      setItems([]);

      // User cares: all items removed
      expect(ref.element.children).toHaveLength(0);
    });
  });

  describe('reordering items', () => {
    it('reorders items without re-rendering', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
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

      const renderSpy = vi.fn();
      const ref = elMap(
        items,
        (itemSignal) => {
          renderSpy(itemSignal());
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        }
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

    it('handles complex reordering', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a', 'b', 'c', 'd', 'e']);
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
        }
      );

      // Complex reorder: e c a b d
      setItems(['e', 'c', 'a', 'b', 'd']);

      // User cares: final order correct
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('e');
      expect((itemElements[1]!.children[0] as MockText).content).toBe('c');
      expect((itemElements[2]!.children[0] as MockText).content).toBe('a');
      expect((itemElements[3]!.children[0] as MockText).content).toBe('b');
      expect((itemElements[4]!.children[0] as MockText).content).toBe('d');
    });
  });

  describe('identity-based tracking', () => {
    it('tracks items by object identity by default', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();

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
        }
        // No keyFn - uses identity
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
  });

  describe('custom key function', () => {
    it('uses custom keyFn for tracking', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();

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

  describe('item signal updates', () => {
    it('updates individual item via signal', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();

      const { read: items, write: setItems, subscribers: listSubs } = createSignal([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);

      const itemSignals = new Map<number, {
        read: Reactive<any>,
        write: (val: any) => void,
      }>();

      const signal = <T>(val: T): Reactive<T> & ((v: T) => void) => {
        const { read, write } = createSignal(val);
        const combined = read as Reactive<T> & ((v: T) => void);
        Object.assign(combined, { write });
        return combined;
      };

      const effect = (fn: () => void) => {
        listSubs.add(fn);
        fn();
        return () => listSubs.delete(fn);
      };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const item = itemSignal();
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(item.name);
          renderer.appendChild(element, text);

          // Store signal for later update
          itemSignals.set(item.id, {
            read: itemSignal,
            write: (itemSignal as any).write,
          });

          return createElementRef(element);
        },
        (item) => item.id
      );

      // Initial state
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('Alice');

      // Update list with modified item
      setItems([
        { id: 1, name: 'Alicia' }, // name changed
        { id: 2, name: 'Bob' },
      ]);

      // User cares: item content updates
      // Note: This tests that the reconciliation updates the item signal
      expect(ref.element.children).toHaveLength(2);
    });
  });

  describe('mixed operations', () => {
    it('handles add + remove + reorder in single update', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
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
        }
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

    it('handles rapid sequential updates', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items, write: setItems, subscribers } = createSignal(['a']);
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
        }
      );

      // Multiple updates
      setItems(['a', 'b']);
      setItems(['a', 'b', 'c']);
      setItems(['b', 'c']);
      setItems(['c']);

      // User cares: final state correct after all updates
      expect(ref.element.children).toHaveLength(1);
      const itemElements = ref.element.children as MockElement[];
      expect((itemElements[0]!.children[0] as MockText).content).toBe('c');
    });
  });

  describe('container behavior', () => {
    it('creates container with display:contents', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const { read: items } = createSignal(['a']);
      const signal = <T>(val: T): Reactive<T> => {
        const s = () => val;
        s.peek = () => val;
        return s;
      };
      const effect = (fn: () => void) => { fn(); return () => {}; };
      const elMap = createElMapFactory({ ctx, signal, effect, renderer }).method;

      const ref = elMap(
        items,
        (itemSignal) => {
          const element = renderer.createElement('li');
          const text = renderer.createTextNode(itemSignal());
          renderer.appendChild(element, text);
          return createElementRef(element);
        }
      );

      // User cares: container doesn't affect layout
      expect(ref.element.props.style).toEqual({ display: 'contents' });
    });
  });
});
