import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computed,
  signal,
  writeSignal,
  batch,
  effect,
  resetGlobalState,
} from './test-setup';

describe('computed.ts', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('basic functionality', () => {
    it('should compute initial value', () => {
      const a = signal(2);
      const b = signal(3);
      const sum = computed(() => a.value + b.value);

      expect(sum.value).toBe(5);
    });

    it('should update when dependencies change', () => {
      const count = signal(1);
      const doubled = computed(() => count.value * 2);

      expect(doubled.value).toBe(2);

      writeSignal(count, 5);
      expect(doubled.value).toBe(10);

      writeSignal(count, 0);
      expect(doubled.value).toBe(0);
    });

    it('should handle multiple dependencies', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      const sum = computed(() => a.value + b.value + c.value);

      expect(sum.value).toBe(6);

      writeSignal(a, 10);
      expect(sum.value).toBe(15);

      writeSignal(b, 20);
      expect(sum.value).toBe(33);

      writeSignal(c, 30);
      expect(sum.value).toBe(60);
    });

    it('should be lazy - not compute until accessed', () => {
      const fn = vi.fn(() => 42);
      const comp = computed(fn);

      expect(fn).not.toHaveBeenCalled();

      const value = comp.value;
      expect(value).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoization', () => {
    it('should not recompute if dependencies have not changed', () => {
      const a = signal(1);
      const fn = vi.fn(() => a.value * 2);
      const doubled = computed(fn);

      expect(doubled.value).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);

      // Access again without changing dependencies
      expect(doubled.value).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);

      // Access multiple times
      void doubled.value;
      void doubled.value;
      void doubled.value;
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should recompute when dependencies change', () => {
      const a = signal(1);
      const fn = vi.fn(() => a.value * 2);
      const doubled = computed(fn);

      expect(doubled.value).toBe(2);
      expect(fn).toHaveBeenCalledTimes(1);

      writeSignal(a, 2);
      expect(doubled.value).toBe(4);
      expect(fn).toHaveBeenCalledTimes(2);

      writeSignal(a, 3);
      expect(doubled.value).toBe(6);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle partial dependency updates', () => {
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn(() => a.value + b.value);
      const sum = computed(fn);

      expect(sum.value).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);

      // Update only one dependency
      writeSignal(a, 10);
      expect(sum.value).toBe(12);
      expect(fn).toHaveBeenCalledTimes(2);

      // Update the other dependency
      writeSignal(b, 20);
      expect(sum.value).toBe(30);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('dynamic dependencies', () => {
    it('should track conditional dependencies correctly', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn(() => (condition.value ? a.value : b.value));
      const result = computed(fn);

      expect(result.value).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);

      // Update non-active branch - should not recompute
      writeSignal(b, 10);
      expect(result.value).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);

      // Update active branch - should recompute
      writeSignal(a, 5);
      expect(result.value).toBe(5);
      expect(fn).toHaveBeenCalledTimes(2);

      // Switch condition
      writeSignal(condition, false);
      expect(result.value).toBe(10);
      expect(fn).toHaveBeenCalledTimes(3);

      // Now updating 'a' should not cause recomputation
      writeSignal(a, 100);
      expect(result.value).toBe(10);
      expect(fn).toHaveBeenCalledTimes(3);

      // But updating 'b' should
      writeSignal(b, 20);
      expect(result.value).toBe(20);
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should handle dependencies that appear and disappear', () => {
      const includeB = signal(false);
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const sum = computed(() => {
        let result = a.value + c.value;
        if (includeB.value) {
          result += b.value;
        }
        return result;
      });

      expect(sum.value).toBe(4); // 1 + 3

      // Update b - should not trigger recomputation
      writeSignal(b, 10);
      expect(sum.value).toBe(4);

      // Include b in computation
      writeSignal(includeB, true);
      expect(sum.value).toBe(14); // 1 + 10 + 3

      // Now b updates should trigger recomputation
      writeSignal(b, 20);
      expect(sum.value).toBe(24); // 1 + 20 + 3

      // Remove b from computation again
      writeSignal(includeB, false);
      expect(sum.value).toBe(4); // 1 + 3

      // b updates should no longer trigger recomputation
      writeSignal(b, 100);
      expect(sum.value).toBe(4);
    });
  });

  describe('nested computed values', () => {
    it('should handle computed values depending on other computed values', () => {
      const a = signal(1);
      const doubled = computed(() => a.value * 2);
      const quadrupled = computed(() => doubled.value * 2);
      const octupled = computed(() => quadrupled.value * 2);

      expect(doubled.value).toBe(2);
      expect(quadrupled.value).toBe(4);
      expect(octupled.value).toBe(8);

      writeSignal(a, 5);
      // Note: Computed values lazily update when accessed
      expect(doubled.value).toBe(10);
      expect(quadrupled.value).toBe(20);
      expect(octupled.value).toBe(40);
    });

    it('should handle complex dependency chains', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const ab = computed(() => a.value + b.value);
      const bc = computed(() => b.value + c.value);
      const sum = computed(() => ab.value + bc.value + c.value);

      expect(sum.value).toBe(11); // (1+2) + (2+3) + 3

      writeSignal(b, 10);
      expect(sum.value).toBe(27); // ab(1+10) + bc(10+3) + c(3) = 11 + 13 + 3

      writeSignal(c, 5);
      expect(sum.value).toBe(31); // ab(1+10) + bc(10+5) + c(5) = 11 + 15 + 5
    });
  });

  describe('error handling', () => {
    it('should throw error on circular dependencies', () => {
      // Create holder object to enable circular references
      const refs: {
        b?: ReturnType<typeof computed<number>>;
        c?: ReturnType<typeof computed<number>>;
      } = {};

      refs.b = computed(() => refs.c!.value + 1);
      refs.c = computed(() => refs.b!.value + 1);

      expect(() => refs.b!.value).toThrow('Cycle detected');
    });

    it('should throw error when accessing disposed computed', () => {
      const a = signal(1);
      const doubled = computed(() => a.value * 2);

      expect(doubled.value).toBe(2);

      doubled.dispose();

      expect(() => doubled.value).toThrow('Computed is disposed');
    });

    it('should propagate errors from computation function', () => {
      const a = signal(1);
      const bad = computed(() => {
        if (a.value > 0) {
          throw new Error('Computation error');
        }
        return a.value;
      });

      expect(() => bad.value).toThrow('Computation error');

      writeSignal(a, -1);
      expect(bad.value).toBe(-1);

      writeSignal(a, 2);
      expect(() => bad.value).toThrow('Computation error');
    });
  });

  describe('disposal', () => {
    it('should clean up dependencies when disposed', () => {
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn(() => a.value + b.value);
      const sum = computed(fn);

      expect(sum.value).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1);

      sum.dispose();

      // Changes should not trigger recomputation
      writeSignal(a, 10);
      writeSignal(b, 20);

      // Accessing should throw
      expect(() => sum.value).toThrow('Computed is disposed');
    });

    it('should handle disposal of computed with computed dependencies', () => {
      const a = signal(1);
      const doubled = computed(() => a.value * 2);
      const quadrupled = computed(() => doubled.value * 2);

      expect(quadrupled.value).toBe(4);

      quadrupled.dispose();

      // doubled should still work
      expect(doubled.value).toBe(2);

      writeSignal(a, 5);
      expect(doubled.value).toBe(10);

      // But quadrupled should throw
      expect(() => quadrupled.value).toThrow('Computed is disposed');
    });
  });

  describe('batching', () => {
    it('should defer notifications during batch', () => {
      const a = signal(1);
      const b = signal(2);
      const fn = vi.fn(() => a.value + b.value);
      const sum = computed(fn);

      // Create an effect to force evaluation
      const results: number[] = [];
      effect(() => results.push(sum.value));

      expect(fn).toHaveBeenCalledTimes(1);
      expect(results).toEqual([3]);

      batch(() => {
        writeSignal(a, 10);
        writeSignal(b, 20);
        // Should not recompute yet
        expect(fn).toHaveBeenCalledTimes(1);
      });

      // Should have recomputed once after batch
      expect(fn).toHaveBeenCalledTimes(2);
      expect(results).toEqual([3, 30]);
    });

    it('should handle nested batches', () => {
      const a = signal(1);
      const fn = vi.fn(() => a.value * 2);
      const doubled = computed(fn);

      const results: number[] = [];
      effect(() => results.push(doubled.value));

      expect(fn).toHaveBeenCalledTimes(1);

      batch(() => {
        writeSignal(a, 2);
        batch(() => {
          writeSignal(a, 3);
          batch(() => {
            writeSignal(a, 4);
          });
          writeSignal(a, 5);
        });
        writeSignal(a, 6);
      });

      // Should only recompute once after all batches complete
      expect(fn).toHaveBeenCalledTimes(2);
      expect(results).toEqual([2, 12]); // Initial 1*2, final 6*2
    });
  });

  describe('computed as signal dependency', () => {
    it('should allow computed values to trigger other computeds', () => {
      const count = signal(1);
      const doubled = computed(() => count.value * 2);
      const quadrupled = computed(() => doubled.value * 2);
      const fn = vi.fn(() => quadrupled.value + 1);
      const final = computed(fn);

      expect(final.value).toBe(5); // (1 * 2 * 2) + 1
      expect(fn).toHaveBeenCalledTimes(1);

      writeSignal(count, 3);
      expect(final.value).toBe(13); // (3 * 2 * 2) + 1
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle computed-to-computed notifications correctly', () => {
      const a = signal(1);
      const b = computed(() => a.value * 2);
      const c = computed(() => b.value * 2);

      const bNotifications: number[] = [];
      const cNotifications: number[] = [];

      effect(() => bNotifications.push(b.value));
      effect(() => cNotifications.push(c.value));

      expect(bNotifications).toEqual([2]);
      expect(cNotifications).toEqual([4]);

      writeSignal(a, 5);

      expect(bNotifications).toEqual([2, 10]);
      expect(cNotifications).toEqual([4, 20]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty computation function', () => {
      const empty = computed(() => {});
      expect(empty.value).toBeUndefined();
    });

    it('should handle computation that returns different types', () => {
      const toggle = signal(true);
      const mixed = computed(() => (toggle.value ? 42 : 'hello'));

      expect(mixed.value).toBe(42);

      writeSignal(toggle, false);
      expect(mixed.value).toBe('hello');
    });

    it('should handle very deep dependency chains', () => {
      const source = signal(1);
      let current = computed(() => source.value);

      // Create a deep chain
      for (let i = 0; i < 100; i++) {
        const prev = current;
        current = computed(() => prev.value + 1);
      }

      expect(current.value).toBe(101);

      writeSignal(source, 5);
      expect(current.value).toBe(105);
    });

    it('should handle rapid dependency changes', () => {
      const signals = Array.from({ length: 10 }, (_, i) => signal(i));
      const index = signal(0);
      const fn = vi.fn(() => signals[index.value]!.value);
      const value = computed(fn);

      expect(value.value).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Rapidly change which signal we depend on
      for (let i = 1; i < 10; i++) {
        writeSignal(index, i);
        expect(value.value).toBe(i);
      }

      expect(fn).toHaveBeenCalledTimes(10);

      // Update a signal we no longer depend on
      writeSignal(signals[0]!, 100);
      expect(value.value).toBe(9); // Still 9, not recomputed
      expect(fn).toHaveBeenCalledTimes(10);

      // Update the current dependency
      writeSignal(signals[9]!, 99);
      expect(value.value).toBe(99);
      expect(fn).toHaveBeenCalledTimes(11);
    });
  });
});
