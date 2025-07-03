import { describe, it, expect, beforeEach } from 'vitest';
import { setCurrentComputed, getCurrentComputed } from './global';
import { computed } from './computed';
import { effect } from './effect';
import { signal } from './signal';
import { resetGlobalState } from './index';

describe('Global State Management', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('globalVersion', () => {
    it('should start at 0 after reset', () => {
      // Version is internal, so we test it indirectly through computed behavior
      const s = signal(1);
      const c = computed(() => s());

      // First access should compute
      expect(c()).toBe(1);

      // No change, so computed shouldn't re-run
      expect(c()).toBe(1);
    });

    it('should increment when signals change', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        return s1() + s2();
      });

      expect(c()).toBe(3);
      expect(computeCount).toBe(1);

      // Change s1 - should increment global version
      s1(10);
      expect(c()).toBe(12);
      expect(computeCount).toBe(2);

      // Change s2 - should increment global version again
      s2(20);
      expect(c()).toBe(30);
      expect(computeCount).toBe(3);
    });

    it('should affect all computeds when incremented', () => {
      const s = signal(1);
      let compute1Count = 0;
      let compute2Count = 0;

      const c1 = computed(() => {
        compute1Count++;
        return s() * 2;
      });

      const c2 = computed(() => {
        compute2Count++;
        return s() * 3;
      });

      // Initial computation
      expect(c1()).toBe(2);
      expect(c2()).toBe(3);
      expect(compute1Count).toBe(1);
      expect(compute2Count).toBe(1);

      // Change signal - both computeds should know something changed globally
      s(5);
      expect(c1()).toBe(10);
      expect(c2()).toBe(15);
      expect(compute1Count).toBe(2);
      expect(compute2Count).toBe(2);
    });
  });

  describe('currentComputed tracking', () => {
    it('should track currently executing computed', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentComputed> = null;

      const c = computed(() => {
        capturedCurrent = getCurrentComputed();
        return s() * 2;
      });

      // Before execution, should be null
      expect(getCurrentComputed()).toBe(null);

      // During execution, should be the computed
      c();
      expect(capturedCurrent).toBe(c);

      // After execution, should be null again
      expect(getCurrentComputed()).toBe(null);
    });

    it('should handle nested computed execution', () => {
      const s = signal(1);
      const captures: Array<{ type: string; current: ReturnType<typeof getCurrentComputed> }> = [];

      const inner = computed(() => {
        captures.push({ type: 'inner', current: getCurrentComputed() });
        return s() * 2;
      });

      const outer = computed(() => {
        captures.push({ type: 'outer-before', current: getCurrentComputed() });
        const result = inner() + s();
        captures.push({ type: 'outer-after', current: getCurrentComputed() });
        return result;
      });

      outer();

      expect(captures).toHaveLength(3);
      expect(captures[0]).toEqual({ type: 'outer-before', current: outer });
      expect(captures[1]).toEqual({ type: 'inner', current: inner });
      expect(captures[2]).toEqual({ type: 'outer-after', current: outer });
    });

    it('should track currently executing effect', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentComputed> = null;
      let effectRan = false;

      const dispose = effect(() => {
        capturedCurrent = getCurrentComputed();
        effectRan = true;
        s(); // Subscribe to signal
      });

      expect(effectRan).toBe(true);
      expect(capturedCurrent).not.toBe(null);
      expect(typeof capturedCurrent).toBe('object');

      // After execution
      expect(getCurrentComputed()).toBe(null);

      dispose();
    });

    it('should properly restore previous computed after nested execution', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const executionOrder: string[] = [];

      const c1 = computed(() => {
        executionOrder.push('c1-start');
        const current = getCurrentComputed();
        executionOrder.push(`c1-current:${current === c1}`);
        const result = s1() * 2;
        executionOrder.push('c1-end');
        return result;
      });

      const c2 = computed(() => {
        executionOrder.push('c2-start');
        const current = getCurrentComputed();
        executionOrder.push(`c2-current:${current === c2}`);
        const result = c1() + s2();
        executionOrder.push(`c2-after-c1:${getCurrentComputed() === c2}`);
        executionOrder.push('c2-end');
        return result;
      });

      c2();

      expect(executionOrder).toEqual([
        'c2-start',
        'c2-current:true',
        'c1-start',
        'c1-current:true',
        'c1-end',
        'c2-after-c1:true',
        'c2-end',
      ]);
    });

    it('should handle errors without corrupting current computed', () => {
      const s = signal(1);
      let capturedBefore: ReturnType<typeof getCurrentComputed>;
      let capturedDuring: ReturnType<typeof getCurrentComputed> = null;

      const c = computed(() => {
        capturedDuring = getCurrentComputed();
        if (s() > 5) {
          throw new Error('Test error');
        }
        return s() * 2;
      });

      capturedBefore = getCurrentComputed();

      // Normal execution
      expect(c()).toBe(2);
      expect(capturedBefore).toBe(null);
      expect(capturedDuring).toBe(c);

      // Execution with error
      s(10);
      capturedBefore = getCurrentComputed();

      expect(() => c()).toThrow('Test error');

      const capturedAfter = getCurrentComputed();
      expect(capturedBefore).toBe(null);
      expect(capturedAfter).toBe(null);
    });
  });

  describe('setCurrentComputed', () => {
    it('should allow manual setting and clearing', () => {
      const c = computed(() => 42);

      expect(getCurrentComputed()).toBe(null);

      setCurrentComputed(c);
      expect(getCurrentComputed()).toBe(c);

      setCurrentComputed(null);
      expect(getCurrentComputed()).toBe(null);
    });

    it('should affect dependency tracking', () => {
      const s = signal(1);
      let dependencyAdded = false;

      // Create a real computed to test dependency tracking
      const c = computed(() => {
        dependencyAdded = true;
        return s() * 2;
      });

      // Without current computed set, reading signal shouldn't track
      s();
      expect(dependencyAdded).toBe(false);

      // When computed executes, it becomes current and tracks dependencies
      c();
      expect(dependencyAdded).toBe(true);
      
      // After execution, current computed should be cleared
      expect(getCurrentComputed()).toBe(null);
    });
  });

  describe('resetGlobalState', () => {
    it('should reset global version', () => {
      const s = signal(1);
      const c = computed(() => s() * 2);

      // Trigger some version increments
      c();
      s(2);
      s(3);
      s(4);

      // Reset
      resetGlobalState();

      // Create new signal/computed after reset
      const s2 = signal(10);
      const c2 = computed(() => s2() * 2);

      // Should work normally with reset version
      expect(c2()).toBe(20);
    });

    it('should clear current computed', () => {
      const c = computed(() => 42);

      setCurrentComputed(c);
      expect(getCurrentComputed()).toBe(c);

      resetGlobalState();
      expect(getCurrentComputed()).toBe(null);
    });

    it('should not affect existing signals or computeds', () => {
      const s = signal(5);
      const c = computed(() => s() * 3);

      expect(c()).toBe(15);

      resetGlobalState();

      // Existing reactive values should still work
      s(10);
      expect(c()).toBe(30);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex dependency graphs', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const sum = computed(() => a() + b() + c());
      const product = computed(() => a() * b() * c());
      const combined = computed(() => sum() + product());

      expect(combined()).toBe(12); // (1+2+3) + (1*2*3) = 6 + 6 = 12

      // Change one signal
      a(2);
      expect(combined()).toBe(19); // (2+2+3) + (2*2*3) = 7 + 12 = 19
    });

    it('should handle effect cleanup with global state', () => {
      const s = signal(0);
      let effectCount = 0;

      const dispose = effect(() => {
        effectCount++;
        s(); // Subscribe
      });

      expect(effectCount).toBe(1);

      s(1);
      expect(effectCount).toBe(2);

      dispose();

      // After disposal, changes shouldn't trigger effect
      s(2);
      expect(effectCount).toBe(2);

      // Global state should be clean
      expect(getCurrentComputed()).toBe(null);
    });

    it('should maintain consistency across multiple computeds', () => {
      const source = signal(1);
      const values: number[] = [];

      // Create multiple computeds that depend on the same signal
      const computeds = Array.from({ length: 5 }, (_, i) =>
        computed(() => {
          values.push(i);
          return source() * (i + 1);
        })
      );

      // Initial computation
      computeds.forEach((c, i) => {
        expect(c()).toBe(i + 1);
      });

      expect(values).toEqual([0, 1, 2, 3, 4]);

      // Clear tracking
      values.length = 0;

      // Update source
      source(2);

      // All computeds should recompute on next access
      computeds.forEach((c, i) => {
        expect(c()).toBe(2 * (i + 1));
      });

      expect(values).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
