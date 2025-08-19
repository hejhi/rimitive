import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, effect, computed, batch, resetGlobalState } from './test-setup';

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
    const fn = vi.fn(() => {
      void count(); // Access signal to create dependency
    });

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    count(1);
    expect(fn).toHaveBeenCalledTimes(2);

    count(2);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should track computed dependencies', () => {
    const num = signal(1);
    const doubled = computed(() => num() * 2);
    const fn = vi.fn(() => {
      void doubled(); // Access computed to create dependency
    });

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
        // Cleanup should have been called
        expect(cleanup).toHaveBeenCalled();
      }
      return cleanup;
    });
    
    expect(cleanup).not.toHaveBeenCalled();
    
    // Trigger effect again - cleanup should be called before re-running
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
    const fn = vi.fn(() => { void sig(); });

    const dispose = effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    sig(1);
    expect(fn).toHaveBeenCalledTimes(2);

    dispose();

    sig(2);
    expect(fn).toHaveBeenCalledTimes(2); // Should not run again
  });

  it('should batch multiple updates', () => {
    const a = signal(1);
    const b = signal(2);
    const fn = vi.fn(() => {
      void a();
      void b();
    });

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    batch(() => {
      a(10);
      b(20);
    });

    expect(fn).toHaveBeenCalledTimes(2); // Only once after batch
  });

  it('should handle nested effects', () => {
    const sig = signal(0);
    const outerFn = vi.fn();
    const innerFn = vi.fn();

    effect(() => {
      outerFn();
      void sig();
      
      effect(() => {
        innerFn();
        void sig();
      });
    });

    expect(outerFn).toHaveBeenCalledTimes(1);
    expect(innerFn).toHaveBeenCalledTimes(1);

    sig(1);
    expect(outerFn).toHaveBeenCalledTimes(2);
    expect(innerFn).toBeCalledTimes(3); // 1 initial + 1 from outer re-run + 1 from signal change
  });

  it('should not run if already running (avoid infinite loops)', () => {
    const sig = signal(0);
    let runCount = 0;

    effect(() => {
      runCount++;
      if (runCount < 5) {
        sig(runCount); // This would cause infinite loop without protection
      }
    });

    expect(runCount).toBeLessThan(10); // Should not spiral out of control
  });

  it('should handle errors in effect function', () => {
    const sig = signal(0);
    const error = new Error('Test error');
    const fn = vi.fn(() => {
      void sig();
      if (fn.mock.calls.length === 1) {
        throw error;
      }
    });

    expect(() => effect(fn)).toThrow(error);
    expect(fn).toHaveBeenCalledTimes(1);

    // Signal update should trigger effect again but not throw
    sig(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should maintain correct tracking after cleanup', () => {
    const a = signal(1);
    const b = signal(2);
    const condition = signal(true);
    const fn = vi.fn(() => {
      if (condition()) {
        void a();
      } else {
        void b();
      }
    });

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Change a - should trigger
    a(10);
    expect(fn).toHaveBeenCalledTimes(2);

    // Change b - should not trigger (not tracked)
    b(20);
    expect(fn).toHaveBeenCalledTimes(2);

    // Switch condition
    condition(false);
    expect(fn).toHaveBeenCalledTimes(3);

    // Now a should not trigger
    a(100);
    expect(fn).toHaveBeenCalledTimes(3);

    // But b should trigger
    b(200);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should have __effect property on dispose function', () => {
    const dispose = effect(() => {});
    expect(dispose).toHaveProperty('__effect');
    expect(dispose.__effect).toHaveProperty('_invalidate');
    expect(dispose.__effect).toHaveProperty('_flush');
    expect(dispose.__effect).toHaveProperty('dispose');
  });

  it('should handle multiple effects on same signal', () => {
    const sig = signal(0);
    const fn1 = vi.fn(() => { void sig(); });
    const fn2 = vi.fn(() => { void sig(); });
    const fn3 = vi.fn(() => { void sig(); });

    effect(fn1);
    effect(fn2);
    effect(fn3);

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn3).toHaveBeenCalledTimes(1);

    sig(1);

    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(2);
    expect(fn3).toHaveBeenCalledTimes(2);
  });

  it('should not double-dispose', () => {
    const cleanup = vi.fn();
    const sig = signal(0);
    
    const dispose = effect(() => {
      void sig();
      return cleanup;
    });

    expect(cleanup).not.toHaveBeenCalled();

    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);

    // Second dispose should be no-op
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should respect batching with nested batch calls', () => {
    const sig = signal(0);
    const fn = vi.fn(() => { void sig(); });

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    batch(() => {
      sig(1);
      batch(() => {
        sig(2);
        batch(() => {
          sig(3);
        });
      });
    });

    // Should only run once after all batches complete
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sig()).toBe(3);
  });

  it('should work with circular dependencies through computed', () => {
    const toggle = signal(true);
    const a = signal(1);
    const b = signal(2);
    
    const comp = computed(() => {
      return toggle() ? a() : b();
    });

    const fn = vi.fn(() => {
      void comp();
    });

    effect(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Changing the active dependency should trigger
    a(10);
    expect(fn).toHaveBeenCalledTimes(2);

    // Changing inactive dependency should not trigger
    b(20);
    expect(fn).toHaveBeenCalledTimes(2);

    // Toggle to make b active
    toggle(false);
    expect(fn).toHaveBeenCalledTimes(3);

    // Now b changes should trigger
    b(30);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});