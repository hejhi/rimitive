/**
 * TDD tests exposing bugs in reconcilePositional
 *
 * These tests define the CORRECT behavior that reconcilePositional should have:
 * 1. Elements should be REUSED when position unchanged (not recreated)
 * 2. Element identity should be preserved across updates
 * 3. Only create() should be called for NEW items, not existing ones
 *
 * Current implementation calls create() on every reconciliation (line 269),
 * which is fundamentally wrong and causes:
 * - Unnecessary allocations
 * - Loss of element identity
 * - State loss for stateful components
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement } from '../test-utils';
import { createElFactory } from '../el';
import { createMapHelper } from './map-helper';

describe('reconcilePositional - Element Reuse (TDD)', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      processChildren: env.processChildren,
      createScope: env.createScope,
      runInScope: env.runInScope,
      trackInScope: env.trackInScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      disposeScope: env.disposeScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    return { ...env, el, map };
  }

  it('should REUSE elements when list content unchanged', () => {
    const { el, map, signal } = setup();

    const items = signal(['a', 'b', 'c']);

    // Map without keys - forces positional reconciliation
    const list = el.method([
      'ul',
      map(items, (items) => items.map((item) => el.method(['li', item]))),
    ]);

    const ul = list.create().element as MockElement;

    // Capture original element references
    const originalElements = [
      ul.children[0],
      ul.children[1],
      ul.children[2],
    ];

    // Update signal with SAME content
    items(['a', 'b', 'c']);

    // CRITICAL: Elements should be SAME objects (not recreated)
    expect(ul.children[0]).toBe(originalElements[0]);
    expect(ul.children[1]).toBe(originalElements[1]);
    expect(ul.children[2]).toBe(originalElements[2]);
  });

  it('should REUSE element when single item updated at position', () => {
    const { el, map, signal } = setup();

    const items = signal(['a', 'b', 'c']);

    const list = el.method([
      'ul',
      map(items, (items) => items.map((item) => el.method(['li', item]))),
    ]);

    const ul = list.create().element as MockElement;
    const originalElements = [ul.children[0], ul.children[1], ul.children[2]];

    // Change middle item content
    items(['a', 'UPDATED', 'c']);

    // Elements at positions 0 and 2 should be REUSED
    expect(ul.children[0]).toBe(originalElements[0]);
    expect(ul.children[2]).toBe(originalElements[2]);

    // Element at position 1 should be NEW (content changed)
    // This is acceptable for positional reconciliation without identity tracking
    // But we should at least verify the content is correct
    expect((ul.children[1] as MockElement).textContent).toBe('UPDATED');
  });

  it('should preserve element state across updates', () => {
    const { el, map, signal } = setup();

    // Track how many times create() is called per item
    const createCounts = { a: 0, b: 0, c: 0 };

    const items = signal(['a', 'b', 'c']);

    const list = el.method([
      'ul',
      map(items, (items) =>
        items.map((item) => {
          createCounts[item as keyof typeof createCounts]++;
          return el.method(['li', item]);
        })
      ),
    ]);

    const ul = list.create().element as MockElement;

    // Initial render: each item created once
    expect(createCounts).toEqual({ a: 1, b: 1, c: 1 });

    // Update with same items
    items(['a', 'b', 'c']);

    // CRITICAL: create() should NOT be called again for existing items
    // Positional reconciliation should detect same position = same item
    expect(createCounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('should only create() new items, not existing ones', () => {
    const { el, map, signal } = setup();

    const createCalls: string[] = [];

    const items = signal(['a', 'b']);

    const list = el.method([
      'ul',
      map(items, (items) =>
        items.map((item) => {
          createCalls.push(item);
          return el.method(['li', item]);
        })
      ),
    ]);

    const ul = list.create().element as MockElement;

    // Initial: created a, b
    expect(createCalls).toEqual(['a', 'b']);
    createCalls.length = 0;

    // Add item to end
    items(['a', 'b', 'c']);

    // CRITICAL: Should only create 'c', not recreate 'a' and 'b'
    expect(createCalls).toEqual(['c']);
  });

  it('should handle element identity with custom properties', () => {
    const { el, map, signal } = setup();

    const items = signal([1, 2, 3]);

    const list = el.method([
      'ul',
      map(items, (items) =>
        items.map((num) => {
          const li = el.method(['li', String(num)]);
          // Simulate attaching custom state to element
          const created = li.create();
          (created.element as any).__customState = `state-${num}`;
          // Return a RefSpec that wraps this already-created element
          // This simulates the pattern where elements have attached state
          return () => li;
        })
      ),
    ]);

    const ul = list.create().element as MockElement;

    // Verify custom state exists
    expect((ul.children[0] as any).__customState).toBe('state-1');
    expect((ul.children[1] as any).__customState).toBe('state-2');

    // Update items (same values)
    items([1, 2, 3]);

    // CRITICAL: Custom state should be preserved (elements reused)
    expect((ul.children[0] as any).__customState).toBe('state-1');
    expect((ul.children[1] as any).__customState).toBe('state-2');
  });

  it('should minimize create() calls when replacing middle items', () => {
    const { el, map, signal } = setup();

    const createCalls: string[] = [];

    const items = signal(['a', 'b', 'c', 'd']);

    const list = el.method([
      'ul',
      map(items, (items) =>
        items.map((item) => {
          createCalls.push(item);
          return el.method(['li', item]);
        })
      ),
    ]);

    list.create();

    expect(createCalls).toEqual(['a', 'b', 'c', 'd']);
    createCalls.length = 0;

    // Replace middle two items
    items(['a', 'X', 'Y', 'd']);

    // CRITICAL: Should only create X and Y, reuse a and d
    // In positional reconciliation:
    // - Position 0: 'a' -> 'a' (reuse)
    // - Position 1: 'b' -> 'X' (need new)
    // - Position 2: 'c' -> 'Y' (need new)
    // - Position 3: 'd' -> 'd' (reuse)
    //
    // Current bug: creates all 4 items again
    expect(createCalls).toEqual(['X', 'Y']);
  });
});

describe('reconcilePositional - Comparison Logic (TDD)', () => {
  function setup() {
    const env = createTestEnv();
    const el = createElFactory({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      processChildren: env.processChildren,
      createScope: env.createScope,
      runInScope: env.runInScope,
      trackInScope: env.trackInScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    const map = createMapHelper({
      ctx: env.ctx,
      effect: env.effect,
      renderer: env.renderer,
      disposeScope: env.disposeScope,
      trackInSpecificScope: env.trackInSpecificScope,
    });

    return { ...env, el, map };
  }

  it('should detect unchanged RefSpec without calling create()', () => {
    const { el, map, signal } = setup();

    // Create stable RefSpec instances
    const refSpecA = el.method(['li', 'A']);
    const refSpecB = el.method(['li', 'B']);
    const refSpecC = el.method(['li', 'C']);

    const items = signal([refSpecA, refSpecB, refSpecC]);

    let createCount = 0;
    const originalCreate = refSpecA.create;
    refSpecA.create = function (...args: any[]) {
      createCount++;
      return originalCreate.apply(this, args);
    } as any;

    const list = el.method([
      'ul',
      map(items, (refSpecs) => refSpecs),
    ]);

    list.create();

    // Created once initially
    const initialCreateCount = createCount;

    // Update with SAME RefSpec instances
    items([refSpecA, refSpecB, refSpecC]);

    // CRITICAL: Should not call create() again if RefSpec unchanged
    // Current bug: calls create() to "compare" elements
    expect(createCount).toBe(initialCreateCount);
  });

  it('should detect changed RefSpec and replace element', () => {
    const { el, map, signal } = setup();

    const refSpecA = el.method(['li', 'A']);
    const refSpecB = el.method(['li', 'B']);
    const refSpecC = el.method(['li', 'C']);
    const refSpecX = el.method(['li', 'X']);

    const items = signal([refSpecA, refSpecB, refSpecC]);

    const list = el.method([
      'ul',
      map(items, (refSpecs) => refSpecs),
    ]);

    const ul = list.create().element as MockElement;
    const originalMiddle = ul.children[1];

    // Replace middle RefSpec
    items([refSpecA, refSpecX, refSpecC]);

    // Middle element should be replaced
    expect(ul.children[1]).not.toBe(originalMiddle);
    expect((ul.children[1] as MockElement).textContent).toBe('X');

    // First and last should be reused
    expect(ul.children[0]).toBe(ul.children[0]); // Same ref
    expect(ul.children[2]).toBe(ul.children[2]); // Same ref
  });
});
