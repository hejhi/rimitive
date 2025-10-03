import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, computed, resetGlobalState } from './test-setup';

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
      disposals.forEach(d => d());

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
      effects.forEach(d => d());
    });
  });
});
