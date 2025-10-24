/**
 * Tests for user-space map() helper
 *
 * Demonstrates the closure-based pattern with keys from el()
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement, getTextContent } from '../test-utils';
import { createMapHelper } from './map-helper';
import { createElFactory } from '../el';

describe('map-helper', () => {
  it('should render list with keys from el()', () => {
    const {
      ctx,
      renderer,
      signal,
      effect,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
      disposeScope,
    } = createTestEnv();

    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx,
      effect,
      renderer,
      disposeScope,
      trackInSpecificScope,
    });

    const items = signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    const list = el.method(
      ['ul',
        map(items, (items) =>
          items.map((item) => el.method(['li', item.name], item.id))
        ),
      ]
    );

    const ulEl = list.create().element as MockElement;
    expect(ulEl.children.length).toBe(2);
    expect((ulEl.children[0] as MockElement).tag).toBe('li');
    expect((ulEl.children[1] as MockElement).tag).toBe('li');
    expect(getTextContent(ulEl.children[0] as MockElement)).toBe('Alice');
    expect(getTextContent(ulEl.children[1] as MockElement)).toBe('Bob');
  });

  it('should reconcile when items change', () => {
    const {
      ctx,
      renderer,
      signal,
      effect,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
      disposeScope,
    } = createTestEnv();

    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx,
      effect,
      renderer,
      disposeScope,
      trackInSpecificScope,
    });

    const items = signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);

    const list = el.method(
      ['ul',
        map(items, (items) =>
          items.map((item) => el.method(['li', item.name], item.id))
        ),
      ]
    );

    const ulEl = list.create().element as MockElement;
    expect(ulEl.children.length).toBe(2);

    // Add item
    items([...items(), { id: 3, name: 'Charlie' }]);
    expect(ulEl.children.length).toBe(3);
    expect(getTextContent(ulEl.children[2] as MockElement)).toBe('Charlie');

    // Remove item (remove middle item)
    items([items()[0]!, items()[2]!]);
    expect(ulEl.children.length).toBe(2);
    expect(getTextContent(ulEl.children[0] as MockElement)).toBe('Alice');
    expect(getTextContent(ulEl.children[1] as MockElement)).toBe('Charlie');
  });

  it('should handle reordering with keys', () => {
    const {
      ctx,
      renderer,
      signal,
      effect,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
      disposeScope,
    } = createTestEnv();

    const el = createElFactory({
      ctx,
      effect,
      renderer,
      processChildren,
      createScope,
      runInScope,
      trackInScope,
      trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx,
      effect,
      renderer,
      disposeScope,
      trackInSpecificScope,
    });

    const items = signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);

    const list = el.method(
      ['ul',
        map(items, (items) =>
          items.map((item) => el.method(['li', item.name], item.id))
        ),
      ]
    );

    const ulEl = list.create().element as MockElement;
    expect(ulEl.children.length).toBe(3);

    // Store original elements to verify they're reused
    const [aliceEl, bobEl, charlieEl] = ulEl.children as MockElement[];

    // Reverse order
    items([items()[2]!, items()[1]!, items()[0]!]);

    expect(ulEl.children.length).toBe(3);
    expect(getTextContent(ulEl.children[0] as MockElement)).toBe('Charlie');
    expect(getTextContent(ulEl.children[1] as MockElement)).toBe('Bob');
    expect(getTextContent(ulEl.children[2] as MockElement)).toBe('Alice');
    // Verify elements are reused (same object references)
    expect(ulEl.children[0]).toBe(charlieEl);
    expect(ulEl.children[1]).toBe(bobEl);
    expect(ulEl.children[2]).toBe(aliceEl);
  });
});
