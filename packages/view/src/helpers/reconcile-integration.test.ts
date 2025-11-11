/**
 * Integration tests for list reconciliation with el + map
 *
 * Tests verify correct list reconciliation behavior through the user-facing API:
 * - Does the DOM order match the data order after updates?
 * - Are elements reused when keys match (performance)?
 * - Do complex reorderings work correctly?
 *
 * These tests use the full el + map API stack, complementing the lower-level
 * reconcile.test.ts which tests the reconciliation algorithm directly.
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement, getTextContent, MockRendererConfig } from '../test-utils';
import { El } from '../el';
import { Map } from '../map';
import type { RefSpec } from '../types';

describe('List reconciliation - Complex reorderings', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    const mapFactory = Map<MockRendererConfig>().create({
      signal: env.signal,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      disposeScope: env.disposeScope,
      getElementScope: env.getElementScope,
    });

    return { ...env, el, map: mapFactory.method };
  }

  it('should maintain correct order after reverse', () => {
    const { el, map, signal } = setup();

    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Verify initial order
    expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('C');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('D');

    // Reverse the list
    items([
      { id: 4, name: 'D' },
      { id: 3, name: 'C' },
      { id: 2, name: 'B' },
      { id: 1, name: 'A' },
    ]);

    // CRITICAL: Order must be exactly D, C, B, A
    expect(getTextContent(ul.children[0] as MockElement)).toBe('D');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('C');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('A');
  });

  it('should handle complex reordering with LIS optimization', () => {
    const { el, map, signal } = setup();

    // Initial: [A, B, C, D, E]
    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
      { id: 5, name: 'E' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Capture element references to verify minimal moves
    const elemA = ul.children[0];
    const elemC = ul.children[2];
    const elemD = ul.children[3];

    // Reorder to: [D, A, E, C, B]
    // LIS would be [A, C] (indices 1, 3 - increasing positions)
    // Elements A and C should NOT move
    // Elements D, E, B need to be repositioned
    items([
      { id: 4, name: 'D' },
      { id: 1, name: 'A' },
      { id: 5, name: 'E' },
      { id: 3, name: 'C' },
      { id: 2, name: 'B' },
    ]);

    // CRITICAL: Final order must be D, A, E, C, B
    expect(getTextContent(ul.children[0] as MockElement)).toBe('D');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('E');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('C');
    expect(getTextContent(ul.children[4] as MockElement)).toBe('B');

    // Verify element identity preserved
    expect(ul.children[1]).toBe(elemA); // A didn't move (in LIS)
    expect(ul.children[3]).toBe(elemC); // C didn't move (in LIS)
    expect(ul.children[0]).toBe(elemD); // D moved
  });

  it('should correctly position elements before and after LIS', () => {
    const { el, map, signal } = setup();

    // Initial: [1, 2, 3, 4, 5]
    const items = signal([1, 2, 3, 4, 5]);

    const list = el.method('ul')(
      map(
        () => items(),
        num => num  // Key function (number itself)
      )((numSignal) => el.method('li')(String(numSignal())) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    const elem2 = ul.children[1];
    const elem3 = ul.children[2];
    const elem4 = ul.children[3];

    // Reorder to: [5, 2, 1, 3, 4]
    // LIS: [2, 3, 4] at positions [1, 3, 4]
    // Elements 2, 3, 4 should stay in place
    // Elements 5, 1 need to move
    items([5, 2, 1, 3, 4]);

    // CRITICAL: Exact order verification
    expect(getTextContent(ul.children[0] as MockElement)).toBe('5');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('2');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('1');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('3');
    expect(getTextContent(ul.children[4] as MockElement)).toBe('4');

    // Verify LIS elements didn't move
    expect(ul.children[1]).toBe(elem2);
    expect(ul.children[3]).toBe(elem3);
    expect(ul.children[4]).toBe(elem4);
  });

  it('should handle insertion between LIS elements', () => {
    const { el, map, signal } = setup();

    const items = signal([
      { id: 1, name: 'A' },
      { id: 3, name: 'C' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    const elemA = ul.children[0];
    const elemC = ul.children[1];

    // Insert B between A and C: [A, B, C]
    // LIS: [A, C] - both stay in place
    // B needs to be inserted between them
    items([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);

    // CRITICAL: B must be positioned between A and C
    expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('C');

    // A and C should not have moved
    expect(ul.children[0]).toBe(elemA);
    expect(ul.children[2]).toBe(elemC);
  });

  it('should handle move to beginning before LIS', () => {
    const { el, map, signal } = setup();

    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    const elemC = ul.children[2];

    // Move C to beginning: [C, A, B]
    // LIS: [A, B] at positions [1, 2]
    // C needs to move before A
    items([
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);

    // CRITICAL: C must be first
    expect(getTextContent(ul.children[0] as MockElement)).toBe('C');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('B');

    // Verify C was moved (same element)
    expect(ul.children[0]).toBe(elemC);
  });

  it('should handle move to end after LIS', () => {
    const { el, map, signal } = setup();

    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    const elemA = ul.children[0];

    // Move A to end: [B, C, A]
    // LIS: [B, C] at positions [0, 1]
    // A needs to move after C
    items([
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
    ]);

    // CRITICAL: A must be last
    expect(getTextContent(ul.children[0] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('C');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('A');

    // Verify A was moved (same element)
    expect(ul.children[2]).toBe(elemA);
  });

  it('should handle multiple non-LIS elements in sequence', () => {
    const { el, map, signal } = setup();

    // Initial: [1, 2, 3, 4, 5, 6]
    const items = signal([1, 2, 3, 4, 5, 6]);

    const list = el.method('ul')(
      map(
        () => items(),
        num => num  // Key function (number itself)
      )((numSignal) => el.method('li')(String(numSignal())) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Reorder to: [6, 5, 1, 2, 3, 4]
    // LIS: [1, 2, 3, 4] at positions [2, 3, 4, 5]
    // Elements 6, 5 both need to move before the LIS
    items([6, 5, 1, 2, 3, 4]);

    // CRITICAL: 6 and 5 must be in correct order before LIS
    expect(getTextContent(ul.children[0] as MockElement)).toBe('6');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('5');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('1');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('2');
    expect(getTextContent(ul.children[4] as MockElement)).toBe('3');
    expect(getTextContent(ul.children[5] as MockElement)).toBe('4');
  });

  it('should handle interleaved LIS and non-LIS elements', () => {
    const { el, map, signal } = setup();

    // Initial: [A, B, C, D, E, F]
    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
      { id: 5, name: 'E' },
      { id: 6, name: 'F' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Reorder to: [F, A, E, B, D, C]
    // LIS: [A, B, C] at positions [1, 3, 5]
    // Non-LIS that need moving: F (before A), E (between A and B), D (between B and C)
    items([
      { id: 6, name: 'F' },
      { id: 1, name: 'A' },
      { id: 5, name: 'E' },
      { id: 2, name: 'B' },
      { id: 4, name: 'D' },
      { id: 3, name: 'C' },
    ]);

    // CRITICAL: Each element must be in exact position
    const order = [0, 1, 2, 3, 4, 5].map(
      (i) => getTextContent(ul.children[i] as MockElement)
    );
    expect(order).toEqual(['F', 'A', 'E', 'B', 'D', 'C']);
  });

  it('should handle swap of adjacent elements', () => {
    const { el, map, signal } = setup();

    const items = signal([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Swap first two: [B, A, C]
    // LIS: [A, C] (positions 1, 2 maintain increasing order)
    // B needs to move before A
    items([
      { id: 2, name: 'B' },
      { id: 1, name: 'A' },
      { id: 3, name: 'C' },
    ]);

    expect(getTextContent(ul.children[0] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('C');

    // Swap back: [A, B, C]
    items([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ]);

    expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('C');
  });

  it('should handle rotation pattern', () => {
    const { el, map, signal } = setup();

    const items = signal([1, 2, 3, 4]);

    const list = el.method('ul')(
      map(
        () => items(),
        num => num  // Key function (number itself)
      )((numSignal) => el.method('li')(String(numSignal())) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Rotate right: [4, 1, 2, 3]
    items([4, 1, 2, 3]);

    expect(getTextContent(ul.children[0] as MockElement)).toBe('4');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('1');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('2');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('3');

    // Rotate right again: [3, 4, 1, 2]
    items([3, 4, 1, 2]);

    expect(getTextContent(ul.children[0] as MockElement)).toBe('3');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('4');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('1');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('2');
  });
});

describe('List reconciliation - Edge cases', () => {
  function setup() {
    const env = createTestEnv();
    const el = El<MockRendererConfig>().create({
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      createElementScope: env.createElementScope,
      disposeScope: env.disposeScope,
      onCleanup: env.onCleanup,
      getElementScope: env.getElementScope,
    });

    const mapFactory = Map<MockRendererConfig>().create({
      signal: env.signal,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      disposeScope: env.disposeScope,
      getElementScope: env.getElementScope,
    });

    return { ...env, el, map: mapFactory.method };
  }

  it('should handle single element (no LIS needed)', () => {
    const { el, map, signal } = setup();

    const items = signal([{ id: 1, name: 'A' }]);

    const list = el.method('ul')(
      map(
        () => items(),
        item => item.id  // Key function
      )((itemSignal) => el.method('li')(itemSignal().name) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;
    const elem = ul.children[0];

    // Update same single item
    items([{ id: 1, name: 'A' }]);

    // Should reuse element
    expect(ul.children[0]).toBe(elem);
  });

  it('should handle all elements in LIS (no moves needed)', () => {
    const { el, map, signal } = setup();

    const items = signal([1, 2, 3, 4, 5]);

    const list = el.method('ul')(
      map(
        () => items(),
        num => num  // Key function (number itself)
      )((numSignal) => el.method('li')(String(numSignal())) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;
    const elements = [
      ul.children[0],
      ul.children[1],
      ul.children[2],
      ul.children[3],
      ul.children[4],
    ];

    // Same order - all in LIS
    items([1, 2, 3, 4, 5]);

    // All elements should be reused without moving
    expect(ul.children[0]).toBe(elements[0]);
    expect(ul.children[1]).toBe(elements[1]);
    expect(ul.children[2]).toBe(elements[2]);
    expect(ul.children[3]).toBe(elements[3]);
    expect(ul.children[4]).toBe(elements[4]);
  });

  it('should handle no elements in LIS (complete reorder)', () => {
    const { el, map, signal } = setup();

    const items = signal([1, 2, 3, 4]);

    const list = el.method('ul')(
      map(
        () => items(),
        num => num  // Key function (number itself)
      )((numSignal) => el.method('li')(String(numSignal())) as unknown as RefSpec<MockElement>)
    );

    const ul = list.create().element as unknown as MockElement;

    // Complete reverse - no LIS
    items([4, 3, 2, 1]);

    expect(getTextContent(ul.children[0] as MockElement)).toBe('4');
    expect(getTextContent(ul.children[1] as MockElement)).toBe('3');
    expect(getTextContent(ul.children[2] as MockElement)).toBe('2');
    expect(getTextContent(ul.children[3] as MockElement)).toBe('1');
  });
});
