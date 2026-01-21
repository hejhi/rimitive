import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signal,
  effect,
  computed,
  resetGlobalState,
  createTestInstance,
} from './test-setup';
import { mt, raf, debounce } from './strategies';

describe('Effect', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should run immediately when created', () => {
    const fn = vi.fn();
    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should track signal dependencies', () => {
    const count = signal(0);
    const fn = vi.fn(() => void count());

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    count(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should track computed dependencies', () => {
    const num = signal(1);
    const doubled = computed(() => num() * 2);
    const fn = vi.fn(() => void doubled());

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    num(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should handle cleanup functions', () => {
    const cleanup = vi.fn();
    const sig = signal(0);
    let callCount = 0;

    effect(() => {
      void sig();
      callCount++;
      if (callCount > 1) {
        expect(cleanup).toHaveBeenCalled();
      }
      return cleanup;
    });

    expect(cleanup).not.toHaveBeenCalled();

    sig(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should call cleanup on dispose', () => {
    const cleanup = vi.fn();
    const dispose = effect(() => cleanup);

    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should stop reacting after disposal', () => {
    const sig = signal(0);
    const fn = vi.fn(() => void sig());

    const dispose = effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    sig(1);
    expect(fn).toHaveBeenCalledTimes(2);

    dispose();
    sig(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not run if already running', () => {
    const sig = signal(0);
    let runCount = 0;

    effect(() => {
      runCount++;
      if (runCount < 5) {
        sig(runCount);
      }
    });

    expect(runCount).toBeLessThan(10);
  });

  it('should handle errors in effect', () => {
    const sig = signal(0);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    effect(() => {
      if (sig() === 1) throw new Error('Test error');
    });

    sig(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should not double-dispose', () => {
    const cleanup = vi.fn();
    const dispose = effect(() => cleanup);

    dispose();
    dispose();
    dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  describe('Dynamic Effect Lifecycle', () => {
    it('should handle immediate disposal after creation', () => {
      const source = signal(0);
      let effectRan = false;

      const dispose = effect(() => {
        void source();
        effectRan = true;
      });

      expect(effectRan).toBe(true);

      // Dispose immediately
      dispose();

      // Should not run after disposal
      effectRan = false;
      source(1);
      expect(effectRan).toBe(false);
    });

    it('should handle disposal during signal updates', () => {
      const trigger = signal(0);
      let effectRuns = 0;

      // Create effect that will be disposed by another update
      const disposeEffect = effect(() => {
        if (trigger() > 0) {
          effectRuns++;
        }
      });

      trigger(1);
      expect(effectRuns).toBe(1);

      // Dispose the effect
      disposeEffect();

      // Should not run after disposal
      trigger(2);
      expect(effectRuns).toBe(1);
    });

    it('should maintain correct subscription counts with multiple effects', () => {
      const source = signal(0);
      const disposals: Array<() => void> = [];

      // Create multiple effects
      for (let i = 0; i < 3; i++) {
        const dispose = effect(() => void source());
        disposals.push(dispose);
      }

      // All should react to changes
      source(1);
      source(2);

      // Dispose all
      disposals.forEach((d) => d());

      // Signal should still be usable after all effects disposed
      source(3);
      expect(source()).toBe(3);
    });

    it('should handle multiple cycles of effect creation and disposal', () => {
      const source = signal(0);
      const effects: Array<() => void> = [];
      let totalRuns = 0;

      // Create and dispose effects in cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Create effect
        const dispose = effect(() => {
          void source();
          totalRuns++;
        });
        effects.push(dispose);

        totalRuns = 0; // Reset counter

        // Trigger it
        source(cycle + 1);
        expect(totalRuns).toBeGreaterThan(0);

        // Dispose it
        dispose();

        // Verify disposal worked
        totalRuns = 0;
        source(cycle + 10);
        expect(totalRuns).toBe(0); // Should not have run
      }

      // Cleanup remaining
      effects.forEach((d) => d());
    });
  });

  describe('Flush Strategies', () => {
    describe('mt (microtask strategy)', () => {
      let testInstance: ReturnType<typeof createTestInstance>;
      let testSignal: ReturnType<typeof createTestInstance>['signal'];
      let testEffect: ReturnType<typeof createTestInstance>['effect'];

      beforeEach(() => {
        testInstance = createTestInstance();
        testSignal = testInstance.signal;
        testEffect = testInstance.effect;
      });

      it('should run first execution synchronously', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(mt(fn));
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should defer subsequent re-runs to microtask queue', async () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(mt(fn));
        expect(fn).toHaveBeenCalledTimes(1);

        count(1);
        // Should not have run yet (deferred to microtask)
        expect(fn).toHaveBeenCalledTimes(1);

        // Wait for microtask to complete
        await Promise.resolve();
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should coalesce rapid updates (only latest runs)', async () => {
        const count = testSignal(0);
        const values: number[] = [];
        const fn = vi.fn(() => {
          values.push(count());
        });

        testEffect(mt(fn));
        expect(values).toEqual([0]);

        // Rapid updates
        count(1);
        count(2);
        count(3);

        // Still only the initial run
        expect(fn).toHaveBeenCalledTimes(1);

        // Wait for microtask
        await Promise.resolve();

        // Should have run once more with the latest value
        expect(fn).toHaveBeenCalledTimes(2);
        expect(values).toEqual([0, 3]);
      });

      it('should call cleanup before deferred re-run', async () => {
        const count = testSignal(0);
        const cleanup = vi.fn();
        const fn = vi.fn(() => {
          void count();
          return cleanup;
        });

        testEffect(mt(fn));
        expect(cleanup).not.toHaveBeenCalled();

        count(1);
        // Cleanup hasn't been called yet (deferred)
        expect(cleanup).not.toHaveBeenCalled();

        await Promise.resolve();
        // Now cleanup should have been called before the re-run
        expect(cleanup).toHaveBeenCalledTimes(1);
      });

      it('should stop reacting after disposal', async () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        const dispose = testEffect(mt(fn));
        expect(fn).toHaveBeenCalledTimes(1);

        dispose();

        count(1);
        await Promise.resolve();
        // Should not have run again
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should call cleanup on dispose', () => {
        const cleanup = vi.fn();
        const dispose = testEffect(mt(() => cleanup));

        expect(cleanup).not.toHaveBeenCalled();
        dispose();
        expect(cleanup).toHaveBeenCalledTimes(1);
      });
    });

    describe('raf (requestAnimationFrame strategy)', () => {
      let testInstance: ReturnType<typeof createTestInstance>;
      let testSignal: ReturnType<typeof createTestInstance>['signal'];
      let testEffect: ReturnType<typeof createTestInstance>['effect'];
      let rafCallbacks: Array<FrameRequestCallback>;
      let rafIds: number;

      beforeEach(() => {
        testInstance = createTestInstance();
        testSignal = testInstance.signal;
        testEffect = testInstance.effect;

        rafCallbacks = [];
        rafIds = 0;

        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
          const id = ++rafIds;
          rafCallbacks.push(cb);
          return id;
        });

        vi.stubGlobal('cancelAnimationFrame', () => {
          // Mark as cancelled by removing callback at that index
          // (simplified - in real impl we'd track by id)
          rafCallbacks = [];
        });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      const flushRaf = () => {
        const callbacks = [...rafCallbacks];
        rafCallbacks = [];
        callbacks.forEach((cb) => cb(performance.now()));
      };

      it('should run first execution synchronously', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(raf(fn));
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should defer subsequent re-runs to animation frame', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(raf(fn));
        expect(fn).toHaveBeenCalledTimes(1);

        count(1);
        // Should not have run yet
        expect(fn).toHaveBeenCalledTimes(1);

        // Flush the raf
        flushRaf();
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should coalesce rapid updates (only latest runs)', () => {
        const count = testSignal(0);
        const values: number[] = [];
        const fn = vi.fn(() => {
          values.push(count());
        });

        testEffect(raf(fn));
        expect(values).toEqual([0]);

        // Rapid updates - each should cancel the previous
        count(1);
        count(2);
        count(3);

        // Still only the initial run
        expect(fn).toHaveBeenCalledTimes(1);

        // Flush - only the latest should run
        flushRaf();
        expect(fn).toHaveBeenCalledTimes(2);
        expect(values).toEqual([0, 3]);
      });

      it('should cancel pending frame on new update', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(raf(fn));

        count(1);
        expect(rafCallbacks.length).toBe(1);

        // New update should cancel the pending frame
        count(2);
        // After cancelAnimationFrame, rafCallbacks is cleared, then new one added
        expect(rafCallbacks.length).toBe(1);
      });

      it('should call cleanup before deferred re-run', () => {
        const count = testSignal(0);
        const cleanup = vi.fn();
        const fn = vi.fn(() => {
          void count();
          return cleanup;
        });

        testEffect(raf(fn));
        expect(cleanup).not.toHaveBeenCalled();

        count(1);
        expect(cleanup).not.toHaveBeenCalled();

        flushRaf();
        expect(cleanup).toHaveBeenCalledTimes(1);
      });

      it('should stop reacting after disposal', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        const dispose = testEffect(raf(fn));
        expect(fn).toHaveBeenCalledTimes(1);

        dispose();

        count(1);
        flushRaf();
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should call cleanup on dispose', () => {
        const cleanup = vi.fn();
        const dispose = testEffect(raf(() => cleanup));

        expect(cleanup).not.toHaveBeenCalled();
        dispose();
        expect(cleanup).toHaveBeenCalledTimes(1);
      });
    });

    describe('debounce strategy', () => {
      let testInstance: ReturnType<typeof createTestInstance>;
      let testSignal: ReturnType<typeof createTestInstance>['signal'];
      let testEffect: ReturnType<typeof createTestInstance>['effect'];

      beforeEach(() => {
        vi.useFakeTimers();
        testInstance = createTestInstance();
        testSignal = testInstance.signal;
        testEffect = testInstance.effect;
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should run first execution synchronously', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(debounce(100, fn));
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should defer subsequent re-runs by debounce delay', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        testEffect(debounce(100, fn));
        expect(fn).toHaveBeenCalledTimes(1);

        count(1);
        expect(fn).toHaveBeenCalledTimes(1);

        // Before delay
        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);

        // After delay
        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should reset timer on rapid updates', () => {
        const count = testSignal(0);
        const values: number[] = [];
        const fn = vi.fn(() => {
          values.push(count());
        });

        testEffect(debounce(100, fn));
        expect(values).toEqual([0]);

        // First update
        count(1);
        vi.advanceTimersByTime(50);

        // Second update - resets timer
        count(2);
        vi.advanceTimersByTime(50);

        // Third update - resets timer again
        count(3);
        vi.advanceTimersByTime(50);

        // Still waiting
        expect(fn).toHaveBeenCalledTimes(1);

        // Now complete the debounce
        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(values).toEqual([0, 3]);
      });

      it('should coalesce rapid updates (only latest runs)', () => {
        const count = testSignal(0);
        const values: number[] = [];
        const fn = vi.fn(() => {
          values.push(count());
        });

        testEffect(debounce(100, fn));
        expect(values).toEqual([0]);

        // Rapid updates
        count(1);
        count(2);
        count(3);

        // Still only initial
        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(2);
        expect(values).toEqual([0, 3]);
      });

      it('should call cleanup before deferred re-run', () => {
        const count = testSignal(0);
        const cleanup = vi.fn();
        const fn = vi.fn(() => {
          void count();
          return cleanup;
        });

        testEffect(debounce(100, fn));
        expect(cleanup).not.toHaveBeenCalled();

        count(1);
        expect(cleanup).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(cleanup).toHaveBeenCalledTimes(1);
      });

      it('should stop reacting after disposal', () => {
        const count = testSignal(0);
        const fn = vi.fn(() => void count());

        const dispose = testEffect(debounce(100, fn));
        expect(fn).toHaveBeenCalledTimes(1);

        dispose();

        count(1);
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should call cleanup on dispose', () => {
        const cleanup = vi.fn();
        const dispose = testEffect(debounce(100, () => cleanup));

        expect(cleanup).not.toHaveBeenCalled();
        dispose();
        expect(cleanup).toHaveBeenCalledTimes(1);
      });

      it('should allow multiple effects with different debounce times', () => {
        const count = testSignal(0);
        const fn1 = vi.fn(() => void count());
        const fn2 = vi.fn(() => void count());

        testEffect(debounce(50, fn1));
        testEffect(debounce(150, fn2));

        expect(fn1).toHaveBeenCalledTimes(1);
        expect(fn2).toHaveBeenCalledTimes(1);

        count(1);

        vi.advanceTimersByTime(50);
        expect(fn1).toHaveBeenCalledTimes(2);
        expect(fn2).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(fn1).toHaveBeenCalledTimes(2);
        expect(fn2).toHaveBeenCalledTimes(2);
      });
    });
  });
});
