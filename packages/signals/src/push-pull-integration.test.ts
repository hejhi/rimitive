import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, batch, computed, resetGlobalState } from './test-setup';

/**
 * Push-Pull Algorithm Integration
 *
 * PUSH: Eagerly marks dependencies as dirty when sources change
 * PULL: Lazily recomputes values only when accessed
 */

describe('Push-Pull Integration', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Push Phase', () => {
    it('should mark dependencies without computing', () => {
      let count1 = 0;
      let count2 = 0;

      const source = signal(1);
      const level1 = computed(() => {
        count1++;
        return source() * 2;
      });
      const level2 = computed(() => {
        count2++;
        return level1() * 3;
      });

      expect(level2()).toBe(6); // 1 * 2 * 3

      count1 = count2 = 0;

      // PUSH: Update source
      source(10);

      // Nothing computed yet
      expect(count1).toBe(0);
      expect(count2).toBe(0);

      // PULL: Access triggers computation
      expect(level2()).toBe(60); // 10 * 2 * 3

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('should skip unaccessed branches', () => {
      let countA = 0;
      let countB = 0;

      const source = signal(1);
      const branchA = computed(() => {
        countA++;
        return source() * 2;
      });
      const branchB = computed(() => {
        countB++;
        return source() * 3;
      });

      expect(branchA()).toBe(2);
      expect(branchB()).toBe(3);

      countA = countB = 0;
      source(10);

      // Only access B
      expect(branchB()).toBe(30);

      expect(countA).toBe(0); // Not accessed
      expect(countB).toBe(1); // Accessed
    });
  });

  describe('Pull Phase', () => {
    it('should compute in dependency order', () => {
      const order: string[] = [];

      const a = signal(1);
      const b = computed(() => {
        order.push('B');
        return a() * 2;
      });
      const c = computed(() => {
        order.push('C');
        return b() * 3;
      });

      c();
      // B must be computed (either before or during C's computation)
      expect(order).toContain('B');
      expect(order).toContain('C');

      order.length = 0;
      a(10);
      c();
      expect(order).toContain('B');
      expect(order).toContain('C');
    });

    it('should handle conditional dependencies', () => {
      let trueCount = 0;
      let falseCount = 0;

      const condition = signal(true);
      const trueBranch = signal(10);
      const falseBranch = signal(20);

      const trueComputed = computed(() => {
        trueCount++;
        return trueBranch() * 2;
      });
      const falseComputed = computed(() => {
        falseCount++;
        return falseBranch() * 3;
      });

      const result = computed(() =>
        condition() ? trueComputed() : falseComputed()
      );

      expect(result()).toBe(20);
      expect(trueCount).toBe(1);
      expect(falseCount).toBe(0);

      // Update unused branch
      falseBranch(30);
      expect(result()).toBe(20);
      expect(trueCount).toBe(1);
      expect(falseCount).toBe(0);

      // Switch condition
      condition(false);
      expect(result()).toBe(90);
      expect(falseCount).toBe(1);
    });
  });

  describe('Coordination', () => {
    it('should handle interleaved push and pull', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      const c1 = computed(() => s1() + s2());
      const c2 = computed(() => s1() * s2());
      const c3 = computed(() => c1() + c2());

      let effectCount = 0;
      let lastValue = 0;

      effect(() => {
        effectCount++;
        lastValue = c3();
      });

      expect(effectCount).toBe(1);
      expect(lastValue).toBe(5); // (1+2) + (1*2)

      s1(10); // PUSH
      expect(c1()).toBe(12); // PULL

      s2(20); // PUSH
      expect(c2()).toBe(200); // PULL

      expect(effectCount).toBe(3);
      expect(lastValue).toBe(230); // (10+20) + (10*20)
    });

    it('should schedule effects during push, execute after', () => {
      const order: string[] = [];

      const s = signal(1);

      const c1 = computed(() => {
        order.push('compute-c1');
        return s() * 2;
      });
      const c2 = computed(() => {
        order.push('compute-c2');
        return c1() * 3;
      });

      effect(() => {
        order.push('effect-1');
        void c2();
      });
      effect(() => {
        order.push('effect-2');
        void c1();
      });

      order.length = 0;
      s(10);

      expect(order).toContain('effect-1');
      expect(order).toContain('effect-2');
      expect(order).toContain('compute-c1');
      expect(order).toContain('compute-c2');

      // c1 must compute before c2
      const c1Index = order.indexOf('compute-c1');
      const c2Index = order.indexOf('compute-c2');
      expect(c1Index).toBeLessThan(c2Index);

      // No duplicate computations
      expect(order.filter(x => x === 'compute-c1').length).toBe(1);
      expect(order.filter(x => x === 'compute-c2').length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors during pull', () => {
      const source = signal(1);
      let computeCount = 0;

      const buggy = computed(() => {
        computeCount++;
        const val = source();
        if (val === 10) throw new Error('Computation failed');
        return val * 2;
      });

      expect(buggy()).toBe(2);
      expect(computeCount).toBe(1);

      source(10);
      computeCount = 0;

      expect(() => buggy()).toThrow('Computation failed');
      expect(computeCount).toBeGreaterThan(0);

      // Recover
      source(5);
      computeCount = 0;
      expect(buggy()).toBe(10);
      expect(computeCount).toBeGreaterThan(0);
    });

    it('should handle circular updates', () => {
      const s = signal(1);
      let count = 0;
      const max = 10;

      const circular = computed(() => {
        count++;
        if (count > max) return -1;

        const val = s();
        if (val < 5) {
          s(val + 1); // Bad! Modifying signal during computed
          return val;
        }
        return val;
      });

      expect(() => circular()).not.toThrow();

      count = 0;
      s(10);
      expect(circular()).toBe(10);
    });

    it('should handle multiple pushes without pull', () => {
      const source = signal(1);
      const derived = computed(() => source() * 2);

      expect(derived()).toBe(2);

      // Multiple updates
      source(2);
      source(3);
      source(4);
      source(5);

      // Computes with latest value only
      expect(derived()).toBe(10);
    });
  });

  describe('Version-Based Optimization', () => {
    it('should recompute when dependencies change', () => {
      let computeCount = 0;

      const s1 = signal(1);
      const s2 = signal(2);

      const sum = computed(() => {
        computeCount++;
        return s1() + s2();
      });

      expect(sum()).toBe(3);
      expect(computeCount).toBe(1);

      s1(10);
      expect(sum()).toBe(12);
      expect(computeCount).toBe(2);

      batch(() => {
        s1(2);
        s2(10);
      });

      expect(sum()).toBe(12);
      expect(computeCount).toBe(3);
    });
  });
});
