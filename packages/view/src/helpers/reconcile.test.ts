import { describe, it, expect, vi } from 'vitest';
import { createReconciler, replaceChildren } from './reconcile';
import { createViewContext } from '../context';
import { createScope, trackInSpecificScope } from './scope';
import type { Renderer } from '../renderer';
import { createMockDisposable, MockElement } from '../test-utils';
import { DEFERRED_LIST_REF, type DeferredListNode, type ListItemNode } from '../types';

// Create reconciler once for all tests
const reconcileList = createReconciler();

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
    createContainer: vi.fn(() => {
      const container = new MockElement('container');
      return container;
    }),
    createTextNode: vi.fn((text: string) => new MockElement(`text:${text}`)),
    updateTextNode: vi.fn(),
    setAttribute: vi.fn(),
    appendChild,
    removeChild,
    insertBefore,
    addEventListener: vi.fn(() => () => {}),
    observeLifecycle: vi.fn(() => () => {}),
    isConnected: vi.fn(() => true),
    isElement: (value): value is MockElement =>
      value !== null && typeof value === 'object' && 'id' in value,
    isTextNode: (_value): _value is MockElement => false,
  };
}

describe('reconcileList', () => {
  it('displays all items in list', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const items = ['a', 'b', 'c'];

    reconcileList(
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

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial render
    reconcileList(ctx, parent, ['a', 'b'], createElement, (item) => item, renderer);

    expect(container.children).toHaveLength(2);

    // Add more items
    reconcileList(
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
    reconcileList(
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

  it('disposes scopes when items are removed', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const disposables: ReturnType<typeof createMockDisposable>[] = [];

    // Initial render with scopes
    reconcileList(
      ctx,
      parent,
      ['a', 'b', 'c'],
      (item) => {
        const element = new MockElement(`item-${item}`);
        const scope = createScope();
        const disposable = createMockDisposable();
        trackInSpecificScope(scope, disposable);
        disposables.push(disposable);
        ctx.elementScopes.set(element, scope);
        return { element };
      },
      (item) => item,
      renderer
    );

    // Remove item 'b'
    reconcileList(
      ctx,
      parent,
      ['a', 'c'],
      (item) => ({ element: new MockElement(`item-${item}`) }),
      (item) => item,
      renderer
    );

    // User cares: only removed item's scope was disposed
    expect(disposables[0]!.disposed).toBe(false); // 'a' not disposed
    expect(disposables[1]!.disposed).toBe(true); // 'b' disposed
    expect(disposables[2]!.disposed).toBe(false); // 'c' not disposed
  });

  it('reorders items correctly', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial render
    reconcileList(ctx, parent, ['a', 'b', 'c'], createElement, (item) => item, renderer);

    // Reverse order
    reconcileList(
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

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
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
    reconcileList(
      ctx,
      parent,
      [objA, objB, objC],
      createElement,
      (item) => item.id, // Key by ID
      renderer
    );

    // Reorder same objects
    reconcileList(
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

  it('uses custom keyFn for tracking', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const createElement = (item: { id: number; name: string }) => {
      const el = new MockElement('li');
      el.id = `item-${item.id}`;
      return { element: el };
    };

    // Initial render with objects having IDs
    reconcileList(
      ctx,
      parent,
      [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      createElement,
      (item) => item.id, // key by ID
      renderer
    );

    // Update with new objects but same IDs
    reconcileList(
      ctx,
      parent,
      [
        { id: 1, name: 'Alicia' }, // different object!
        { id: 2, name: 'Robert' },
      ],
      createElement,
      (item) => item.id,
      renderer
    );

    // User cares: items recognized by key, not identity
    expect(container.children).toHaveLength(2);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['item-1', 'item-2']);
  });

  it('handles add + remove + reorder in single pass', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    const parent: DeferredListNode<MockElement> = {
      refType: DEFERRED_LIST_REF,
      element: container,
      firstChild: undefined,
      lastChild: undefined,
      itemsByKey: new Map<string, ListItemNode<unknown, MockElement>>(),
    };

    const createElement = (item: string) => {
      const el = new MockElement('li');
      el.id = `item-${item}`;
      return { element: el };
    };

    // Initial: a b c d
    reconcileList(ctx, parent, ['a', 'b', 'c', 'd'], createElement, (item) => item, renderer);

    // Transform: d e c (removed: a, b; added: e; reordered: d, c)
    reconcileList(
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
});

describe('replaceChildren', () => {
  it('replaces all children', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    // Add some children manually
    const child1 = new MockElement('div');
    child1.id = 'old-1';
    const child2 = new MockElement('div');
    child2.id = 'old-2';
    renderer.appendChild(container, child1);
    renderer.appendChild(container, child2);

    expect(container.children).toHaveLength(2);

    // Replace with new children
    const new1 = new MockElement('div');
    new1.id = 'new-1';
    const new2 = new MockElement('div');
    new2.id = 'new-2';
    const new3 = new MockElement('div');
    new3.id = 'new-3';
    const newChildren = [new1, new2, new3];

    replaceChildren(ctx, container, newChildren, renderer);

    // User cares: old children gone, new children present
    expect(container.children).toHaveLength(3);
    expect((container.children as MockElement[]).map((c) => c.id)).toEqual(['new-1', 'new-2', 'new-3']);
  });

  it('disposes scopes of removed children', () => {
    const ctx = createViewContext();
    const renderer = createMockRenderer();
    const container = new MockElement('container');

    // Add children with scopes
    const child1 = new MockElement('child-1');
    const child2 = new MockElement('child-2');
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

    // Replace with empty
    replaceChildren(ctx, container, [], renderer);

    // User cares: scopes disposed
    expect(disposable1.disposed).toBe(true);
    expect(disposable2.disposed).toBe(true);
  });
});
