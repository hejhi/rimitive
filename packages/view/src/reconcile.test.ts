import { describe, it, expect, vi } from 'vitest';
import { reconcileList, ListItemNode, MapState } from './map';
import { createViewContext } from './context';
import type { Renderer } from './renderer';
import { MockElement } from './test-utils';

// Shared buffers for tests (mimics buffer pooling in actual implementation)
const testBuffers = {
  oldIndices: [] as number[],
  newPos: [] as number[],
  lis: [] as number[],
};

// Helper to wrap reconcileList with buffer management for tests
function reconcileListTest<T>(
  ctx: ReturnType<typeof createViewContext>,
  parent: MapState<MockElement>,
  newItems: T[],
  renderItem: (item: T) => { element: MockElement; itemSignal?: ((value: T) => void) & (() => T) },
  keyFn: (item: T) => string | number,
  renderer: Renderer<MockElement, MockElement>
): void {
  // Clear buffers before each use
  testBuffers.oldIndices.length = 0;
  testBuffers.newPos.length = 0;
  testBuffers.lis.length = 0;

  reconcileList(
    ctx,
    parent,
    newItems,
    renderItem,
    keyFn,
    renderer,
    testBuffers.oldIndices,
    testBuffers.newPos,
    testBuffers.lis
  );
}

// Mock renderer for reconcile tests
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

  const insertBefore = vi.fn((parent: MockElement, child: MockElement, ref: MockElement | null) => {
    // Remove from old position if already in parent
    const oldIndex = parent.children.indexOf(child);
    if (oldIndex !== -1) {
      parent.children.splice(oldIndex, 1);
    }

    // Insert at new position
    if (ref === null || ref === undefined) {
      parent.children.push(child);
    } else if (typeof ref === 'object' && ref !== null && 'id' in ref) {
      const refIndex = parent.children.indexOf(ref);
      if (refIndex !== -1) {
        parent.children.splice(refIndex, 0, child);
      } else {
        parent.children.push(child);
      }
    }
    child.parent = parent;
  });

  return {
    createElement: vi.fn((tag: string) => new MockElement(tag)),
    createTextNode: vi.fn((text: string) => new MockElement(`text:${text}`)),
    updateTextNode: vi.fn(),
    setAttribute: vi.fn(),
    appendChild,
    removeChild,
    insertBefore,
    observeLifecycle: vi.fn(() => () => {}),
    isConnected: vi.fn(() => true),
    isElement: (value): value is MockElement =>
      value !== null && typeof value === 'object' && 'id' in value,
  };
}

describe('reconcileList', () => {
  it('displays all items in list', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const items = ['a', 'b', 'c'];

    reconcileListTest(
      ctx,
      parent,
      items, // new items
      (item) => {
        const el = new MockElement('li');
        el.id = `item-${item}`;
        return { element: el };
      },
      (item) => item,
      renderer
    );

    // User cares: all items are displayed
    expect(container.children).toHaveLength(3);
    expect((container.children[0] as MockElement).id).toBe('item-a');
    expect((container.children[1] as MockElement).id).toBe('item-b');
    expect((container.children[2] as MockElement).id).toBe('item-c');
  });

  it('updates list when items added and removed', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial render
    reconcileListTest(ctx, parent, ['a', 'b'], createElement, (item) => item, renderer);

    expect(container.children).toHaveLength(2);

    // Add more items
    reconcileListTest(
      ctx,
      parent,
      ['a', 'b', 'c', 'd'],
      createElement,
      (item) => item,
      renderer
    );

    // User cares: new items added
    expect(container.children).toHaveLength(4);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual([
      'item-a',
      'item-b',
      'item-c',
      'item-d',
    ]);

    // Remove middle item
    reconcileListTest(
      ctx,
      parent,
      ['a', 'c', 'd'],
      createElement,
      (item) => item,
      renderer
    );

    // User cares: item removed
    expect(container.children).toHaveLength(3);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-a', 'item-c', 'item-d']);
  });

  it('reorders items correctly', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial render
    reconcileListTest(ctx, parent, ['a', 'b', 'c'], createElement, (item) => item, renderer);

    // Reverse order
    reconcileListTest(
      ctx,
      parent,
      ['c', 'b', 'a'],
      createElement,
      (item) => item,
      renderer
    );

    // User cares: order changed
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-c', 'item-b', 'item-a']);
  });

  it('tracks items by ID', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const objA = { id: 1, name: 'Alice' };
    const objB = { id: 2, name: 'Bob' };
    const objC = { id: 3, name: 'Charlie' };

    const createElement = (item: { id: number; name: string }) => {
      const el = new MockElement('li');
      el.id = `item-${item.id}`;
      return { element: el };
    };

    // Initial render
    reconcileListTest(
      ctx,
      parent,
      [objA, objB, objC],
      createElement,
      (item) => item.id, // Key by ID
      renderer
    );

    // Reorder same objects
    reconcileListTest(
      ctx,
      parent,
      [objC, objA, objB],
      createElement,
      (item) => item.id, // Key by ID
      renderer
    );

    // User cares: objects recognized by ID
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-3', 'item-1', 'item-2']);
  });

  it('handles add + remove + reorder in single pass', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial: a b c d
    reconcileListTest(ctx, parent, ['a', 'b', 'c', 'd'], createElement, (item) => item, renderer);

    // Transform: d e c (removed: a, b; added: e; reordered: d, c)
    reconcileListTest(
      ctx,
      parent,
      ['d', 'e', 'c'],
      createElement,
      (item) => item,
      renderer
    );

    // User cares: final state is correct
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-d', 'item-e', 'item-c']);
  });

  it('updates itemSignal based on reference equality', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const signals = new Map<string, ReturnType<typeof vi.fn>>();

    // Create stable object references
    const itemA = { id: 'a', value: 1 };
    const itemB = { id: 'b', value: 2 };

    // Initial render
    reconcileListTest(
      ctx,
      parent,
      [itemA, itemB],
      (item) => {
        const el = new MockElement('li');
        el.id = `item-${item.id}`;
        const signal = vi.fn();
        signals.set(item.id, signal);
        return { element: el, itemSignal: signal };
      },
      (item) => item.id,
      renderer
    );

    // Update only item A - use new object reference for A, same reference for B
    const itemAUpdated = { id: 'a', value: 99 };

    reconcileListTest(
      ctx,
      parent,
      [itemAUpdated, itemB], // itemB is same reference
      (item) => {
        const el = new MockElement('li');
        el.id = `item-${item.id}`;
        return { element: el };
      },
      (item) => item.id,
      renderer
    );

    // User cares: itemSignal uses reference equality
    // - 'a' has new reference → signal called
    // - 'b' has same reference → signal not called
    expect(signals.get('a')).toHaveBeenCalledWith(itemAUpdated);
    expect(signals.get('b')).not.toHaveBeenCalled();
  });

  it('handles empty to non-empty transition', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial: empty list
    reconcileListTest(ctx, parent, [], createElement, (item) => item, renderer);
    expect(container.children).toHaveLength(0);

    // Add items
    reconcileListTest(ctx, parent, ['a', 'b'], createElement, (item) => item, renderer);

    // User cares: items added correctly
    expect(container.children).toHaveLength(2);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-a', 'item-b']);
  });

  it('handles non-empty to empty transition', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial: non-empty list
    reconcileListTest(ctx, parent, ['a', 'b'], createElement, (item) => item, renderer);
    expect(container.children).toHaveLength(2);

    // Clear all items
    reconcileListTest(ctx, parent, [], createElement, (item) => item, renderer);

    // User cares: all items removed
    expect(container.children).toHaveLength(0);
  });

  it('replaces all items when keys do not overlap', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial: a, b
    reconcileListTest(ctx, parent, ['a', 'b'], createElement, (item) => item, renderer);
    const oldElements = [...container.children];

    // Replace with completely different items: x, y
    reconcileListTest(ctx, parent, ['x', 'y'], createElement, (item) => item, renderer);

    // User cares: old items removed, new items added
    expect(container.children).toHaveLength(2);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-x', 'item-y']);
    // Verify old elements are not in the container
    expect(container.children).not.toContain(oldElements[0]);
    expect(container.children).not.toContain(oldElements[1]);
  });

  it('handles duplicate keys by reusing first node', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: MapState<MockElement> = {
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
      nextSibling: null,
    };

    const itemSignals = new Map<string, ReturnType<typeof vi.fn>>();

    // Items with duplicate keys
    reconcileListTest(
      ctx,
      parent,
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 3 }, // duplicate key 'a'
      ],
      (item) => {
        const el = new MockElement('li');
        el.id = `item-${item.id}-${item.value}`;
        const signal = vi.fn();
        itemSignals.set(item.id, signal);
        return { element: el, itemSignal: signal };
      },
      (item) => item.id,
      renderer
    );

    // Duplicate keys result in reusing the first node
    // First 'a' (i=0) creates node with element id 'item-a-1'
    // Second 'a' (i=2) reuses that node, updates itemData, calls itemSignal
    expect(container.children).toHaveLength(2);
    const ids = (container.children as MockElement[]).map((c) => c.id);

    // Element created with first occurrence's data
    expect(ids).toContain('item-a-1');
    expect(ids).toContain('item-b-2');

    // But itemSignal was called with last occurrence's data
    expect(itemSignals.get('a')).toHaveBeenCalledWith({ id: 'a', value: 3 });
  });
});
