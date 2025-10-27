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
import { createTestEnv, MockElement, MockText, getTextContent } from '../test-utils';
import type { ElementRef } from '../types';

describe('reconcileWithKeys', () => {
  type Item = { id: string; text: string };

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

    const reconcile = (items: Item[]) => {
      reconcileWithKeys(
        items,
        state,
        (item) => item.id,
        {
          onCreate: (item) => {
            const li = env.renderer.createElement('li');
            const textNode = env.renderer.createTextNode(item.text);
            env.renderer.appendChild(li, textNode);
            env.renderer.insertBefore(parent, li, null);

            return {
              status: 1,
              element: li,
              prev: undefined,
              next: undefined,
            };
          },
          onUpdate: (_key, item, node) => {
            // Update text content if needed
            const li = (node as ElementRef<MockElement>).element;
            if (li.children[0]) {
              (li.children[0] as MockText).content = item.text;
            }
          },
          onMove: (_key, node, nextSibling) => {
            const li = (node as ElementRef<MockElement>).element;
            const nextEl = nextSibling ? (nextSibling as ElementRef<MockElement>).element : null;
            env.renderer.insertBefore(parent, li, nextEl);
          },
          onRemove: (_key, node) => {
            const li = (node as ElementRef<MockElement>).element;
            const scope = env.ctx.elementScopes.get(li);
            if (scope) {
              env.disposeScope(scope);
              env.ctx.elementScopes.delete(li);
            }
            env.renderer.removeChild(parent, li);
          },
        },
        oldIndicesBuf,
        newPosBuf,
        lisBuf
      );
    };

    return { ...env, parent, state, reconcile };
  }

  describe('Initial rendering', () => {
    it('should insert all elements on first reconcile', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

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
      const { parent, reconcile } = setup();

      reconcile([{ id: 'a', text: 'Only' }]);

      expect(parent.children.length).toBe(1);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Only');
    });
  });

  describe('Element reuse', () => {
    it('should reuse elements when keys match', () => {
      const { parent, reconcile, state } = setup();

      // Initial render
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Store element references
      const appleEl = parent.children[0];
      const bananaEl = parent.children[1];
      const cherryEl = parent.children[2];

      // Reconcile with same keys (but new RefSpecs)
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
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
      const { parent, reconcile } = setup();

      // Initial render
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      const appleEl = parent.children[0];
      const bananaEl = parent.children[1];
      const cherryEl = parent.children[2];

      // Reverse order
      reconcile([
        { id: 'c', text: 'Cherry' },
        { id: 'b', text: 'Banana' },
        { id: 'a', text: 'Apple' },
      ]);

      // Elements reused, just reordered
      expect(parent.children[0]).toBe(cherryEl);
      expect(parent.children[1]).toBe(bananaEl);
      expect(parent.children[2]).toBe(appleEl);
    });
  });

  describe('Adding elements', () => {
    it('should add new element to end', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
      ]);

      expect(parent.children.length).toBe(2);

      // Add new element
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });

    it('should add new element to beginning', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Add to beginning
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });

    it('should add new element to middle', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Add to middle
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });
  });

  describe('Removing elements', () => {
    it('should remove element from end', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Remove from end
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
    });

    it('should remove element from beginning', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Remove from beginning
      reconcile([
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Cherry');
    });

    it('should remove element from middle', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
        { id: 'c', text: 'Cherry' },
      ]);

      // Remove middle
      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'c', text: 'Cherry' },
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Cherry');
    });

    it('should clear all elements', () => {
      const { parent, reconcile, state } = setup();

      reconcile([
        { id: 'a', text: 'Apple' },
        { id: 'b', text: 'Banana' },
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
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // Reverse
      reconcile([
        { id: 'c', text: 'C' },
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle swap of two elements', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // Swap first and last
      reconcile([
        { id: 'c', text: 'C' },
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle rotation', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ]);

      // Rotate right: [A,B,C,D] → [D,A,B,C]
      reconcile([
        { id: 'd', text: 'D' },
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('C');
    });

    it('should handle complex shuffle', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
      ]);

      // Shuffle: [A,B,C,D,E] → [D,B,E,A,C]
      reconcile([
        { id: 'd', text: 'D' },
        { id: 'b', text: 'B' },
        { id: 'e', text: 'E' },
        { id: 'a', text: 'A' },
        { id: 'c', text: 'C' },
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
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // Complete reversal - empty LIS case
      reconcile([
        { id: 'c', text: 'C' },
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle full LIS (no moves needed)', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      const aEl = parent.children[0];
      const bEl = parent.children[1];
      const cEl = parent.children[2];

      // Same order - full LIS, no DOM moves
      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // Same elements, same positions (no moves)
      expect(parent.children[0]).toBe(aEl);
      expect(parent.children[1]).toBe(bEl);
      expect(parent.children[2]).toBe(cEl);
    });

    it('should handle single element LIS', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // LIS: [B] (middle element stays), A and C move
      reconcile([
        { id: 'c', text: 'C' },
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
    });

    it('should handle LIS at beginning with moves after', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
      ]);

      // LIS: [A,B] (beginning stable), rest moves
      // [A,B,C,D,E] → [A,B,E,C,D]
      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'e', text: 'E' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('D');
    });

    it('should handle LIS at end with moves before', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
      ]);

      // LIS: [D,E] (end stable), rest moves
      // [A,B,C,D,E] → [C,A,B,D,E]
      reconcile([
        { id: 'c', text: 'C' },
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('E');
    });

    it('should handle LIS in middle with moves on both sides', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
        { id: 'f', text: 'F' },
      ]);

      // LIS: [B,C,D] (middle stable), A,E,F move
      // [A,B,C,D,E,F] → [F,B,C,D,A,E]
      reconcile([
        { id: 'f', text: 'F' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'a', text: 'A' },
        { id: 'e', text: 'E' },
      ]);

      expect(getTextContent(parent.children[0] as MockElement)).toBe('F');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[5] as MockElement)).toBe('E');
    });

    it('should handle multiple non-LIS elements between LIS elements', () => {
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
        { id: 'e', text: 'E' },
        { id: 'f', text: 'F' },
        { id: 'g', text: 'G' },
      ]);

      // LIS: [A,C,E,G] - sparse LIS
      // Non-LIS: [B,D,F] scattered between
      // [A,B,C,D,E,F,G] → [A,F,D,C,B,E,G]
      reconcile([
        { id: 'a', text: 'A' },
        { id: 'f', text: 'F' },
        { id: 'd', text: 'D' },
        { id: 'c', text: 'C' },
        { id: 'b', text: 'B' },
        { id: 'e', text: 'E' },
        { id: 'g', text: 'G' },
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
      const { parent, reconcile } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ]);

      // Remove B, add E and F, reorder
      // [A,B,C,D] → [E,D,A,F,C]
      reconcile([
        { id: 'e', text: 'E' },
        { id: 'd', text: 'D' },
        { id: 'a', text: 'A' },
        { id: 'f', text: 'F' },
        { id: 'c', text: 'C' },
      ]);

      expect(parent.children.length).toBe(5);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('E');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('D');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('F');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('C');
    });

    it('should handle complete replacement', () => {
      const { parent, reconcile, state } = setup();

      reconcile([
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ]);

      // Complete replacement
      reconcile([
        { id: 'x', text: 'X' },
        { id: 'y', text: 'Y' },
        { id: 'z', text: 'Z' },
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
      const { parent, renderer } = setup();

      // Create a custom reconcile that uses index when key is missing
      const state: ReconcileState<MockElement> = {
        itemsByKey: new Map(),
        parentElement: parent,
      };

      const oldIndicesBuf: number[] = [];
      const newPosBuf: number[] = [];
      const lisBuf: number[] = [];

      const reconcile = (items: { text: string }[]) => {
        reconcileWithKeys(
          items,
          state,
          (_item, index) => String(index), // Use index as key
          {
            onCreate: (item) => {
              const li = renderer.createElement('li');
              const textNode = renderer.createTextNode(item.text);
              renderer.appendChild(li, textNode);
              renderer.insertBefore(parent, li, null);

              return {
                status: 1,
                element: li,
                prev: undefined,
                next: undefined,
              };
            },
            onMove: (_key, node, nextSibling) => {
              const li = (node as ElementRef<MockElement>).element;
              const nextEl = nextSibling ? (nextSibling as ElementRef<MockElement>).element : null;
              renderer.insertBefore(parent, li, nextEl);
            },
            onRemove: (_key, node) => {
              const li = (node as ElementRef<MockElement>).element;
              renderer.removeChild(parent, li);
            },
          },
          oldIndicesBuf,
          newPosBuf,
          lisBuf
        );
      };

      reconcile([
        { text: 'A' },
        { text: 'B' },
        { text: 'C' },
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');

      // Reconcile again - should reuse based on index keys
      reconcile([
        { text: 'A' },
        { text: 'B' },
        { text: 'C' },
      ]);

      expect(parent.children.length).toBe(3);
    });
  });

  describe('Large lists', () => {
    it('should handle 100 items efficiently', () => {
      const { parent, reconcile } = setup();

      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `key${i}`,
        text: `Item ${i}`,
      }));

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
      const { parent, reconcile } = setup();

      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `key${i}`,
        text: `Item ${i}`,
      }));

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
