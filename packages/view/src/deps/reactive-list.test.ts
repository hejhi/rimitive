/**
 * Tests for ReactiveList - verifying O(1) operations
 */

import { describe, it, expect } from 'vitest';
import { createReactiveList } from './reactive-list';

type Item = { id: number; text: string };

describe('ReactiveList', () => {
  describe('O(1) operations', () => {
    it('should append in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      for (let i = 0; i < 1000; i++) {
        list.append({ id: i, text: `Item ${i}` });
      }

      expect(list.size).toBe(1000);
      expect(list.head?.value.id).toBe(0);
      expect(list.tail?.value.id).toBe(999);
    });

    it('should prepend in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      for (let i = 0; i < 1000; i++) {
        list.prepend({ id: i, text: `Item ${i}` });
      }

      expect(list.size).toBe(1000);
      expect(list.head?.value.id).toBe(999);
      expect(list.tail?.value.id).toBe(0);
    });

    it('should remove in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      for (let i = 0; i < 1000; i++) {
        list.append({ id: i, text: `Item ${i}` });
      }

      // Remove from middle - O(1) because we have direct pointer via key
      const removed = list.removeByKey(500);
      expect(removed?.id).toBe(500);
      expect(list.size).toBe(999);
      expect(list.has(500)).toBe(false);

      // Verify list integrity
      let count = 0;
      for (const node of list) {
        count++;
        expect(node.key).not.toBe(500);
      }
      expect(count).toBe(999);
    });

    it('should insertAfter in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      const first = { id: 1, text: 'first' };
      const third = { id: 3, text: 'third' };
      const second = { id: 2, text: 'second' };

      list.append(first);
      list.append(third);
      list.insertAfter(first, second);

      const values = [...list.values()];
      expect(values.map((v) => v.text)).toEqual(['first', 'second', 'third']);
    });

    it('should insertBefore in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      const first = { id: 1, text: 'first' };
      const third = { id: 3, text: 'third' };
      const second = { id: 2, text: 'second' };

      list.append(first);
      list.append(third);
      list.insertBefore(third, second);

      const values = [...list.values()];
      expect(values.map((v) => v.text)).toEqual(['first', 'second', 'third']);
    });

    it('should update in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'old' });
      list.update({ id: 1, text: 'new' });

      expect(list.getByKey(1)?.text).toBe('new');
    });

    it('should get by key in O(1)', () => {
      const list = createReactiveList<Item>((item) => item.id);

      for (let i = 0; i < 10000; i++) {
        list.append({ id: i, text: `Item ${i}` });
      }

      // O(1) lookup
      expect(list.getByKey(5000)?.id).toBe(5000);
      expect(list.getByKey(9999)?.id).toBe(9999);
    });

    it('should remove by value using key function', () => {
      const list = createReactiveList<Item>((item) => item.id);

      const item1 = { id: 1, text: 'one' };
      const item2 = { id: 2, text: 'two' };
      const item3 = { id: 3, text: 'three' };

      list.append(item1);
      list.append(item2);
      list.append(item3);

      // Remove by value - key is derived from value
      list.remove(item2);

      expect(list.size).toBe(2);
      expect(list.has(2)).toBe(false);
      expect([...list.values()].map((v) => v.id)).toEqual([1, 3]);
    });
  });

  describe('callbacks', () => {
    it('should call onAppend', () => {
      const appended: number[] = [];
      const list = createReactiveList<Item>((item) => item.id);
      list.setCallbacks({
        onAppend: (node) => appended.push(node.value.id),
      });

      list.append({ id: 1, text: 'one' });
      list.append({ id: 2, text: 'two' });

      expect(appended).toEqual([1, 2]);
    });

    it('should call onRemove', () => {
      const removed: number[] = [];
      const list = createReactiveList<Item>((item) => item.id);
      list.setCallbacks({
        onRemove: (node) => removed.push(node.value.id),
      });

      list.append({ id: 1, text: 'one' });
      list.append({ id: 2, text: 'two' });
      list.removeByKey(1);

      expect(removed).toEqual([1]);
    });

    it('should call onUpdate with old value', () => {
      const updates: Array<{ old: string; new: string }> = [];
      const list = createReactiveList<Item>((item) => item.id);
      list.setCallbacks({
        onUpdate: (node, oldValue) =>
          updates.push({
            old: oldValue.text,
            new: node.value.text,
          }),
      });

      list.append({ id: 1, text: 'old' });
      list.update({ id: 1, text: 'new' });

      expect(updates).toEqual([{ old: 'old', new: 'new' }]);
    });

    it('should call onPrepend', () => {
      const prepended: number[] = [];
      const list = createReactiveList<Item>((item) => item.id);
      list.setCallbacks({
        onPrepend: (node) => prepended.push(node.value.id),
      });

      list.prepend({ id: 1, text: 'one' });
      list.prepend({ id: 2, text: 'two' });

      expect(prepended).toEqual([1, 2]);
    });
  });

  describe('iteration', () => {
    it('should iterate in order', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'one' });
      list.append({ id: 2, text: 'two' });
      list.append({ id: 3, text: 'three' });

      const ids: number[] = [];
      for (const node of list) {
        ids.push(node.value.id);
      }

      expect(ids).toEqual([1, 2, 3]);
    });

    it('should iterate values', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'one' });
      list.append({ id: 2, text: 'two' });

      expect([...list.values()].map((v) => v.id)).toEqual([1, 2]);
    });

    it('should iterate keys', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'one' });
      list.append({ id: 2, text: 'two' });

      expect([...list.keys()]).toEqual([1, 2]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty list', () => {
      const list = createReactiveList<Item>((item) => item.id);

      expect(list.size).toBe(0);
      expect(list.head).toBe(null);
      expect(list.tail).toBe(null);
      expect([...list]).toEqual([]);
    });

    it('should handle single item', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'only' });
      expect(list.head).toBe(list.tail);
      expect(list.head?.value.id).toBe(1);

      list.removeByKey(1);
      expect(list.head).toBe(null);
      expect(list.tail).toBe(null);
    });

    it('should reject duplicate keys', () => {
      const list = createReactiveList<Item>((item) => item.id);

      list.append({ id: 1, text: 'first' });
      expect(() => list.append({ id: 1, text: 'duplicate' })).toThrow(
        'already exists'
      );
    });

    it('should clear all items', () => {
      const list = createReactiveList<Item>((item) => item.id);

      for (let i = 0; i < 100; i++) {
        list.append({ id: i, text: `Item ${i}` });
      }

      list.clear();

      expect(list.size).toBe(0);
      expect(list.head).toBe(null);
      expect(list.tail).toBe(null);
      expect(list.has(50)).toBe(false);
    });

    it('should return null for non-existent operations', () => {
      const list = createReactiveList<Item>((item) => item.id);

      expect(list.removeByKey(999)).toBe(null);
      expect(list.getByKey(999)).toBe(undefined);
      expect(list.update({ id: 999, text: 'nope' })).toBe(false);
      expect(
        list.insertAfter({ id: 999, text: 'nope' }, { id: 1, text: 'new' })
      ).toBe(null);
    });
  });

});
