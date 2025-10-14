import { describe, it, expect, vi } from 'vitest';
import { reconcileList, replaceChildren } from './reconcile';
import { createViewContext } from '../context';
import { createScope, trackInSpecificScope } from './scope';
import type { Renderer } from '../renderer';
import type { Disposable } from '../types';

// Test utilities
type MockElement = {
  id: string;
  parent: MockElement | null;
  children: MockElement[];
  disposed: boolean;
  // DOM-like properties for reconcile.ts
  get firstChild(): MockElement | null;
  get nextSibling(): MockElement | null;
};

function createMockElement(id: string): MockElement {
  const element: MockElement = {
    id,
    parent: null,
    children: [],
    disposed: false,
    get firstChild() {
      return element.children[0] ?? null;
    },
    get nextSibling() {
      if (!element.parent) return null;
      const index = element.parent.children.indexOf(element);
      return element.parent.children[index + 1] ?? null;
    },
  };
  return element;
}

function createMockRenderer(): Renderer<MockElement, MockElement> {
  const appendChild = vi.fn((parent: MockElement, child: MockElement) => {
    child.parent = parent;
    if (!parent.children.includes(child)) {
      parent.children.push(child);
    }
  });

  const removeChild = vi.fn((parent: MockElement, child: MockElement) => {
    const index = parent.children.indexOf(child);
    if (index !== -1) {
      parent.children.splice(index, 1);
      child.parent = null;
    }
  });

  const insertBefore = vi.fn((parent: MockElement, child: MockElement, ref: unknown | null) => {
    // Remove from old position if already in parent
    const oldIndex = parent.children.indexOf(child);
    if (oldIndex !== -1) {
      parent.children.splice(oldIndex, 1);
    }

    // Insert at new position
    if (ref === null || ref === undefined) {
      parent.children.push(child);
    } else if (typeof ref === 'object' && ref !== null && 'id' in ref) {
      const refIndex = parent.children.indexOf(ref as MockElement);
      if (refIndex !== -1) {
        parent.children.splice(refIndex, 0, child);
      } else {
        // If ref not found, append
        parent.children.push(child);
      }
    }
    child.parent = parent;
  });

  return {
    createElement: vi.fn((tag: string) => createMockElement(tag)),
    createTextNode: vi.fn((text: string) => createMockElement(`text:${text}`)),
    updateTextNode: vi.fn(),
    setAttribute: vi.fn(),
    appendChild,
    removeChild,
    insertBefore,
    addEventListener: vi.fn(() => () => {}),
    observeLifecycle: vi.fn(() => () => {}),
    isConnected: vi.fn(() => true),
    isElement: (value): value is MockElement => value !== null && typeof value === 'object' && 'id' in value,
    isTextNode: (_value): _value is MockElement => false,
  };
}

function createMockDisposable(): Disposable & { disposed: boolean } {
  const mock = {
    disposed: false,
    dispose: vi.fn(() => {
      mock.disposed = true;
    }),
  };
  return mock;
}

describe('reconcileList', () => {
  describe('adding items', () => {
    it('renders and inserts new items', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      const items = ['a', 'b', 'c'];

      reconcileList(
        ctx,
        container,
        [], // old items
        items, // new items
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // all items are in the DOM
      expect(container.children).toHaveLength(3);
      expect(container.children[0]!.id).toBe('item-a');
      expect(container.children[1]!.id).toBe('item-b');
      expect(container.children[2]!.id).toBe('item-c');
    });

    it('adds new items to end of existing list', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Add more items
      reconcileList(
        ctx,
        container,
        ['a', 'b'],
        ['a', 'b', 'c', 'd'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // New items appended, existing items unchanged
      expect(container.children).toHaveLength(4);
      expect(container.children.map(c => c.id)).toEqual([
        'item-a',
        'item-b',
        'item-c',
        'item-d',
      ]);
    });

    it('adds new items in the middle', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Insert in middle
      reconcileList(
        ctx,
        container,
        ['a', 'c'],
        ['a', 'b', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Item inserted in correct position
      expect(container.children.map(c => c.id)).toEqual([
        'item-a',
        'item-b',
        'item-c',
      ]);
    });
  });

  describe('removing items', () => {
    it('removes items from DOM', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      expect(container.children).toHaveLength(3);

      // Remove middle item
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c'],
        ['a', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Item removed
      expect(container.children).toHaveLength(2);
      expect(container.children.map(c => c.id)).toEqual(['item-a', 'item-c']);
    });

    it('disposes scopes when items are removed', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();
      const disposables: (Disposable & { disposed: boolean })[] = [];

      // Initial render with scopes
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c'],
        itemMap,
        (item) => {
          const element = createMockElement(`item-${item}`);
          const scope = createScope();
          const disposable = createMockDisposable();
          trackInSpecificScope(scope, disposable);
          disposables.push(disposable);
          ctx.elementScopes.set(element, scope);
          return element;
        },
        (item) => item,
        renderer
      );

      // Remove item 'b'
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c'],
        ['a', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Only removed item's scope was disposed
      expect(disposables[0]!.disposed).toBe(false); // 'a' not disposed
      expect(disposables[1]!.disposed).toBe(true);  // 'b' disposed
      expect(disposables[2]!.disposed).toBe(false); // 'c' not disposed
    });

    it('removes all items', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Remove all
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c'],
        [],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Container is empty
      expect(container.children).toHaveLength(0);
    });
  });

  describe('reordering items', () => {
    it('reorders existing items without re-rendering', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Reverse order
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c'],
        ['c', 'b', 'a'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Order changed
      expect(container.children.map(c => c.id)).toEqual([
        'item-c',
        'item-b',
        'item-a',
      ]);
    });

    it('handles complex reordering', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial: a b c d e
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c', 'd', 'e'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Reorder: e c a b d
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c', 'd', 'e'],
        ['e', 'c', 'a', 'b', 'd'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Final order is correct
      expect(container.children.map(c => c.id)).toEqual([
        'item-e',
        'item-c',
        'item-a',
        'item-b',
        'item-d',
      ]);
    });
  });

  describe('identity-based tracking', () => {
    it('tracks items by object identity by default', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      const objA = { id: 1, name: 'Alice' };
      const objB = { id: 2, name: 'Bob' };
      const objC = { id: 3, name: 'Charlie' };

      // Initial render
      reconcileList(
        ctx,
        container,
        [],
        [objA, objB, objC],
        itemMap,
        (item) => createMockElement(`item-${item.id}`),
        (item) => item, // identity-based
        renderer
      );

      // Reorder same objects
      reconcileList(
        ctx,
        container,
        [objA, objB, objC],
        [objC, objA, objB],
        itemMap,
        (item) => createMockElement(`item-${item.id}`),
        (item) => item,
        renderer
      );

      // Objects recognized by identity
      expect(container.children.map(c => c.id)).toEqual([
        'item-3',
        'item-1',
        'item-2',
      ]);
    });

    it('uses custom keyFn for tracking', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial render with objects having IDs
      reconcileList(
        ctx,
        container,
        [],
        [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        itemMap,
        (item) => createMockElement(`item-${item.id}`),
        (item) => item.id, // key by ID
        renderer
      );

      // Update with new objects but same IDs
      reconcileList(
        ctx,
        container,
        [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        [{ id: 1, name: 'Alicia' }, { id: 2, name: 'Robert' }], // different objects!
        itemMap,
        (item) => createMockElement(`item-${item.id}`),
        (item) => item.id,
        renderer
      );

      // Items recognized by key, not identity
      expect(container.children).toHaveLength(2);
      expect(container.children.map(c => c.id)).toEqual(['item-1', 'item-2']);
    });
  });

  describe('mixed operations', () => {
    it('handles add + remove + reorder in single pass', () => {
      const ctx = createViewContext();
      const renderer = createMockRenderer();
      const container = createMockElement('container');
      const itemMap = new Map();

      // Initial: a b c d
      reconcileList(
        ctx,
        container,
        [],
        ['a', 'b', 'c', 'd'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Transform: d e c (removed: a, b; added: e; reordered: d, c)
      reconcileList(
        ctx,
        container,
        ['a', 'b', 'c', 'd'],
        ['d', 'e', 'c'],
        itemMap,
        (item) => createMockElement(`item-${item}`),
        (item) => item,
        renderer
      );

      // Final state is correct
      expect(container.children.map(c => c.id)).toEqual([
        'item-d',
        'item-e',
        'item-c',
      ]);
    });
  });
});

describe('replaceChildren', () => {
  it('removes all existing children', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = createMockElement('container');

    // Add some children manually
    const child1 = createMockElement('old-1');
    const child2 = createMockElement('old-2');
    renderer.appendChild(container, child1);
    renderer.appendChild(container, child2);

    expect(container.children).toHaveLength(2);

    // Replace with new children
    const newChildren = [
      createMockElement('new-1'),
      createMockElement('new-2'),
      createMockElement('new-3'),
    ];

    replaceChildren(ctx, container, newChildren, renderer);

    // old children gone, new children present
    expect(container.children).toHaveLength(3);
    expect(container.children.map(c => c.id)).toEqual([
      'new-1',
      'new-2',
      'new-3',
    ]);
  });

  it('disposes scopes of removed children', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = createMockElement('container');

    // Add children with scopes
    const child1 = createMockElement('child-1');
    const child2 = createMockElement('child-2');
    const scope1 = createScope();
    const scope2 = createScope();
    const disposable1 = createMockDisposable();
    const disposable2 = createMockDisposable();

    trackInSpecificScope(scope1, disposable1);
    trackInSpecificScope(scope2, disposable2);
    ctx.elementScopes.set(child1, scope1);
    ctx.elementScopes.set(child2, scope2);

    renderer.appendChild(container, child1);
    renderer.appendChild(container, child2);

    // Replace
    replaceChildren(ctx, container, [], renderer);

    // scopes disposed
    expect(disposable1.disposed).toBe(true);
    expect(disposable2.disposed).toBe(true);
  });

  it('handles empty container', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = createMockElement('container');

    const newChildren = [createMockElement('child-1')];

    // Should not throw
    replaceChildren(ctx, container, newChildren, renderer);

    // children added
    expect(container.children).toHaveLength(1);
  });
});
