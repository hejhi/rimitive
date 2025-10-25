/**
 * Tests for mixed keyed/unkeyed RefSpecs in reconciliation
 *
 * These tests verify behavior when some RefSpecs have explicit keys
 * and others rely on index-based key fallback:
 * - Do unkeyed items behave positionally?
 * - Do keyed items preserve identity correctly?
 * - Does mixing both work as expected?
 * - Are elements recreated vs reused appropriately?
 *
 * Tests use real API patterns and verify observable behavior only.
 */

import { describe, it, expect } from 'vitest';
import { reconcileWithKeys, type ReconcileState } from './reconcile';
import { createTestEnv, MockElement, getTextContent } from '../test-utils';
import type { RefSpec } from '../types';

describe('reconcileWithKeys - Mixed keys', () => {
  function setup() {
    const env = createTestEnv();
    const parent = env.renderer.createElement('ul');

    const state: ReconcileState<MockElement> = {
      itemsByKey: new Map(),
      parentElement: parent,
    };

    const oldIndicesBuf: number[] = [];
    const newPosBuf: number[] = [];
    const lisBuf: number[] = [];

    // Helper to create keyed RefSpec (returns unique element each time)
    const createKeyedItem = (key: string, text: string): RefSpec<MockElement> => {
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

    // Helper to create unkeyed RefSpec (relies on index fallback)
    const createUnkeyedItem = (text: string): RefSpec<MockElement> => {
      const li = env.renderer.createElement('li');
      const textNode = env.renderer.createTextNode(text);
      env.renderer.appendChild(li, textNode);

      const refSpec: RefSpec<MockElement> = () => refSpec;
      // No key property set - will use index
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

    return { ...env, parent, state, createKeyedItem, createUnkeyedItem, reconcile };
  }

  describe('Static header with dynamic list', () => {
    it('should handle unkeyed header with keyed items', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      // Common pattern: static header + dynamic list
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(4);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Header');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('Cherry');
    });

    it('should preserve header when list items reorder', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
      ]);

      const headerEl = parent.children[0];
      const appleEl = parent.children[1];
      const bananaEl = parent.children[2];

      // Reorder items, header stays at position 0
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('a', 'Apple'),
      ]);

      // Header reused (same position, same index-based key "0")
      expect(parent.children[0]).toBe(headerEl);

      // Items reordered but reused (keyed)
      expect(parent.children[1]).toBe(bananaEl);
      expect(parent.children[2]).toBe(appleEl);
    });

    it('should handle adding items after header', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
      ]);

      expect(parent.children.length).toBe(2);

      // Add more items after header
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(4);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Header');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('Cherry');
    });

    it('should handle removing items after header', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      const headerEl = parent.children[0];

      // Remove items, keep header
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
      ]);

      expect(parent.children.length).toBe(2);
      expect(parent.children[0]).toBe(headerEl);
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Apple');
    });
  });

  describe('Multiple unkeyed items', () => {
    it('should handle all unkeyed items positionally', () => {
      const { parent, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');
    });

    it('should reuse unkeyed items at same positions', () => {
      const { parent, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      const aEl = parent.children[0];
      const bEl = parent.children[1];
      const cEl = parent.children[2];

      // Same positions, different content (but same RefSpecs with same indices)
      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      // Elements reused (index-based keys: "0", "1", "2")
      expect(parent.children[0]).toBe(aEl);
      expect(parent.children[1]).toBe(bEl);
      expect(parent.children[2]).toBe(cEl);
    });

    it('should preserve unkeyed items at same positions (positional behavior)', () => {
      const { parent, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('A'),
        createUnkeyedItem('B'),
        createUnkeyedItem('C'),
      ]);

      const aEl = parent.children[0];
      const bEl = parent.children[1];
      const cEl = parent.children[2];

      // "Reorder" - but unkeyed items use index-based keys
      // Position 0 key="0" matches old position 0 key="0", so element is reused
      reconcile([
        createUnkeyedItem('C'),
        createUnkeyedItem('B'),
        createUnkeyedItem('A'),
      ]);

      // Unkeyed items are positional - they stay at same positions
      // Content doesn't change because elements are reused based on position
      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('B');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');

      // Elements are reused (same position = same key)
      expect(parent.children[0]).toBe(aEl);
      expect(parent.children[1]).toBe(bEl);
      expect(parent.children[2]).toBe(cEl);
    });
  });

  describe('Mixed keyed and unkeyed within list', () => {
    it('should handle alternating keyed and unkeyed items', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createUnkeyedItem('Divider'),
        createKeyedItem('b', 'Banana'),
        createUnkeyedItem('Divider'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(5);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Divider');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('Divider');
      expect(getTextContent(parent.children[4] as MockElement)).toBe('Cherry');
    });

    it('should preserve keyed items when mixed items reorder', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createUnkeyedItem('Divider'),
        createKeyedItem('b', 'Banana'),
      ]);

      const appleEl = parent.children[0];
      const dividerEl = parent.children[1];
      const bananaEl = parent.children[2];

      // Reorder: keyed items should be preserved, unkeyed at same position
      reconcile([
        createKeyedItem('b', 'Banana'),
        createUnkeyedItem('Divider'),
        createKeyedItem('a', 'Apple'),
      ]);

      // Keyed items preserved and reordered
      expect(parent.children[0]).toBe(bananaEl);
      expect(parent.children[2]).toBe(appleEl);

      // Unkeyed item at position 1 - should be reused (index-based key "1")
      expect(parent.children[1]).toBe(dividerEl);
    });

    it('should handle adding keyed item to mixed list', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
      ]);

      expect(parent.children.length).toBe(2);

      // Add keyed item
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Header');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Banana');
    });

    it('should handle removing keyed item from mixed list', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      const headerEl = parent.children[0];

      // Remove middle keyed item
      reconcile([
        createUnkeyedItem('Header'),
        createKeyedItem('a', 'Apple'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(parent.children[0]).toBe(headerEl);
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });
  });

  describe('Key type transitions', () => {
    it('should handle item losing its key (keyed → unkeyed)', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile, state } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      const appleEl = parent.children[0];
      const bananaEl = parent.children[1];

      // Middle item loses key - becomes unkeyed at position 1
      reconcile([
        createKeyedItem('a', 'Apple'),
        createUnkeyedItem('Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      // Keyed items preserved
      expect(parent.children[0]).toBe(appleEl);

      // Item at position 1 now has index-based key "1" instead of "b"
      // This won't match old key "b", so element is recreated
      expect(parent.children[1]).not.toBe(bananaEl);
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');

      // Old "b" key removed from state
      expect(state.itemsByKey.has('b')).toBe(false);
      // New index-based key "1" added
      expect(state.itemsByKey.has('1')).toBe(true);
    });

    it('should handle item gaining a key (unkeyed → keyed)', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile, state } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createUnkeyedItem('Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      const bananaEl = parent.children[1];

      // Middle item gains key
      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      // Item at position 1 now has explicit key "b" instead of index "1"
      // Keys don't match ("1" vs "b"), so element is recreated
      expect(parent.children[1]).not.toBe(bananaEl);
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');

      // Old index-based key "1" removed
      expect(state.itemsByKey.has('1')).toBe(false);
      // New explicit key "b" added
      expect(state.itemsByKey.has('b')).toBe(true);
    });

    it('should handle multiple items transitioning keys simultaneously', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      // All lose keys
      reconcile([
        createUnkeyedItem('Apple'),
        createUnkeyedItem('Banana'),
        createUnkeyedItem('Cherry'),
      ]);

      // Content preserved but elements recreated (key mismatch)
      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');

      // All gain keys again
      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(parent.children.length).toBe(3);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('Cherry');
    });
  });

  describe('Real-world patterns', () => {
    it('should handle conditional keys based on item properties', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      // Pattern: only important items get keys
      const createConditionalItem = (text: string, important: boolean, id?: string) => {
        return important && id
          ? createKeyedItem(id, text)
          : createUnkeyedItem(text);
      };

      reconcile([
        createConditionalItem('Regular 1', false),
        createConditionalItem('Important 1', true, 'imp1'),
        createConditionalItem('Regular 2', false),
        createConditionalItem('Important 2', true, 'imp2'),
      ]);

      expect(parent.children.length).toBe(4);

      const imp1El = parent.children[1];
      const imp2El = parent.children[3];

      // Reorder - important items should be preserved
      reconcile([
        createConditionalItem('Important 2', true, 'imp2'),
        createConditionalItem('Regular 1', false),
        createConditionalItem('Important 1', true, 'imp1'),
        createConditionalItem('Regular 2', false),
      ]);

      expect(parent.children.length).toBe(4);

      // Important items preserved
      expect(parent.children[0]).toBe(imp2El);
      expect(parent.children[2]).toBe(imp1El);

      // Regular items recreated (index-based keys changed)
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Regular 1');
      expect(getTextContent(parent.children[3] as MockElement)).toBe('Regular 2');
    });

    it('should handle section headers with keyed content', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('Section A'),
        createKeyedItem('a1', 'Item A1'),
        createKeyedItem('a2', 'Item A2'),
        createUnkeyedItem('Section B'),
        createKeyedItem('b1', 'Item B1'),
        createKeyedItem('b2', 'Item B2'),
      ]);

      expect(parent.children.length).toBe(6);

      const sectionAEl = parent.children[0];
      const a1El = parent.children[1];
      const a2El = parent.children[2];
      const sectionBEl = parent.children[3];

      // Remove items from section A, keep headers
      reconcile([
        createUnkeyedItem('Section A'),
        createKeyedItem('a1', 'Item A1'),
        createUnkeyedItem('Section B'),
        createKeyedItem('b1', 'Item B1'),
        createKeyedItem('b2', 'Item B2'),
      ]);

      expect(parent.children.length).toBe(5);

      // Section headers reused at same positions
      expect(parent.children[0]).toBe(sectionAEl);
      expect(parent.children[2]).not.toBe(sectionBEl); // Position changed, recreated

      // Keyed items preserved
      expect(parent.children[1]).toBe(a1El);
    });

    it('should handle empty states with unkeyed placeholder', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      // Empty state
      reconcile([
        createUnkeyedItem('No items'),
      ]);

      expect(parent.children.length).toBe(1);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('No items');

      const placeholderEl = parent.children[0];

      // Add items
      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
      ]);

      expect(parent.children.length).toBe(2);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('Apple');
      expect(getTextContent(parent.children[1] as MockElement)).toBe('Banana');

      // Back to empty
      reconcile([
        createUnkeyedItem('No items'),
      ]);

      expect(parent.children.length).toBe(1);
      expect(getTextContent(parent.children[0] as MockElement)).toBe('No items');

      // Placeholder recreated (was at position 0, still at 0, but content different)
      expect(parent.children[0]).not.toBe(placeholderEl);
    });
  });

  describe('Edge cases', () => {
    it('should handle single keyed item among unkeyed items', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile } = setup();

      reconcile([
        createUnkeyedItem('A'),
        createKeyedItem('special', 'Special'),
        createUnkeyedItem('C'),
      ]);

      const aEl = parent.children[0];
      const specialEl = parent.children[1];
      const cEl = parent.children[2];

      // "Reorder" with keyed item
      reconcile([
        createUnkeyedItem('C'),
        createKeyedItem('special', 'Special'),
        createUnkeyedItem('A'),
      ]);

      // Keyed item preserved and stays at position 1
      expect(parent.children[1]).toBe(specialEl);

      // Unkeyed items are positional - they stay at their positions
      // Position 0 has key="0", position 2 has key="2"
      expect(parent.children[0]).toBe(aEl); // Same element at position 0
      expect(parent.children[2]).toBe(cEl); // Same element at position 2
      expect(getTextContent(parent.children[0] as MockElement)).toBe('A');
      expect(getTextContent(parent.children[2] as MockElement)).toBe('C');
    });

    it('should handle all items becoming unkeyed', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile, state } = setup();

      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      expect(state.itemsByKey.has('a')).toBe(true);
      expect(state.itemsByKey.has('b')).toBe(true);
      expect(state.itemsByKey.has('c')).toBe(true);

      // All become unkeyed
      reconcile([
        createUnkeyedItem('Apple'),
        createUnkeyedItem('Banana'),
        createUnkeyedItem('Cherry'),
      ]);

      // Old explicit keys removed
      expect(state.itemsByKey.has('a')).toBe(false);
      expect(state.itemsByKey.has('b')).toBe(false);
      expect(state.itemsByKey.has('c')).toBe(false);

      // New index-based keys
      expect(state.itemsByKey.has('0')).toBe(true);
      expect(state.itemsByKey.has('1')).toBe(true);
      expect(state.itemsByKey.has('2')).toBe(true);
    });

    it('should handle all items becoming keyed', () => {
      const { parent, createKeyedItem, createUnkeyedItem, reconcile, state } = setup();

      reconcile([
        createUnkeyedItem('Apple'),
        createUnkeyedItem('Banana'),
        createUnkeyedItem('Cherry'),
      ]);

      expect(state.itemsByKey.has('0')).toBe(true);
      expect(state.itemsByKey.has('1')).toBe(true);
      expect(state.itemsByKey.has('2')).toBe(true);

      // All become keyed
      reconcile([
        createKeyedItem('a', 'Apple'),
        createKeyedItem('b', 'Banana'),
        createKeyedItem('c', 'Cherry'),
      ]);

      // Old index keys removed
      expect(state.itemsByKey.has('0')).toBe(false);
      expect(state.itemsByKey.has('1')).toBe(false);
      expect(state.itemsByKey.has('2')).toBe(false);

      // New explicit keys
      expect(state.itemsByKey.has('a')).toBe(true);
      expect(state.itemsByKey.has('b')).toBe(true);
      expect(state.itemsByKey.has('c')).toBe(true);
    });
  });
});
