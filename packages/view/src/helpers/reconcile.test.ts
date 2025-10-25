/**
 * Tests for reconcileWithKeys - the anchor-based LIS reconciliation algorithm
 *
 * These tests verify the core reconciliation behavior:
 * - Does the DOM end up in the correct order after reconciliation?
 * - Are existing elements reused (not recreated)?
 * - Are new elements inserted at the right positions?
 * - Are removed elements properly cleaned up?
 * - Does the LIS algorithm minimize DOM moves?
 *
 * Tests use real RefSpecs and verify observable DOM state.
 * No testing of internal algorithm details - only outcomes.
 */

import { describe, it, expect } from 'vitest';
import { reconcileWithKeys, type ReconcileState } from './reconcile';
import { createTestEnv, MockElement, getTextContent } from '../test-utils';
import type { RefSpec } from '../types';

describe('reconcileWithKeys', () => {
  function setup() {
    const env = createTestEnv();
    const parent = env.renderer.createElement('ul');

    const state: ReconcileState<MockElement> = {
      itemsByKey: new Map(),
      parentElement: parent,
    };

    // Pooled buffers for LIS
    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    // Helper to create keyed RefSpec
    const createItem = (key: string, text: string): RefSpec<MockElement> => {
      const li = env.renderer.createElement('li');
      const textNode = env.renderer.createTextNode(text);
      env.renderer.appendChild(li, textNode);

      const refSpec: RefSpec<MockElement> = () => refSpec;
      refSpec.key = key;
      refSpec.create = () => ({
        status: 1,
        element: li,
        prev: undefined,
        next: undefined,
      });

      return refSpec;
    };

    const reconcile = (refSpecs: RefSpec<MockElement>[]) => {
      reconcileWithKeys(
        refSpecs,
        state,
        env.ctx,
        env.renderer,
        env.disposeScope,
        oldIndicesBuf,
        newPosBuf,
        lisBuf
      );
    };

    return { ...env, parent, state, createItem, reconcile };
  }

  describe('Initial rendering', () => {
    it('should insert all elements on first reconcile', () => {
      const { parent, createItem, reconcile } = setup();

      const items = [
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ];

      reconcile(items);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });

    it('should handle empty array', () => {
      const { parent, reconcile } = setup();

      reconcile([]);

      expect(parent.children.length).toBe(0);
    });

    it('should handle single item', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([createItem('a', 'Only')]);

      expect(parent.children.length).toBe(1);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Only');
    });
  });

  describe('Element reuse', () => {
    it('should reuse elements when keys match', () => {
      const { parent, createItem, reconcile, state } = setup();

      // Initial render
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Store element references
      const appleEl = parent.children[0];
      const bananaEl = parent.children[1];
      const cherryEl = parent.children[2];

      // Reconcile with same keys (but new RefSpecs)
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Elements should be reused (same references)
      expect(parent.children[0]).toBe(appleEl);
      expect(parent.children[1]).toBe(bananaEl);
      expect(parent.children[2]).toBe(cherryEl);

      // State should still track all items
      expect(state.itemsByKey.size).toBe(3);
      expect(state.itemsByKey.has('a')).toBe(true);
      expect(state.itemsByKey.has('b')).toBe(true);
      expect(state.itemsByKey.has('c')).toBe(true);
    });

    it('should reuse elements when keys match after reorder', () => {
      const { parent, createItem, reconcile } = setup();

      // Initial render
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      const appleEl = parent.children[0];
      const bananaEl = parent.children[1];
      const cherryEl = parent.children[2];

      // Reverse order
      reconcile([
        createItem('c', 'Cherry'),
        createItem('b', 'Banana'),
        createItem('a', 'Apple'),
      ]);

      // Elements reused, just reordered
      expect(parent.children[0]).toBe(cherryEl);
      expect(parent.children[1]).toBe(bananaEl);
      expect(parent.children[2]).toBe(appleEl);
    });
  });

  describe('Adding elements', () => {
    it('should add new element to end', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
      ]);

      expect(parent.children.length).toBe(2);

      // Add new element
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });

    it('should add new element to beginning', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Add to beginning
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });

    it('should add new element to middle', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('c', 'Cherry'),
      ]);

      // Add to middle
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });
  });

  describe('Removing elements', () => {
    it('should remove element from end', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Remove from end
      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
    });

    it('should remove element from beginning', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Remove from beginning
      reconcile([
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Cherry');
    });

    it('should remove element from middle', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
        createItem('c', 'Cherry'),
      ]);

      // Remove middle
      reconcile([
        createItem('a', 'Apple'),
        createItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Cherry');
    });

    it('should clear all elements', () => {
      const { parent, createItem, reconcile, state } = setup();

      reconcile([
        createItem('a', 'Apple'),
        createItem('b', 'Banana'),
      ]);

      expect(parent.children.length).toBe(2);

      // Clear all
      reconcile([]);

      expect(parent.children.length).toBe(0);
      expect(state.itemsByKey.size).toBe(0);
    });
  });

  describe('Reordering (LIS algorithm)', () => {
    it('should reverse order', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // Reverse
      reconcile([
        createItem('c', 'C'),
        createItem('b', 'B'),
        createItem('a', 'A'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle swap of two elements', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // Swap first and last
      reconcile([
        createItem('c', 'C'),
        createItem('b', 'B'),
        createItem('a', 'A'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle rotation', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
      ]);

      // Rotate right: [A,B,C,D] → [D,A,B,C]
      reconcile([
        createItem('d', 'D'),
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('C');
    });

    it('should handle complex shuffle', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('e', 'E'),
      ]);

      // Shuffle: [A,B,C,D,E] → [D,B,E,A,C]
      reconcile([
        createItem('d', 'D'),
        createItem('b', 'B'),
        createItem('e', 'E'),
        createItem('a', 'A'),
        createItem('c', 'C'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('C');
    });
  });

  describe('LIS edge cases (anchor-based algorithm)', () => {
    it('should handle empty LIS (all elements need to move)', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // Complete reversal - empty LIS case
      reconcile([
        createItem('c', 'C'),
        createItem('b', 'B'),
        createItem('a', 'A'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle full LIS (no moves needed)', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      const aEl = parent.children[0];
      const bEl = parent.children[1];
      const cEl = parent.children[2];

      // Same order - full LIS, no DOM moves
      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // Same elements, same positions (no moves)
      expect(parent.children[0]).toBe(aEl);
      expect(parent.children[1]).toBe(bEl);
      expect(parent.children[2]).toBe(cEl);
    });

    it('should handle single element LIS', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // LIS: [B] (middle element stays), A and C move
      reconcile([
        createItem('c', 'C'),
        createItem('b', 'B'),
        createItem('a', 'A'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle LIS at beginning with moves after', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('e', 'E'),
      ]);

      // LIS: [A,B] (beginning stable), rest moves
      // [A,B,C,D,E] → [A,B,E,C,D]
      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('e', 'E'),
        createItem('c', 'C'),
        createItem('d', 'D'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('D');
    });

    it('should handle LIS at end with moves before', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('e', 'E'),
      ]);

      // LIS: [D,E] (end stable), rest moves
      // [A,B,C,D,E] → [C,A,B,D,E]
      reconcile([
        createItem('c', 'C'),
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('d', 'D'),
        createItem('e', 'E'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('E');
    });

    it('should handle LIS in middle with moves on both sides', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('e', 'E'),
        createItem('f', 'F'),
      ]);

      // LIS: [B,C,D] (middle stable), A,E,F move
      // [A,B,C,D,E,F] → [F,B,C,D,A,E]
      reconcile([
        createItem('f', 'F'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('a', 'A'),
        createItem('e', 'E'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('F');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[5] as MockElement)).toBe('E');
    });

    it('should handle multiple non-LIS elements between LIS elements', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
        createItem('e', 'E'),
        createItem('f', 'F'),
        createItem('g', 'G'),
      ]);

      // LIS: [A,C,E,G] - sparse LIS
      // Non-LIS: [B,D,F] scattered between
      // [A,B,C,D,E,F,G] → [A,F,D,C,B,E,G]
      reconcile([
        createItem('a', 'A'),
        createItem('f', 'F'),
        createItem('d', 'D'),
        createItem('c', 'C'),
        createItem('b', 'B'),
        createItem('e', 'E'),
        createItem('g', 'G'),
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('F');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[5] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[6] as MockElement)).toBe('G');
    });
  });

  describe('Mixed operations', () => {
    it('should handle add + remove + reorder in single update', () => {
      const { parent, createItem, reconcile } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
        createItem('d', 'D'),
      ]);

      // Remove B, add E and F, reorder
      // [A,B,C,D] → [E,D,A,F,C]
      reconcile([
        createItem('e', 'E'),
        createItem('d', 'D'),
        createItem('a', 'A'),
        createItem('f', 'F'),
        createItem('c', 'C'),
      ]);

      expect(parent.children.length).toBe(5);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('F');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('C');
    });

    it('should handle complete replacement', () => {
      const { parent, createItem, reconcile, state } = setup();

      reconcile([
        createItem('a', 'A'),
        createItem('b', 'B'),
        createItem('c', 'C'),
      ]);

      // Complete replacement
      reconcile([
        createItem('x', 'X'),
        createItem('y', 'Y'),
        createItem('z', 'Z'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('X');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Y');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Z');

      // Old keys should be gone
      expect(state.itemsByKey.has('a')).toBe(false);
      expect(state.itemsByKey.has('b')).toBe(false);
      expect(state.itemsByKey.has('c')).toBe(false);

      // New keys present
      expect(state.itemsByKey.has('x')).toBe(true);
      expect(state.itemsByKey.has('y')).toBe(true);
      expect(state.itemsByKey.has('z')).toBe(true);
    });
  });

  describe('Key fallback behavior', () => {
    it('should use index as key when key is undefined', () => {
      const { parent, reconcile, renderer } = setup();

      // Create RefSpecs without explicit keys
      const createUnkeyedItem = (text: string): RefSpec<MockElement> => {
        const li = renderer.createElement('li');
        const textNode = renderer.createTextNode(text);
        renderer.appendChild(li, textNode);

        const refSpec: RefSpec<MockElement> = () => refSpec;
        // No key set - should fallback to index
        refSpec.create = () => ({
          status: 1,
          element: li,
          prev: undefined,
          next: undefined,
        });

        return refSpec;
      };

      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');

      // Reconcile again - keys are "0", "1", "2"
      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      expect(parent.children.length).toBe(3);
    });
  });

  describe('Large lists', () => {
    it('should handle 100 items efficiently', () => {
      const { parent, createItem, reconcile } = setup();

      const items = Array.from({ length: 100 }, (_, i) =>
        createItem(`key${i}`, `Item ${i}`)
      );

      reconcile(items);

      expect(parent.children.length).toBe(100);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Item 0');
      expect(getTextContent(parent.children[99] as MockElement)).toBe('Item 99');

      // Reverse large list
      reconcile([...items].reverse());

      expect(parent.children.length).toBe(100);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Item 99');
      expect(getTextContent(parent.children[99] as MockElement)).toBe('Item 0');
    });

    it('should handle complex reordering in large list', () => {
      const { parent, createItem, reconcile } = setup();

      const items = Array.from({ length: 50 }, (_, i) =>
        createItem(`key${i}`, `Item ${i}`)
      );

      reconcile(items);

      // Move every 5th item to front
      const everyFifth = items.filter((_, i) => i % 5 === 0);
      const rest = items.filter((_, i) => i % 5 !== 0);

      reconcile([...everyFifth, ...rest]);

      expect(parent.children.length).toBe(50);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Item 0');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Item 5');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Item 10');
    });
  });
});
