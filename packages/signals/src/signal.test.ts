import { describe, it, expect, beforeEach } from 'vitest';
import {
  signal,
  computed,
  effect,
  batch,
  resetGlobalState,
} from './test-setup';

describe('signal', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should create a signal with initial value', () => {
    const s = signal(10);
    expect(s()).toBe(10);
  });

  it('should update signal value', () => {
    const s = signal(5);
    s(10);
    expect(s()).toBe(10);
  });

  it('should update signal value with direct assignment', () => {
    const s = signal(5);
    s(10);
    expect(s()).toBe(10);
  });

  it('should not trigger updates when value is same', () => {
    const s = signal(5);
    let updateCount = 0;
    const c = computed(() => {
      updateCount++;
      return s();
    });

    c(); // Initial computation
    expect(updateCount).toBe(1);

    s(5); // Same value
    c(); // Should not recompute
    expect(updateCount).toBe(1);
  });

  it('should increment version on value change', () => {
    const s = signal(5);
    let updateCount = 0;
    const c = computed(() => {
      updateCount++;
      return s();
    });

    c(); // Initial computation
    expect(updateCount).toBe(1);

    s(10); // Different value
    c(); // Should recompute
    expect(updateCount).toBe(2);
  });

  it('should handle null and undefined values', () => {
    const s1 = signal<number | null>(null);
    const s2 = signal<string | undefined>(undefined);

    expect(s1()).toBe(null);
    expect(s2()).toBe(undefined);

    s1(42);
    expect(s1()).toBe(42);

    s1(null);
    expect(s1()).toBe(null);
  });

  it('should handle object values with reference equality', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Alice' };
    const s = signal(obj1);
    let updateCount = 0;

    const c = computed(() => {
      updateCount++;
      return s();
    });

    c(); // Initial computation
    expect(updateCount).toBe(1);

    // Same reference, no update
    s(obj1);
    c();
    expect(updateCount).toBe(1);

    // Different reference, triggers update
    s(obj2);
    c();
    expect(updateCount).toBe(2);
  });

  it('should track dependencies when read inside computed', () => {
    const a = signal(5);
    const b = signal(10);
    const sum = computed(() => a() + b());

    expect(sum()).toBe(15);

    // Verify dependency tracking by checking if changes propagate
    a(10);
    expect(sum()).toBe(20);

    b(20);
    expect(sum()).toBe(30);
  });

  it('should notify subscribers on change', () => {
    const source = signal(10);
    let computeCount = 0;

    const double = computed(() => {
      computeCount++;
      return source() * 2;
    });

    expect(double()).toBe(20);
    expect(computeCount).toBe(1);

    source(5);
    expect(double()).toBe(10);
    expect(computeCount).toBe(2);
  });

  describe('peek', () => {
    it('should read value without tracking', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;

      const result = computed(() => {
        computeCount++;
        return a() + b.peek();
      });

      expect(result()).toBe(15);
      expect(computeCount).toBe(1);

      // Changing b should not trigger recompute
      b(20);
      expect(result()).toBe(15); // Still using old value
      expect(computeCount).toBe(1);

      // Changing a should trigger recompute
      a(10);
      expect(result()).toBe(30); // Now picks up new b value
      expect(computeCount).toBe(2);
    });
  });

  describe('batching behavior', () => {
    it('should defer notifications in batch', () => {
      const s = signal(0);
      let effectRuns = 0;

      effect(() => {
        void s(); // Track dependency
        effectRuns++;
      });

      expect(effectRuns).toBe(1);

      batch(() => {
        s(1);
        s(2);
        s(3);
        expect(effectRuns).toBe(1); // Not run yet
      });

      expect(effectRuns).toBe(2); // Run once after batch
      expect(s()).toBe(3);
    });
  });

  describe('array signals', () => {
    it('should handle array mutations', () => {
      const arr = signal([1, 2, 3]);
      let computeCount = 0;

      const sum = computed(() => {
        computeCount++;
        return arr().reduce((a: number, b: number) => a + b, 0);
      });

      expect(sum()).toBe(6);
      expect(computeCount).toBe(1);

      // New array reference triggers update
      arr([1, 2, 3, 4]);
      expect(sum()).toBe(10);
      expect(computeCount).toBe(2);

      // Same array reference doesn't trigger
      const current = arr();
      arr(current);
      expect(computeCount).toBe(2);
    });
  });

  describe('stress tests', () => {
    it('should handle many subscribers efficiently', () => {
      const source = signal(1);
      const computeds = Array.from({ length: 100 }, (_, i) =>
        computed(() => source() * (i + 1))
      );

      // All should compute correctly
      computeds.forEach((c, i) => {
        expect(c()).toBe(i + 1);
      });

      // Update should propagate to all
      source(2);
      computeds.forEach((c, i) => {
        expect(c()).toBe(2 * (i + 1));
      });
    });
  });
});
