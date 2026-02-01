/**
 * Tests for reconcile - array diffing algorithm with iter
 */

import { describe, it, expect } from 'vitest';
import { reconcile, type ReconcileCallbacks } from './reconcile';
import { createIterFactory, type Iter } from './iter';

type Item = { id: number; text: string };
const keyFn = (item: Item) => item.id;

// Simple signal mock for testing
const mockSignal = <T>(initial: T) => {
  let value = initial;
  const fn = (newValue?: T) => {
    if (newValue !== undefined) value = newValue;
    return value;
  };
  fn.peek = () => value;
  return fn;
};

const iterFactory = createIterFactory({ signal: mockSignal as never });

type Op =
  | { type: 'insert'; key: string | number; before: string | number | null }
  | { type: 'remove'; key: string | number }
  | { type: 'move'; key: string | number; before: string | number | null }
  | { type: 'update'; key: string | number; oldValue: Item };

// Helper to collect callbacks into ops array for testing
function collectOps(oldItems: Item[], newItems: Item[]): { ops: Op[]; list: Iter<Item> } {
  const list = iterFactory(keyFn, oldItems);
  const ops: Op[] = [];
  const callbacks: ReconcileCallbacks<Item> = {
    onInsert: (node, beforeNode) =>
      ops.push({ type: 'insert', key: node.key, before: beforeNode?.key ?? null }),
    onRemove: (node) => ops.push({ type: 'remove', key: node.key }),
    onMove: (node, beforeNode) =>
      ops.push({ type: 'move', key: node.key, before: beforeNode?.key ?? null }),
    onUpdate: (node, oldValue) =>
      ops.push({ type: 'update', key: node.key, oldValue }),
  };
  reconcile(list, newItems, callbacks);
  return { ops, list };
}

describe('reconcile', () => {
  describe('empty cases', () => {
    it('should return empty for empty to empty', () => {
      const { ops } = collectOps([], []);
      expect(ops).toEqual([]);
    });

    it('should return removes for clear', () => {
      const { ops } = collectOps(
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
        ],
        []
      );
      expect(ops).toEqual([
        { type: 'remove', key: 1 },
        { type: 'remove', key: 2 },
        { type: 'remove', key: 3 },
      ]);
    });

    it('should return inserts for create from empty', () => {
      const { ops, list } = collectOps([], [
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
      ]);
      expect(ops).toEqual([
        { type: 'insert', key: 1, before: null },
        { type: 'insert', key: 2, before: null },
      ]);
      expect(list.size).toBe(2);
      expect([...list]).toEqual([
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
      ]);
    });
  });

  describe('append', () => {
    it('should detect pure append', () => {
      const { ops, list } = collectOps(
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
        ],
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
          { id: 4, text: 'four' },
        ]
      );

      const inserts = ops.filter((op) => op.type === 'insert');
      expect(inserts.length).toBe(2);
      expect(inserts.map((op) => op.key)).toContain(3);
      expect(inserts.map((op) => op.key)).toContain(4);
      expect(ops.filter((op) => op.type === 'move')).toEqual([]);
      expect(ops.filter((op) => op.type === 'remove')).toEqual([]);
      expect(list.size).toBe(4);
    });
  });

  describe('prepend', () => {
    it('should detect pure prepend', () => {
      const { ops, list } = collectOps(
        [
          { id: 3, text: 'three' },
          { id: 4, text: 'four' },
        ],
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
          { id: 4, text: 'four' },
        ]
      );

      const inserts = ops.filter((op) => op.type === 'insert');
      expect(inserts.length).toBe(2);
      expect(ops.filter((op) => op.type === 'move')).toEqual([]);
      expect(ops.filter((op) => op.type === 'remove')).toEqual([]);
      expect(list.size).toBe(4);
      expect([...list].map((i) => i.id)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('remove', () => {
    it('should detect removals', () => {
      const { ops, list } = collectOps(
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
        ],
        [{ id: 2, text: 'two' }]
      );

      expect(ops.filter((op) => op.type === 'remove')).toEqual([
        { type: 'remove', key: 1 },
        { type: 'remove', key: 3 },
      ]);
      expect(list.size).toBe(1);
    });
  });

  describe('reorder', () => {
    it('should detect moves for reverse', () => {
      const { ops } = collectOps(
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
        ],
        [
          { id: 3, text: 'three' },
          { id: 2, text: 'two' },
          { id: 1, text: 'one' },
        ]
      );

      const moves = ops.filter((op) => op.type === 'move');
      expect(moves.length).toBeLessThanOrEqual(2); // LIS optimization
      expect(ops.filter((op) => op.type === 'remove')).toEqual([]);
      expect(ops.filter((op) => op.type === 'insert')).toEqual([]);
    });

    it('should use LIS for minimal moves', () => {
      // [1,2,3,4,5] -> [1,3,5,2,4]
      // LIS is [1,3,5] or [1,2,4] - length 3
      // So only 2 items need to move
      const { ops, list } = collectOps(
        [
          { id: 1, text: '1' },
          { id: 2, text: '2' },
          { id: 3, text: '3' },
          { id: 4, text: '4' },
          { id: 5, text: '5' },
        ],
        [
          { id: 1, text: '1' },
          { id: 3, text: '3' },
          { id: 5, text: '5' },
          { id: 2, text: '2' },
          { id: 4, text: '4' },
        ]
      );

      const moves = ops.filter((op) => op.type === 'move');
      expect(moves.length).toBe(2);
      expect([...list].map((i) => i.id)).toEqual([1, 3, 5, 2, 4]);
    });
  });

  describe('update', () => {
    it('should detect updates for changed values', () => {
      const old1 = { id: 1, text: 'old-one' };
      const old2 = { id: 2, text: 'two' };
      const new1 = { id: 1, text: 'new-one' };

      const { ops, list } = collectOps([old1, old2], [new1, old2]);

      const updates = ops.filter((op) => op.type === 'update');
      expect(updates.length).toBe(1);
      expect(updates[0]).toEqual({
        type: 'update',
        key: 1,
        oldValue: old1,
      });
      // Value should be updated in the list
      expect(list.get(1)).toEqual(new1);
    });

    it('should skip update for same reference', () => {
      const item1 = { id: 1, text: 'one' };
      const item2 = { id: 2, text: 'two' };

      const { ops } = collectOps([item1, item2], [item1, item2]);

      const updates = ops.filter((op) => op.type === 'update');
      expect(updates).toEqual([]);
    });
  });

  describe('mixed operations', () => {
    it('should handle add + remove + reorder', () => {
      const { ops, list } = collectOps(
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
        ],
        [
          { id: 4, text: 'four' },
          { id: 2, text: 'two' },
          { id: 1, text: 'one' },
        ]
      );

      expect(ops.filter((op) => op.type === 'remove')).toContainEqual({
        type: 'remove',
        key: 3,
      });
      expect(ops.filter((op) => op.type === 'insert').length).toBe(1);
      expect([...list].map((i) => i.id)).toEqual([4, 2, 1]);
    });
  });

  describe('iter mutation', () => {
    it('should correctly mutate iter state', () => {
      const list = iterFactory(keyFn, [
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
      ]);

      reconcile(list, [
        { id: 2, text: 'two-updated' },
        { id: 3, text: 'three' },
        { id: 1, text: 'one-updated' },
      ]);

      expect(list.size).toBe(3);
      expect([...list].map((i) => i.id)).toEqual([2, 3, 1]);
      expect(list.get(1)?.text).toBe('one-updated');
      expect(list.get(2)?.text).toBe('two-updated');
      expect(list.get(3)?.text).toBe('three');
    });
  });
});
