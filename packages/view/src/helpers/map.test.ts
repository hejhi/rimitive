/**
 * User-facing tests for reactive list reconciliation
 *
 * Tests verify observable behavior from the user's perspective:
 * - Does the DOM reflect the correct content?
 * - Does the DOM update correctly when data changes?
 * - Are elements preserved when they should be?
 *
 * Tests use the real API (el + map) as users would.
 * No testing of internal implementation details.
 */

import { describe, it, expect } from 'vitest';
import { createTestEnv, MockElement, getTextContent } from '../test-utils';
import { createMapHelper } from './map';
import { createElFactory } from '../el';

describe('map() - User-facing behavior', () => {
  // Helper to set up test environment
  function setup() {
    const env = createTestEnv();
    const el = createElFactory({
      ctx: env.ctx,
      scopedEffect: env.scopedEffect,
      renderer: env.renderer,
      processChildren: env.processChildren,
      withScope: env.withScope,
    });

    const map = createMapHelper({
      ctx: env.ctx,
      signalCtx: env.signalCtx,
      signal: env.signal,
      scopedEffect: env.scopedEffect,
      withElementScope: env.withElementScope,
      renderer: env.renderer,
      createScope: env.createScope,
      disposeScope: env.disposeScope,
    });

    return { ...env, el, map };
  }

  describe('Initial rendering', () => {
    it('should render a list of items', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Banana' },
        { id: 3, name: 'Cherry' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Cherry');
    });

    it('should render empty list', () => {
      const { el, map, signal } = setup();

      const items = signal<Array<{ id: number; name: string }>>([]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(0);
    });

    it('should render single item', () => {
      const { el, map, signal } = setup();

      const items = signal([{ id: 1, name: 'Only' }]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(1);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Only');
    });
  });

  describe('Adding items', () => {
    it('should add item to end', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(2);

      // Add item to end
      items([...items(), { id: 3, name: 'Third' }]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Third');
    });

    it('should add item to beginning', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(2);

      // Add item to beginning
      items([{ id: 1, name: 'First' }, ...items()]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Third');
    });

    it('should add item to middle', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(2);

      // Add item to middle
      const current = items();
      items([current[0]!, { id: 2, name: 'Second' }, current[1]!]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Third');
    });

    it('should add multiple items at once', () => {
      const { el, map, signal } = setup();

      const items = signal([{ id: 1, name: 'First' }]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(1);

      // Add multiple items
      items([
        ...items(),
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
        { id: 4, name: 'Fourth' },
      ]);

      expect(ul.children.length).toBe(4);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Third');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('Fourth');
    });

    it('should populate from empty', () => {
      const { el, map, signal } = setup();

      const items = signal<Array<{ id: number; name: string }>>([]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(0);

      // Populate from empty
      items([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ]);

      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
    });
  });

  describe('Removing items', () => {
    it('should remove item from end', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(3);

      // Remove from end
      items(items().slice(0, 2));

      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
    });

    it('should remove item from beginning', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(3);

      // Remove from beginning
      items(items().slice(1));

      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Third');
    });

    it('should remove item from middle', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(3);

      // Remove middle item
      const current = items();
      items([current[0]!, current[2]!]);

      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Third');
    });

    it('should remove multiple items at once', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
        { id: 4, name: 'Fourth' },
        { id: 5, name: 'Fifth' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(5);

      // Remove multiple items
      const current = items();
      items([current[0]!, current[4]!]);

      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('First');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Fifth');
    });

    it('should clear all items', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(2);

      // Clear all
      items([]);

      expect(ul.children.length).toBe(0);
    });
  });

  describe('Reordering items (LIS algorithm)', () => {
    it('should reverse list order', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Reverse order
      items([...items()].reverse());

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Third');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('First');
    });

    it('should handle swap of two items', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Swap first and third
      const current = items();
      items([current[2]!, current[1]!, current[0]!]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Third');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Second');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('First');
    });

    it('should handle complex shuffle', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Complex shuffle: [A,B,C,D,E] → [D,B,E,A,C]
      const current = items();
      items([current[3]!, current[1]!, current[4]!, current[0]!, current[2]!]);

      expect(ul.children.length).toBe(5);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('E');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('C');
    });

    it('should handle rotation', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Rotate right: [A,B,C,D] → [D,A,B,C]
      const current = items();
      items([current[3]!, current[0]!, current[1]!, current[2]!]);

      expect(ul.children.length).toBe(4);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('C');
    });

    it('should handle LIS at beginning', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // LIS at beginning: [A,B,C,D,E] → [A,B,E,C,D]
      // LIS: [A,B] (indices 0,1), others move
      const current = items();
      items([current[0]!, current[1]!, current[4]!, current[2]!, current[3]!]);

      expect(ul.children.length).toBe(5);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('E');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('D');
    });

    it('should handle LIS at end', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // LIS at end: [A,B,C,D,E] → [C,A,B,D,E]
      // LIS: [D,E] (indices 3,4), others move
      const current = items();
      items([current[2]!, current[0]!, current[1]!, current[3]!, current[4]!]);

      expect(ul.children.length).toBe(5);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('E');
    });

    it('should handle LIS in middle with moves around it', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
        { id: 6, name: 'F' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // LIS in middle: [A,B,C,D,E,F] → [F,B,C,D,A,E]
      // LIS: [B,C,D] (indices 1,2,3), A and F move before, E moves after
      const current = items();
      items([current[5]!, current[1]!, current[2]!, current[3]!, current[0]!, current[4]!]);

      expect(ul.children.length).toBe(6);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('F');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[5] as MockElement)).toBe('E');
    });

    it('should handle multiple non-LIS elements between LIS elements', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
        { id: 6, name: 'F' },
        { id: 7, name: 'G' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // LIS: [A,C,E,G] (indices 0,2,4,6)
      // Non-LIS: [B,D,F] need to move
      // New order: [A,F,D,C,B,E,G]
      const current = items();
      items([current[0]!, current[5]!, current[3]!, current[2]!, current[1]!, current[4]!, current[6]!]);

      expect(ul.children.length).toBe(7);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('F');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('B');
      expect(getTextContent(ul.children[5] as MockElement)).toBe('E');
      expect(getTextContent(ul.children[6] as MockElement)).toBe('G');
    });
  });

  describe('Mixed operations', () => {
    it('should handle add + remove + reorder in single update', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Remove B, add E and F, reorder: [A,B,C,D] → [E,D,A,F,C]
      items([
        { id: 5, name: 'E' },
        { id: 4, name: 'D' },
        { id: 1, name: 'A' },
        { id: 6, name: 'F' },
        { id: 3, name: 'C' },
      ]);

      expect(ul.children.length).toBe(5);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('E');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[3] as MockElement)).toBe('F');
      expect(getTextContent(ul.children[4] as MockElement)).toBe('C');
    });

    it('should handle complete replacement with reorder', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Complete replacement
      items([
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
        { id: 6, name: 'F' },
      ]);

      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('D');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('E');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('F');
    });

    it('should handle multiple consecutive updates', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Update 1: Add item
      items([...items(), { id: 3, name: 'C' }]);
      expect(ul.children.length).toBe(3);

      // Update 2: Reorder
      items([items()[2]!, items()[0]!, items()[1]!]);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('A');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('B');

      // Update 3: Remove item
      items([items()[0]!, items()[2]!]);
      expect(ul.children.length).toBe(2);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('C');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
    });
  });

  describe('Large lists', () => {
    it('should handle list of 100 items', () => {
      const { el, map, signal } = setup();

      const items = signal(
        Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Item ${i}` }))
      );

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;
      expect(ul.children.length).toBe(100);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Item 0');
      expect(getTextContent(ul.children[99] as MockElement)).toBe('Item 99');

      // Reverse large list
      items([...items()].reverse());
      expect(ul.children.length).toBe(100);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Item 99');
      expect(getTextContent(ul.children[99] as MockElement)).toBe('Item 0');
    });

    it('should handle deep reordering in large list', () => {
      const { el, map, signal } = setup();

      const items = signal(
        Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i}` }))
      );

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Complex shuffle: move every 5th item to front
      const current = items();
      const everyFifth = current.filter((_, i) => i % 5 === 0);
      const rest = current.filter((_, i) => i % 5 !== 0);
      items([...everyFifth, ...rest]);

      expect(ul.children.length).toBe(50);
      expect(getTextContent(ul.children[0] as MockElement)).toBe('Item 0');
      expect(getTextContent(ul.children[1] as MockElement)).toBe('Item 5');
      expect(getTextContent(ul.children[2] as MockElement)).toBe('Item 10');
    });
  });

  describe('Single element return (match replacement)', () => {
    it('should handle conditional rendering with keys for state changes', () => {
      const { el, map, signal } = setup();

      type Mode = 'loading' | 'error' | 'success';
      const mode = signal<Mode>('loading');

      const view = el.method([
        'div',
        map(
          () => [mode()],
          (modeSignal) => {
            const m = modeSignal();
            // Key is required to distinguish different states
            if (m === 'loading') return el.method(['div', 'Loading...'], 'loading');
            if (m === 'error') return el.method(['div', 'Error occurred'], 'error');
            return el.method(['div', 'Success!'], 'success');
          }
        ),
      ]);

      const div = view.create().element as MockElement;

      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Loading...');

      mode('error');
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Error occurred');

      mode('success');
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Success!');

      mode('loading');
      expect(div.children.length).toBe(1);
      expect(getTextContent(div.children[0] as MockElement)).toBe('Loading...');
    });
  });

  describe('Element identity preservation', () => {
    it('should preserve element identity when list content unchanged', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Capture original element references
      const firstEl = ul.children[0];
      const secondEl = ul.children[1];
      const thirdEl = ul.children[2];

      // Update signal with SAME content (same keys)
      items([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]);

      // CRITICAL: Elements should be SAME objects (not recreated)
      expect(ul.children[0]).toBe(firstEl);
      expect(ul.children[1]).toBe(secondEl);
      expect(ul.children[2]).toBe(thirdEl);
    });

    it('should preserve element identity when items reordered', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      const aEl = ul.children[0];
      const bEl = ul.children[1];
      const cEl = ul.children[2];

      // Reverse order
      items([
        { id: 3, name: 'C' },
        { id: 2, name: 'B' },
        { id: 1, name: 'A' },
      ]);

      // Elements reused, just reordered
      expect(ul.children[0]).toBe(cEl);
      expect(ul.children[1]).toBe(bEl);
      expect(ul.children[2]).toBe(aEl);
    });

    it('should preserve unchanged element identity when items added', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 3, name: 'C' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      const aEl = ul.children[0];
      const cEl = ul.children[1];

      // Add item in middle
      items([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ]);

      // A and C should be same elements
      expect(ul.children[0]).toBe(aEl);
      expect(ul.children[2]).toBe(cEl);
      // B is new
      expect(ul.children.length).toBe(3);
      expect(getTextContent(ul.children[1] as MockElement)).toBe('B');
    });

    it('should preserve unchanged element identity when items removed', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      const aEl = ul.children[0];
      const cEl = ul.children[2];

      // Remove middle item
      items([
        { id: 1, name: 'A' },
        { id: 3, name: 'C' },
      ]);

      // A and C should be same elements
      expect(ul.children.length).toBe(2);
      expect(ul.children[0]).toBe(aEl);
      expect(ul.children[1]).toBe(cEl);
    });

    it('should preserve element identity in complex mixed scenario', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
        { id: 4, name: 'D' },
        { id: 5, name: 'E' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => el.method(['li', itemSignal().name]),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Capture references for items that will survive
      const bEl = ul.children[1]; // B
      const dEl = ul.children[3]; // D

      // Complex update: remove A & C, keep B & D, add F, reorder
      items([
        { id: 6, name: 'F' }, // new
        { id: 4, name: 'D' }, // reordered, kept
        { id: 2, name: 'B' }, // reordered, kept
      ]);

      expect(ul.children.length).toBe(3);
      // B and D should be same elements, just repositioned
      expect(ul.children[2]).toBe(bEl);
      expect(ul.children[1]).toBe(dEl);
      // F is new
      expect(getTextContent(ul.children[0] as MockElement)).toBe('F');
    });

    it('should preserve custom element properties across updates', () => {
      const { el, map, signal } = setup();

      const items = signal([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) =>
            el.method(['li', itemSignal().name])((element) => {
              // Simulate attaching custom state during lifecycle
              element.__customState = `state-${itemSignal().id}`;
            }),
          item => item.id  // Key function
        ),
      ]);

      const ul = list.create().element as MockElement;

      // Verify custom state exists
      expect((ul.children[0] as MockElement).__customState).toBe('state-1');
      expect((ul.children[1] as MockElement).__customState).toBe('state-2');

      // Reorder items
      items([
        { id: 2, name: 'B' },
        { id: 1, name: 'A' },
      ]);

      // Custom state should be preserved (elements reused)
      expect((ul.children[0] as MockElement).__customState).toBe('state-2');
      expect((ul.children[1] as MockElement).__customState).toBe('state-1');
    });
  });

  describe('Nested maps', () => {
    it('should handle map inside map with reactive signals', () => {
      const { el, map, signal } = setup();

      const displayValue = signal('initial');

      // Nested map: outer creates div, inner creates span
      // Signal passed to inner element (not called) for reactivity
      const view = el.method([
        'div',
        map(
          () => [{ id: 1 }],
          () =>
            el.method([
              'div',
              map(
                () => [{ id: 1 }],
                () => el.method(['span', displayValue], 1)
              ),
            ], 1)
        ),
      ]);

      const root = view.create().element as MockElement;
      const innerDiv = root.children[0] as MockElement;
      const span = innerDiv.children[0] as MockElement;

      // Initial render
      expect(getTextContent(span)).toBe('initial');

      // Update signal - should update through nested maps
      displayValue('updated');

      // Verify reactive update works
      expect(getTextContent(span)).toBe('updated');
    });

    it('should handle triple nesting with reactive updates', () => {
      const { el, map, signal } = setup();

      const value = signal('initial');

      // Triple nested map to test deep nesting
      const view = el.method([
        'div',
        map(
          () => [{ id: 1 }],
          () =>
            el.method([
              'section',
              map(
                () => [{ id: 1 }],
                () =>
                  el.method([
                    'article',
                    map(
                      () => [{ id: 1 }],
                      () => el.method(['span', value], 1)
                    ),
                  ], 1)
              ),
            ], 1)
        ),
      ]);

      const root = view.create().element as MockElement;
      const section = root.children[0] as MockElement;
      const article = section.children[0] as MockElement;
      const span = article.children[0] as MockElement;

      expect(getTextContent(span)).toBe('initial');

      // Update should propagate through all nesting levels
      value('updated');

      expect(getTextContent(span)).toBe('updated');
    });
  });

  describe('Untracked render()', () => {
    it('should not track outer reactive state in render callback', () => {
      const { el, map, signal } = setup();

      const items = signal([{ id: 1, name: 'Item 1' }]);
      const outerState = signal('outer');
      let renderCount = 0;

      // Create list where render() accidentally reads outerState
      const list = el.method([
        'ul',
        map(
          () => items(),
          (itemSignal) => {
            renderCount++;
            // This read should NOT become a dependency of map's effect
            // because render() is called untracked
            outerState(); // Read but don't track
            return el.method(['li', itemSignal().name]);
          },
          item => item.id
        ),
      ]);

      list.create();
      expect(renderCount).toBe(1);  // Initial render

      // Change outerState - should NOT trigger map reconciliation
      outerState('changed');
      expect(renderCount).toBe(1);  // Still 1 - not re-rendered

      // Change items - SHOULD trigger map reconciliation for new items only
      items([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);
      expect(renderCount).toBe(2);  // Re-rendered once for new item
    });
  });
});
