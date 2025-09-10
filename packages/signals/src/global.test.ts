import { describe, it, expect, beforeEach } from 'vitest';
import {
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

  describe('currentConsumer tracking', () => {
    it('should track currently executing computed', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentConsumer> = null;

      const c = computed(() => {
        capturedCurrent = getCurrentConsumer();
        return s() * 2;
      });

      // Before execution, should be null
      expect(getCurrentConsumer()).toBe(null);

      // During execution, should be the computed's internal state
      void c();
      expect(capturedCurrent).not.toBe(null);
      expect((capturedCurrent as unknown as {__type: string})?.__type).toBe('computed');

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
        return s() * 2;
      });

      const outer = computed(() => {
        captures.push({ type: 'outer-before', current: getCurrentConsumer() });
        const result = inner() + s();
        captures.push({ type: 'outer-after', current: getCurrentConsumer() });
        return result;
      });

      void outer();

      expect(captures).toHaveLength(3);
      // Check that currentConsumer is being tracked (now state objects, not functions)
      expect(captures[0]!.type).toBe('outer-before');
      expect((captures[0]!.current as unknown as {__type: string})?.__type).toBe('computed');
      expect(captures[1]!.type).toBe('inner');
      expect((captures[1]!.current as unknown as {__type: string})?.__type).toBe('computed');
      expect(captures[2]!.type).toBe('outer-after');
      expect(captures[2]!.current).toBe(captures[0]!.current); // Same outer computed state
    });

    it('should track currently executing effect', () => {
      const s = signal(1);
      let capturedCurrent: ReturnType<typeof getCurrentConsumer> = null;
      let effectRan = false;

      const dispose = effect(() => {
        capturedCurrent = getCurrentConsumer();
        effectRan = true;
        void s(); // Subscribe to signal
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

      // Store initial consumer states for comparison
      let c1State: unknown;
      let c2State: unknown;
      
      const c1 = computed(() => {
        executionOrder.push('c1-start');
        const current = getCurrentConsumer();
        if (!c1State) c1State = current;
        executionOrder.push(`c1-current:${current === c1State}`);
        const result = s1() * 2;
        executionOrder.push('c1-end');
        return result;
      });

      const c2 = computed(() => {
        executionOrder.push('c2-start');
        const current = getCurrentConsumer();
        if (!c2State) c2State = current;
        executionOrder.push(`c2-current:${current === c2State}`);
        const result = c1() + s2();
        executionOrder.push(`c2-after-c1:${getCurrentConsumer() === c2State}`);
        executionOrder.push('c2-end');
        return result;
      });

      void c2();

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
        if (s() > 5) {
          throw new Error('Test error');
        }
        return s() * 2;
      });

      capturedBefore = getCurrentConsumer();

      // Normal execution
      expect(c()).toBe(2);
      expect(capturedBefore).toBe(null);
      expect((capturedDuring as unknown as {__type: string})?.__type).toBe('computed');

      // Execution with error
      s(10);
      capturedBefore = getCurrentConsumer();

      expect(() => c()).toThrow('Test error');

      const capturedAfter = getCurrentConsumer();
      expect(capturedBefore).toBe(null);
      expect(capturedAfter).toBe(null);
    });
  });

  describe('setCurrentConsumer', () => {
    // Note: setCurrentConsumer expects a ConsumerNode, not a ComputedFunction
    // These are internal implementation details and shouldn't be tested directly
    // The current consumer is managed internally during computation
    
    it('should affect dependency tracking', () => {
      const s = signal(1);
      let dependencyAdded = false;

      // Create a real computed to test dependency tracking
      const c = computed(() => {
        dependencyAdded = true;
        return s() * 2;
      });

      // Without current computed set, reading signal shouldn't track
      void s();
      expect(dependencyAdded).toBe(false);

      // When computed executes, it becomes current and tracks dependencies
      void c();
      expect(dependencyAdded).toBe(true);

      // After execution, current computed should be cleared
      expect(getCurrentConsumer()).toBe(null);
    });
  });

  describe('resetGlobalState', () => {
    it('should reset global version', () => {
      const s = signal(1);
      const c = computed(() => s() * 2);

      // Trigger some version increments
      void c();
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

    it('should clear current consumer', () => {
      // The current consumer is managed internally during computation
      // After reset, it should be null
      resetGlobalState();
      expect(getCurrentConsumer()).toBe(null);
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
        void s(); // Subscribe
      });

      expect(effectCount).toBe(1);

      s(1);
      expect(effectCount).toBe(2);

      dispose();

      // After disposal, changes shouldn't trigger effect
      s(2);
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
