import { describe, it, expect, beforeEach } from 'vitest';
import {
  setCurrentConsumer,
  getCurrentConsumer,
  computed,
  effect,
  signal,
  
  resetGlobalState,
} from './test-setup';

describe('Global State Management', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('globalVersion', () => {
    it('should start at 0 after reset', () => {
      // Version is internal, so we test it indirectly through computed behavior
      const s = signal(1);
      const c = computed(() => s.value);

      // First access should compute
      expect(c.value).toBe(1);

      // No change, so computed shouldn't re-run
      expect(c.value).toBe(1);
    });

    it('should increment when signals change', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        return s1.value + s2.value;
      });

      expect(c.value).toBe(3);
      expect(computeCount).toBe(1);

      // Change s1 - should increment global version
      s1.value = 10;
      expect(c.value).toBe(12);
      expect(computeCount).toBe(2);

      // Change s2 - should increment global version again
      s2.value = 20;
      expect(c.value).toBe(30);
      expect(computeCount).toBe(3);
    });

    it('should affect all computeds when incremented', () => {
      const s = signal(1);
      let compute1Count = 0;
      let compute2Count = 0;

      const c1 = computed(() => {
        compute1Count++;
        return s.value * 2;
      });

      const c2 = computed(() => {
        compute2Count++;
        return s.value * 3;
      });

      // Initial computation
      expect(c1.value).toBe(2);
      expect(c2.value).toBe(3);
      expect(compute1Count).toBe(1);
      expect(compute2Count).toBe(1);

      // Change signal - both computeds should know something changed globally
      s.value = 5;
      expect(c1.value).toBe(10);
      expect(c2.value).toBe(15);
      expect(compute1Count).toBe(2);
      expect(compute2Count).toBe(2);
    });
  });

  describe('currentConsumer tracking', () => {
    it('should track currently executing computed', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentConsumer> = null;

      const c = computed(() => {
        capturedCurrent = getCurrentConsumer();
        return s.value * 2;
      });

      // Before execution, should be null
      expect(getCurrentConsumer()).toBe(null);

      // During execution, should be the computed
      void c.value;
      expect(capturedCurrent).toBe(c);

      // After execution, should be null again
      expect(getCurrentConsumer()).toBe(null);
    });

    it('should handle nested computed execution', () => {
      const s = signal(1);
      const captures: Array<{
        type: string;
        current: ReturnType<typeof getCurrentConsumer>;
      }> = [];

      const inner = computed(() => {
        captures.push({ type: 'inner', current: getCurrentConsumer() });
        return s.value * 2;
      });

      const outer = computed(() => {
        captures.push({ type: 'outer-before', current: getCurrentConsumer() });
        const result = inner.value + s.value;
        captures.push({ type: 'outer-after', current: getCurrentConsumer() });
        return result;
      });

      void outer.value;

      expect(captures).toHaveLength(3);
      expect(captures[0]).toEqual({ type: 'outer-before', current: outer });
      expect(captures[1]).toEqual({ type: 'inner', current: inner });
      expect(captures[2]).toEqual({ type: 'outer-after', current: outer });
    });

    it('should track currently executing effect', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentConsumer> = null;
      let effectRan = false;

      const dispose = effect(() => {
        capturedCurrent = getCurrentConsumer();
        effectRan = true;
        void s.value; // Subscribe to signal
      });

      expect(effectRan).toBe(true);
      expect(capturedCurrent).not.toBe(null);
      expect(typeof capturedCurrent).toBe('object');

      // After execution
      expect(getCurrentConsumer()).toBe(null);

      dispose();
    });

    it('should properly restore previous computed after nested execution', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const executionOrder: string[] = [];

      const c1 = computed(() => {
        executionOrder.push('c1-start');
        const current = getCurrentConsumer();
        executionOrder.push(`c1-current:${current === c1}`);
        const result = s1.value * 2;
        executionOrder.push('c1-end');
        return result;
      });

      const c2 = computed(() => {
        executionOrder.push('c2-start');
        const current = getCurrentConsumer();
        executionOrder.push(`c2-current:${current === c2}`);
        const result = c1.value + s2.value;
        executionOrder.push(`c2-after-c1:${getCurrentConsumer() === c2}`);
        executionOrder.push('c2-end');
        return result;
      });

      void c2.value;

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
      let capturedBefore: ReturnType<typeof getCurrentConsumer>;
      let capturedDuring: ReturnType<typeof getCurrentConsumer> = null;

      const c = computed(() => {
        capturedDuring = getCurrentConsumer();
        if (s.value > 5) {
          throw new Error('Test error');
        }
        return s.value * 2;
      });

      capturedBefore = getCurrentConsumer();

      // Normal execution
      expect(c.value).toBe(2);
      expect(capturedBefore).toBe(null);
      expect(capturedDuring).toBe(c);

      // Execution with error
      s.value = 10;
      capturedBefore = getCurrentConsumer();

      expect(() => c.value).toThrow('Test error');

      const capturedAfter = getCurrentConsumer();
      expect(capturedBefore).toBe(null);
      expect(capturedAfter).toBe(null);
    });
  });

  describe('setCurrentConsumer', () => {
    it('should allow manual setting and clearing', () => {
      const c = computed(() => 42);

      expect(getCurrentConsumer()).toBe(null);

      setCurrentConsumer(c);
      expect(getCurrentConsumer()).toBe(c);

      setCurrentConsumer(null);
      expect(getCurrentConsumer()).toBe(null);
    });

    it('should affect dependency tracking', () => {
      const s = signal(1);
      let dependencyAdded = false;

      // Create a real computed to test dependency tracking
      const c = computed(() => {
        dependencyAdded = true;
        return s.value * 2;
      });

      // Without current computed set, reading signal shouldn't track
      void s.value;
      expect(dependencyAdded).toBe(false);

      // When computed executes, it becomes current and tracks dependencies
      void c.value;
      expect(dependencyAdded).toBe(true);

      // After execution, current computed should be cleared
      expect(getCurrentConsumer()).toBe(null);
    });
  });

  describe('resetGlobalState', () => {
    it('should reset global version', () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);

      // Trigger some version increments
      void c.value;
      s.value = 2;
      s.value = 3;
      s.value = 4;

      // Reset
      resetGlobalState();

      // Create new signal/computed after reset
      const s2 = signal(10);
      const c2 = computed(() => s2.value * 2);

      // Should work normally with reset version
      expect(c2.value).toBe(20);
    });

    it('should clear current computed', () => {
      const c = computed(() => 42);

      setCurrentConsumer(c);
      expect(getCurrentConsumer()).toBe(c);

      resetGlobalState();
      expect(getCurrentConsumer()).toBe(null);
    });

    it('should not affect existing signals or computeds', () => {
      const s = signal(5);
      const c = computed(() => s.value * 3);

      expect(c.value).toBe(15);

      resetGlobalState();

      // Existing reactive values should still work
      s.value = 10;
      expect(c.value).toBe(30);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex dependency graphs', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const sum = computed(() => a.value + b.value + c.value);
      const product = computed(() => a.value * b.value * c.value);
      const combined = computed(() => sum.value + product.value);

      expect(combined.value).toBe(12); // (1+2+3) + (1*2*3) = 6 + 6 = 12

      // Change one signal
      a.value = 2;
      expect(combined.value).toBe(19); // (2+2+3) + (2*2*3) = 7 + 12 = 19
    });

    it('should handle effect cleanup with global state', () => {
      const s = signal(0);
      let effectCount = 0;

      const dispose = effect(() => {
        effectCount++;
        void s.value; // Subscribe
      });

      expect(effectCount).toBe(1);

      s.value = 1;
      expect(effectCount).toBe(2);

      dispose();

      // After disposal, changes shouldn't trigger effect
      s.value = 2;
      expect(effectCount).toBe(2);

      // Global state should be clean
      expect(getCurrentConsumer()).toBe(null);
    });

    it('should maintain consistency across multiple computeds', () => {
      const source = signal(1);
      const values: number[] = [];

      // Create multiple computeds that depend on the same signal
      const computeds = Array.from({ length: 5 }, (_, i) =>
        computed(() => {
          values.push(i);
          return source.value * (i + 1);
        })
      );

      // Initial computation
      computeds.forEach((c, i) => {
        expect(c.value).toBe(i + 1);
      });

      expect(values).toEqual([0, 1, 2, 3, 4]);

      // Clear tracking
      values.length = 0;

      // Update source
      source.value = 2;

      // All computeds should recompute on next access
      computeds.forEach((c, i) => {
        expect(c.value).toBe(2 * (i + 1));
      });

      expect(values).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
