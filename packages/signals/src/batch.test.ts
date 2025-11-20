import { describe, it, expect, beforeEach } from 'vitest';
import {
  signal,
  effect,
  batch,
  computed,
  resetGlobalState,
} from './test-setup';

describe('Batch', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should return function result', () => {
    const result = batch(() => 42);
    expect(result).toBe(42);
  });

  it('should prevent intermediate states in diamond graph', () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    const a = signal(1);
    const b = computed(() => a() * 2);
    const c = computed(() => a() * 3);
    const d = computed(() => b() + c());

    const observed: number[] = [];
    effect(() => {
      observed.push(d());
    });

    expect(observed).toEqual([5]); // 2 + 3

    observed.length = 0;
    a(10);

    // Should only see final state, not [23] or [32]
    expect(observed).toEqual([50]); // 20 + 30
  });

  it('should batch multiple signal updates', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    const s3 = signal(3);

    let effectCount = 0;
    effect(() => {
      void s1();
      void s2();
      void s3();
      effectCount++;
    });

    effectCount = 0;

    batch(() => {
      s1(10);
      s2(20);
      s3(30);
    });

    expect(effectCount).toBe(1);
  });

  it('should execute each effect once per batch', () => {
    const s1 = signal(1);
    const s2 = signal(2);
    const s3 = signal(3);

    let computeCount = 0;
    const sum = computed(() => {
      computeCount++;
      return s1() + s2() + s3();
    });

    let effectCount = 0;
    effect(() => {
      effectCount++;
      void sum();
    });

    computeCount = 0;
    effectCount = 0;

    batch(() => {
      s1(10);
      s2(20);
      s3(30);
    });

    expect(effectCount).toBe(1);
    expect(computeCount).toBe(1);
  });

  it('should support nested batches', () => {
    const s = signal(1);
    let effectCount = 0;

    effect(() => {
      effectCount++;
      void s();
    });

    effectCount = 0;

    batch(() => {
      s(2);
      batch(() => {
        s(3);
        batch(() => {
          s(4);
        });
        s(5);
      });
      s(6);
    });

    // Effect runs once after outermost batch
    expect(effectCount).toBe(1);
    expect(s()).toBe(6);
  });

  it('should handle exceptions', () => {
    const s1 = signal(1);
    const s2 = signal(2);

    let effectCount = 0;
    effect(() => {
      effectCount++;
      void s1();
      void s2();
    });

    effectCount = 0;

    expect(() => {
      batch(() => {
        s1(10);
        s2(20);
        throw new Error('Batch error');
      });
    }).toThrow('Batch error');

    // Values updated, effects ran
    expect(s1()).toBe(10);
    expect(s2()).toBe(20);
    expect(effectCount).toBe(1);
  });

  it('should restore batch depth on exception in nested batch', () => {
    const s = signal(1);
    let effectCount = 0;

    effect(() => {
      effectCount++;
      void s();
    });

    effectCount = 0;

    batch(() => {
      s(2);
      try {
        batch(() => {
          s(3);
          throw new Error('Nested error');
        });
      } catch (e) {
        void e;
      }
      s(4);
    });

    expect(effectCount).toBe(1);
    expect(s()).toBe(4);
  });

  it('should preserve effect execution order', () => {
    const s = signal(1);
    const order: string[] = [];

    effect(() => {
      void s();
      order.push('A');
    });

    effect(() => {
      void s();
      order.push('B');
    });

    effect(() => {
      void s();
      order.push('C');
    });

    order.length = 0;

    batch(() => {
      s(2);
    });

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('should allow reading signals inside batch', () => {
    const s1 = signal(10);
    const s2 = signal(20);

    const result = batch(() => {
      const sum = s1() + s2();
      s1(sum);
      return s1();
    });

    expect(result).toBe(30);
    expect(s1()).toBe(30);
  });

  it('should handle re-entrant batch calls', () => {
    const s1 = signal(1);
    const s2 = signal(2);

    let innerRan = false;

    effect(() => {
      if (s1() === 10 && !innerRan) {
        innerRan = true;
        batch(() => {
          s2(20);
        });
      }
    });

    batch(() => {
      s1(10);
    });

    expect(s1()).toBe(10);
    expect(s2()).toBe(20);
    expect(innerRan).toBe(true);
  });

  it('should handle circular updates', () => {
    const a = signal(0);
    const b = signal(0);

    let updateCount = 0;
    const max = 10;

    effect(() => {
      if (a() < max) {
        updateCount++;
        b(a() + 1);
      }
    });

    effect(() => {
      if (b() < max && b() > a()) {
        updateCount++;
        a(b() + 1);
      }
    });

    updateCount = 0;

    batch(() => {
      a(1);
    });

    expect(updateCount).toBeGreaterThan(0);
    expect(updateCount).toBeLessThan(max * 3);
    expect(Math.max(a(), b())).toBeGreaterThan(0);
  });
});
