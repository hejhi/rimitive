import { describe, it, expect, beforeEach } from 'vitest';
import { signal, effect, computed, resetGlobalState, setCurrentConsumer, getCurrentConsumer } from '../test-setup';

/**
 * Tests adapted from alien-signals untrack tests
 * https://github.com/alien-signals/alien-signals/blob/main/tests/untrack.spec.ts
 *
 * These tests verify the ability to temporarily pause dependency tracking by
 * setting the current consumer to null. This is useful for:
 * - Reading signals without creating dependencies
 * - Conditional dependency tracking
 * - Avoiding unnecessary recomputations
 *
 * In alien-signals this is done with setCurrentSub(undefined).
 * In our implementation, we use setCurrentConsumer(null).
 */

describe('Untrack - Pausing Dependency Tracking', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  describe('Basic Untracking', () => {
    it('should pause tracking in computed', () => {
      const src = signal(0);

      let computedTriggerTimes = 0;
      const c = computed(() => {
        computedTriggerTimes++;
        const currentConsumer = getCurrentConsumer();
        setCurrentConsumer(null);
        const value = src();
        setCurrentConsumer(currentConsumer);
        return value;
      });

      expect(c()).toBe(0);
      expect(computedTriggerTimes).toBe(1);

      src(1);
      src(2);
      src(3);
      expect(c()).toBe(0); // Should still return 0 since it didn't track src
      expect(computedTriggerTimes).toBe(1); // Should not have recomputed
    });

    it('should pause tracking in effect', () => {
      const src = signal(0);
      const is = signal(0);

      let effectTriggerTimes = 0;
      effect(() => {
        effectTriggerTimes++;
        if (is()) {
          const currentConsumer = getCurrentConsumer();
          setCurrentConsumer(null);
          src();
          setCurrentConsumer(currentConsumer);
        }
      });

      expect(effectTriggerTimes).toBe(1);

      is(1);
      expect(effectTriggerTimes).toBe(2);

      src(1);
      src(2);
      src(3);
      expect(effectTriggerTimes).toBe(2); // src changes should not trigger effect

      is(2);
      expect(effectTriggerTimes).toBe(3);

      src(4);
      src(5);
      src(6);
      expect(effectTriggerTimes).toBe(3); // src changes still should not trigger

      is(0);
      expect(effectTriggerTimes).toBe(4);

      src(7);
      src(8);
      src(9);
      expect(effectTriggerTimes).toBe(4); // src changes still should not trigger
    });
  });

  describe('Partial Untracking', () => {
    it('should track some signals but not others', () => {
      const tracked = signal(0);
      const untrack = signal(0);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        const trackedValue = tracked();

        const currentConsumer = getCurrentConsumer();
        setCurrentConsumer(null);
        const untrackedValue = untrack();
        setCurrentConsumer(currentConsumer);

        return trackedValue + untrackedValue;
      });

      expect(c()).toBe(0);
      expect(computeCount).toBe(1);

      // Changing untracked signal should not trigger recomputation
      untrack(5);
      expect(c()).toBe(0); // Still returns 0 + 0 since it recomputed without tracking untracked
      expect(computeCount).toBe(1);

      // Changing tracked signal should trigger recomputation
      tracked(10);
      expect(c()).toBe(15); // 10 + 5 (reads latest untracked value)
      expect(computeCount).toBe(2);
    });

    it('should handle nested untracking', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        const v1 = s1(); // Tracked

        const outer = getCurrentConsumer();
        setCurrentConsumer(null);
        const v2 = s2(); // Untracked

        // Still untracked (null context)
        const v3 = s3(); // Also untracked

        setCurrentConsumer(outer);

        return v1 + v2 + v3;
      });

      expect(c()).toBe(6);
      expect(computeCount).toBe(1);

      s2(20);
      s3(30);
      expect(c()).toBe(6); // Should not recompute
      expect(computeCount).toBe(1);

      s1(10);
      expect(c()).toBe(60); // 10 + 20 + 30
      expect(computeCount).toBe(2);
    });
  });

  describe('Conditional Tracking', () => {
    it('should conditionally track based on flag', () => {
      const flag = signal(false);
      const data = signal(0);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        const shouldTrack = flag();

        if (!shouldTrack) {
          const currentConsumer = getCurrentConsumer();
          setCurrentConsumer(null);
          const value = data();
          setCurrentConsumer(currentConsumer);
          return value;
        }

        return data();
      });

      expect(c()).toBe(0);
      expect(computeCount).toBe(1);

      // With flag false, data changes should not trigger
      data(5);
      expect(computeCount).toBe(1);

      // Enable tracking
      flag(true);
      expect(c()).toBe(5); // Now reads latest data value
      expect(computeCount).toBe(2);

      // With flag true, data changes should trigger
      data(10);
      expect(c()).toBe(10);
      expect(computeCount).toBe(3);

      // Disable tracking again - flag change triggers recompute (when read)
      flag(false);
      expect(c()).toBe(10); // Reads current data value without tracking it
      expect(computeCount).toBe(4);

      data(20);
      expect(computeCount).toBe(4); // No longer tracking data
    });
  });

  describe('Effect Untracking', () => {
    it('should allow reading signals without creating dependencies in effects', () => {
      const trigger = signal(0);
      const data = signal(100);
      let effectRuns = 0;
      let lastDataValue = 0;

      effect(() => {
        effectRuns++;
        void trigger(); // This creates a dependency

        // Read data without tracking
        const currentConsumer = getCurrentConsumer();
        setCurrentConsumer(null);
        lastDataValue = data();
        setCurrentConsumer(currentConsumer);
      });

      expect(effectRuns).toBe(1);
      expect(lastDataValue).toBe(100);

      // Changing data should not trigger effect
      data(200);
      expect(effectRuns).toBe(1);
      expect(lastDataValue).toBe(100); // Effect didn't run, so lastDataValue unchanged

      // Changing trigger should trigger effect and read latest data
      trigger(1);
      expect(effectRuns).toBe(2);
      expect(lastDataValue).toBe(200); // Effect ran and read current data value
    });

    it('should handle complex effect scenarios', () => {
      const mode = signal<'a' | 'b'>('a');
      const valueA = signal(1);
      const valueB = signal(100);
      let effectRuns = 0;
      let result = 0;

      effect(() => {
        effectRuns++;
        const currentMode = mode();

        if (currentMode === 'a') {
          result = valueA();
          // Read valueB without tracking
          const currentConsumer = getCurrentConsumer();
          setCurrentConsumer(null);
          void valueB();
          setCurrentConsumer(currentConsumer);
        } else {
          result = valueB();
          // Read valueA without tracking
          const currentConsumer = getCurrentConsumer();
          setCurrentConsumer(null);
          void valueA();
          setCurrentConsumer(currentConsumer);
        }
      });

      expect(effectRuns).toBe(1);
      expect(result).toBe(1);

      // In mode 'a', changing valueB should not trigger
      valueB(200);
      expect(effectRuns).toBe(1);

      // Changing valueA should trigger
      valueA(2);
      expect(effectRuns).toBe(2);
      expect(result).toBe(2);

      // Switch to mode 'b'
      mode('b');
      expect(effectRuns).toBe(3);
      expect(result).toBe(200);

      // Now changing valueA should not trigger
      valueA(3);
      expect(effectRuns).toBe(3);

      // But changing valueB should trigger
      valueB(300);
      expect(effectRuns).toBe(4);
      expect(result).toBe(300);
    });
  });

  describe('Untrack Helper Pattern', () => {
    // Common pattern: create a helper function for untracking
    function untrack<T>(fn: () => T): T {
      const currentConsumer = getCurrentConsumer();
      setCurrentConsumer(null);
      try {
        return fn();
      } finally {
        setCurrentConsumer(currentConsumer);
      }
    }

    it('should work with untrack helper', () => {
      const src = signal(0);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        return untrack(() => src());
      });

      expect(c()).toBe(0);
      expect(computeCount).toBe(1);

      src(1);
      src(2);
      src(3);
      expect(computeCount).toBe(1); // Should not recompute
    });

    it('should handle errors in untrack helper', () => {
      const src = signal(0);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        try {
          return untrack(() => {
            if (src() > 5) throw new Error('too big');
            return src();
          });
        } catch {
          return -1;
        }
      });

      expect(c()).toBe(0);
      expect(computeCount).toBe(1);

      src(10); // Would throw if tracked
      expect(c()).toBe(0); // Doesn't recompute, stays 0
      expect(computeCount).toBe(1);
    });

    it('should nest untrack calls correctly', () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let computeCount = 0;

      const c = computed(() => {
        computeCount++;
        const v1 = s1(); // Tracked
        const v2 = untrack(() => {
          return s2() + untrack(() => s1()); // Both untracked
        });
        return v1 + v2;
      });

      expect(c()).toBe(4); // 1 + (2 + 1)
      expect(computeCount).toBe(1);

      s2(20);
      expect(computeCount).toBe(1); // s2 is untracked

      s1(10);
      expect(c()).toBe(40); // 10 + (20 + 10) = 40
      expect(computeCount).toBe(2); // s1 triggers recompute
    });
  });
});
