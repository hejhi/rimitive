/**
 * Tests for iter - reactive linked list
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computed, effect, iter, resetGlobalState } from './test-setup';

type Item = { id: number; text: string };

describe('iter', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('basic operations', () => {
    it('should create empty iter', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.size).toBe(0);
      expect([...items]).toEqual([]);
    });

    it('should initialize with items', () => {
      const items = iter<Item>(
        (item) => item.id,
        [
          { id: 1, text: 'one' },
          { id: 2, text: 'two' },
          { id: 3, text: 'three' },
        ]
      );

      expect(items.size).toBe(3);
      expect([...items].map((i) => i.id)).toEqual([1, 2, 3]);
      expect(items.get(2)?.text).toBe('two');
    });

    it('should throw on duplicate key in initial items', () => {
      expect(() =>
        iter<Item>(
          (item) => item.id,
          [
            { id: 1, text: 'one' },
            { id: 1, text: 'duplicate' },
          ]
        )
      ).toThrow('Key "1" already exists');
    });

    it('should append items and return node', () => {
      const items = iter<Item>((item) => item.id);

      const node1 = items.append({ id: 1, text: 'one' });
      const node2 = items.append({ id: 2, text: 'two' });

      expect(node1.key).toBe(1);
      expect(node2.key).toBe(2);
      expect(items.size).toBe(2);
      expect([...items].map((i) => i.id)).toEqual([1, 2]);
    });

    it('should prepend items and return node', () => {
      const items = iter<Item>((item) => item.id);

      const node1 = items.prepend({ id: 1, text: 'one' });
      const node2 = items.prepend({ id: 2, text: 'two' });

      expect(node1.key).toBe(1);
      expect(node2.key).toBe(2);
      expect(items.size).toBe(2);
      expect([...items].map((i) => i.id)).toEqual([2, 1]);
    });

    it('should remove items by key and return node', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      const removed = items.remove(1);
      expect(removed?.key).toBe(1);
      expect(removed?.value.text).toBe('one');
      expect(items.size).toBe(1);
      expect([...items].map((i) => i.id)).toEqual([2]);
    });

    it('should update items and return node with old value', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'old' });
      const result = items.update({ id: 1, text: 'new' });

      expect(result?.node.value.text).toBe('new');
      expect(result?.oldValue.text).toBe('old');
      expect(items.get(1)?.text).toBe('new');
    });

    it('should insert after by key and return node', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'first' });
      items.append({ id: 3, text: 'third' });
      const inserted = items.insertAfter(1, { id: 2, text: 'second' });

      expect(inserted?.key).toBe(2);
      expect([...items].map((i) => i.text)).toEqual(['first', 'second', 'third']);
    });

    it('should insert before by key and return node', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'first' });
      items.append({ id: 3, text: 'third' });
      const inserted = items.insertBefore(3, { id: 2, text: 'second' });

      expect(inserted?.key).toBe(2);
      expect([...items].map((i) => i.text)).toEqual(['first', 'second', 'third']);
    });

    it('should clear all items', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });
      items.clear();

      expect(items.size).toBe(0);
      expect([...items]).toEqual([]);
    });
  });

  describe('lookups', () => {
    it('should get by key', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      expect(items.get(1)?.text).toBe('one');
      expect(items.get(2)?.text).toBe('two');
      expect(items.get(999)).toBeUndefined();
    });

    it('should check has', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });

      expect(items.has(1)).toBe(true);
      expect(items.has(999)).toBe(false);
    });

    it('should get node by key', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      const node = items.getNode(1);
      expect(node?.key).toBe(1);
      expect(node?.value.text).toBe('one');
      expect(node?.next?.key).toBe(2);
    });

    it('should peek without tracking', () => {
      const items = iter<Item>((item) => item.id);
      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      let computeCount = 0;
      const snapshot = computed(() => {
        computeCount++;
        return items.peek().length;
      });

      expect(snapshot()).toBe(2);
      expect(computeCount).toBe(1);

      items.append({ id: 3, text: 'three' });
      expect(snapshot()).toBe(2); // Still returns cached value
      expect(computeCount).toBe(1); // No recompute
    });

    it('should iterate keys', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      expect([...items.keys()]).toEqual([1, 2]);
    });

    it('should iterate nodes', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      const nodes = [...items.nodes()];
      expect(nodes.length).toBe(2);
      expect(nodes[0]!.key).toBe(1);
      expect(nodes[1]!.key).toBe(2);
    });

    it('should expose keyFn', () => {
      const keyFn = (item: Item) => item.id;
      const items = iter<Item>(keyFn);

      expect(items.keyFn).toBe(keyFn);
    });
  });

  describe('reactive integration', () => {
    it('should track iteration in computed', () => {
      const items = iter<Item>((item) => item.id);
      let computeCount = 0;

      const count = computed(() => {
        computeCount++;
        return items.size;
      });

      expect(count()).toBe(0);
      expect(computeCount).toBe(1);

      items.append({ id: 1, text: 'one' });
      expect(count()).toBe(1);
      expect(computeCount).toBe(2);

      items.append({ id: 2, text: 'two' });
      expect(count()).toBe(2);
      expect(computeCount).toBe(3);
    });

    it('should track size in computed', () => {
      const items = iter<Item>((item) => item.id);
      let computeCount = 0;

      const size = computed(() => {
        computeCount++;
        return items.size;
      });

      expect(size()).toBe(0);
      expect(computeCount).toBe(1);

      items.append({ id: 1, text: 'one' });
      expect(size()).toBe(1);
      expect(computeCount).toBe(2);
    });

    it('should notify effects on append', () => {
      const items = iter<Item>((item) => item.id);
      const log: number[] = [];

      effect(() => {
        log.push(items.size);
      });

      expect(log).toEqual([0]);

      items.append({ id: 1, text: 'one' });
      expect(log).toEqual([0, 1]);

      items.append({ id: 2, text: 'two' });
      expect(log).toEqual([0, 1, 2]);
    });

    it('should notify effects on remove', () => {
      const items = iter<Item>((item) => item.id);
      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      const log: number[] = [];
      effect(() => {
        log.push(items.size);
      });

      expect(log).toEqual([2]);

      items.remove(1);
      expect(log).toEqual([2, 1]);
    });

    it('should notify effects on update', () => {
      const items = iter<Item>((item) => item.id);
      items.append({ id: 1, text: 'old' });

      const log: string[] = [];
      effect(() => {
        for (const item of items) {
          log.push(item.text);
        }
      });

      expect(log).toEqual(['old']);

      items.update({ id: 1, text: 'new' });
      expect(log).toEqual(['old', 'new']);
    });

    it('should notify effects on clear', () => {
      const items = iter<Item>((item) => item.id);
      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      const log: number[] = [];
      effect(() => {
        log.push(items.size);
      });

      expect(log).toEqual([2]);

      items.clear();
      expect(log).toEqual([2, 0]);
    });

    it('should work with spread in computed', () => {
      const items = iter<Item>((item) => item.id);

      const labels = computed(() => [...items].map((i) => i.text).join(', '));

      expect(labels()).toBe('');

      items.append({ id: 1, text: 'one' });
      expect(labels()).toBe('one');

      items.append({ id: 2, text: 'two' });
      expect(labels()).toBe('one, two');
    });
  });

  describe('edge cases', () => {
    it('should reject duplicate keys', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'first' });
      expect(() => items.append({ id: 1, text: 'duplicate' })).toThrow(
        'already exists'
      );
    });

    it('should return null for non-existent remove', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.remove(999)).toBeNull();
    });

    it('should return null for non-existent update', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.update({ id: 999, text: 'nope' })).toBeNull();
    });

    it('should return null for non-existent insertAfter', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.insertAfter(999, { id: 1, text: 'new' })).toBeNull();
    });

    it('should return null for non-existent insertBefore', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.insertBefore(999, { id: 1, text: 'new' })).toBeNull();
    });

    it('should handle single item correctly', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'only' });
      expect(items.head).toBe(items.tail);

      items.remove(1);
      expect(items.head).toBe(null);
      expect(items.tail).toBe(null);
    });
  });

  describe('O(1) behavior', () => {
    it('should not scale linearly with list size', () => {
      const small = iter<Item>((item) => item.id);
      const large = iter<Item>((item) => item.id);

      // Pre-populate large list with 10000 items
      for (let i = 0; i < 10000; i++) {
        large.append({ id: i, text: `Item ${i}` });
      }

      // Both should support basic operations without timeout
      small.append({ id: 1, text: 'small' });
      large.append({ id: 10001, text: 'large' });

      expect(small.size).toBe(1);
      expect(large.size).toBe(10001);

      // Remove from middle of large list (O(1) with linked list)
      large.remove(5000);
      expect(large.has(5000)).toBe(false);
      expect(large.size).toBe(10000);
    });
  });

  describe('move operations', () => {
    it('should move item before another by key', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });
      items.append({ id: 3, text: 'three' });

      const moved = items.moveBefore(3, 2);

      expect(moved?.key).toBe(3);
      expect([...items].map((i) => i.id)).toEqual([1, 3, 2]);
    });

    it('should move item to end when refKey is null', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });
      items.append({ id: 3, text: 'three' });

      const moved = items.moveBefore(1, null);

      expect(moved?.key).toBe(1);
      expect([...items].map((i) => i.id)).toEqual([2, 3, 1]);
    });

    it('should move item to beginning', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });
      items.append({ id: 3, text: 'three' });

      const moved = items.moveBefore(3, 1);

      expect(moved?.key).toBe(3);
      expect([...items].map((i) => i.id)).toEqual([3, 1, 2]);
    });

    it('should return null for non-existent item', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });

      expect(items.moveBefore(999, null)).toBeNull();
    });

    it('should return null for non-existent ref', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });

      expect(items.moveBefore(1, 999)).toBeNull();
    });

    it('should return node without moving if already in position', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      // Already at end
      const moved1 = items.moveBefore(2, null);
      expect(moved1?.key).toBe(2);
      expect([...items].map((i) => i.id)).toEqual([1, 2]);

      // Already before 2
      const moved2 = items.moveBefore(1, 2);
      expect(moved2?.key).toBe(1);
      expect([...items].map((i) => i.id)).toEqual([1, 2]);
    });
  });

  describe('callable interface', () => {
    it('should read as array with iter()', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });

      expect(items()).toEqual([
        { id: 1, text: 'one' },
        { id: 2, text: 'two' },
      ]);
    });

    it('should return empty array for empty iter', () => {
      const items = iter<Item>((item) => item.id);
      expect(items()).toEqual([]);
    });

    it('should track dependency when called', () => {
      const items = iter<Item>((item) => item.id);
      let count = 0;

      const snapshot = computed(() => {
        count++;
        return items();
      });

      expect(snapshot()).toEqual([]);
      expect(count).toBe(1);

      items.append({ id: 1, text: 'one' });

      expect(snapshot()).toEqual([{ id: 1, text: 'one' }]);
      expect(count).toBe(2);
    });
  });

  describe('head and tail', () => {
    it('should expose head and tail', () => {
      const items = iter<Item>((item) => item.id);

      expect(items.head).toBeNull();
      expect(items.tail).toBeNull();

      items.append({ id: 1, text: 'one' });
      expect(items.head?.key).toBe(1);
      expect(items.tail?.key).toBe(1);

      items.append({ id: 2, text: 'two' });
      expect(items.head?.key).toBe(1);
      expect(items.tail?.key).toBe(2);

      items.prepend({ id: 0, text: 'zero' });
      expect(items.head?.key).toBe(0);
      expect(items.tail?.key).toBe(2);
    });

    it('should update head/tail on remove', () => {
      const items = iter<Item>((item) => item.id);

      items.append({ id: 1, text: 'one' });
      items.append({ id: 2, text: 'two' });
      items.append({ id: 3, text: 'three' });

      items.remove(1);
      expect(items.head?.key).toBe(2);

      items.remove(3);
      expect(items.tail?.key).toBe(2);

      items.remove(2);
      expect(items.head).toBeNull();
      expect(items.tail).toBeNull();
    });
  });
});
