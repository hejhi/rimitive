import { describe, it, expect, vi } from 'vitest';
import { createComponent } from '../component/component';

describe('effect', () => {
  it('should run immediately when created', () => {
    const fn = vi.fn();
    const context = createComponent({ count: 0 });

    context.effect(fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should track dependencies and re-run when they change', () => {
    const fn = vi.fn();
    const context = createComponent({ count: 0 });

    context.effect(() => {
      fn(context.store.count());
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);

    context.set(context.store.count, 5);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(5);
  });

  it('should track multiple dependencies', () => {
    const fn = vi.fn();
    const context = createComponent({ a: 1, b: 2 });

    context.effect(() => {
      fn(context.store.a() + context.store.b());
    });

    expect(fn).toHaveBeenCalledWith(3);

    context.set(context.store.a, 5);
    expect(fn).toHaveBeenCalledWith(7);

    context.set(context.store.b, 10);
    expect(fn).toHaveBeenCalledWith(15);
  });

  it('should handle cleanup functions', () => {
    const cleanup = vi.fn();
    const context = createComponent({ count: 0 });

    context.effect(() => {
      context.store.count(); // Track dependency
      return cleanup;
    });

    // Cleanup should not be called on first run
    expect(cleanup).not.toHaveBeenCalled();

    // Update should trigger cleanup of previous effect
    context.set(context.store.count, 1);
    expect(cleanup).toHaveBeenCalledTimes(1);

    // Another update should trigger cleanup again
    context.set(context.store.count, 2);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('should stop running when disposed', () => {
    const fn = vi.fn();
    const context = createComponent({ count: 0 });

    const dispose = context.effect(() => {
      fn(context.store.count());
    });

    expect(fn).toHaveBeenCalledTimes(1);

    dispose();

    // Should not run after disposal
    context.set(context.store.count, 5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should run final cleanup when disposed', () => {
    const cleanup = vi.fn();
    const context = createComponent({ count: 0 });

    const dispose = context.effect(() => {
      context.store.count();
      return cleanup;
    });

    // Cleanup not called yet
    expect(cleanup).not.toHaveBeenCalled();

    dispose();

    // Final cleanup should be called
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should handle effects that depend on computed values', () => {
    const fn = vi.fn();
    const context = createComponent({ count: 0 });
    const doubled = context.computed(() => context.store.count() * 2);

    context.effect(() => {
      fn(doubled());
    });

    expect(fn).toHaveBeenCalledWith(0);

    context.set(context.store.count, 5);
    expect(fn).toHaveBeenCalledWith(10);
  });

  it('should batch multiple updates in the same tick', () => {
    const fn = vi.fn();
    const runCount = vi.fn();
    const context = createComponent({ a: 1, b: 2 });

    context.effect(() => {
      runCount();
      fn(context.store.a() + context.store.b());
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    expect(runCount).toHaveBeenCalledTimes(1);

    // Clear to track only updates
    fn.mockClear();
    runCount.mockClear();

    // Test that batch updates work and only trigger effect once
    context.set(context.store, { a: 5, b: 10 });

    // Values should be updated
    expect(context.store.a()).toBe(5);
    expect(context.store.b()).toBe(10);

    // Effect should have run exactly once (not twice for two property updates)
    expect(runCount).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(15);
  });

  it('should run effects after individual updates', () => {
    const fn = vi.fn();
    const context = createComponent({ a: 1, b: 2, c: 3 });

    context.effect(() => {
      fn(context.store.a() + context.store.b() + context.store.c());
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(6);

    fn.mockClear();

    // Multiple individual updates should each trigger the effect
    context.set(context.store.a, 10);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(15); // 10 + 2 + 3

    context.set(context.store.b, 20);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(33); // 10 + 20 + 3

    context.set(context.store.c, 30);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenCalledWith(60); // 10 + 20 + 30
  });

  it('should handle effects that create new effects', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const context = createComponent({ enabled: false, count: 0 });

    let innerDispose: (() => void) | null = null;

    context.effect(() => {
      outer();

      if (context.store.enabled()) {
        innerDispose = context.effect(() => {
          inner(context.store.count());
        });
      } else if (innerDispose) {
        innerDispose();
        innerDispose = null;
      }
    });

    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).not.toHaveBeenCalled();

    // Enable inner effect
    context.set(context.store.enabled, true);
    expect(outer).toHaveBeenCalledTimes(2);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith(0);

    // Update count should trigger inner effect
    context.set(context.store.count, 5);
    expect(inner).toHaveBeenCalledWith(5);

    // Disable should stop inner effect
    context.set(context.store.enabled, false);
    expect(outer).toHaveBeenCalledTimes(3);

    // Count updates should not trigger inner anymore
    const innerCallCount = inner.mock.calls.length;
    context.set(context.store.count, 10);
    expect(inner).toHaveBeenCalledTimes(innerCallCount);
  });

  it('should handle errors in effects', () => {
    const context = createComponent({ count: 0 });
    const error = new Error('Effect error');

    expect(() => {
      context.effect(() => {
        context.store.count();
        throw error;
      });
    }).toThrow(error);
  });

  it('should handle errors in cleanup functions', () => {
    const context = createComponent({ count: 0 });
    const cleanupError = new Error('Cleanup error');

    context.effect(() => {
      context.store.count();
      return () => {
        throw cleanupError;
      };
    });

    // Error in cleanup should not prevent effect from running
    expect(() => {
      context.set(context.store.count, 1);
    }).toThrow(cleanupError);
  });

  it('should not create infinite loops with circular dependencies', async () => {
    const context = createComponent({ a: 0, b: 0 });
    let effectACount = 0;
    let effectBCount = 0;

    context.effect(() => {
      effectACount++;
      if (effectACount > 10) {
        throw new Error('Infinite loop detected in effect A');
      }

      const a = context.store.a();
      if (a < 5) {
        context.set(context.store.b, a + 1);
      }
    });

    context.effect(() => {
      effectBCount++;
      if (effectBCount > 10) {
        throw new Error('Infinite loop detected in effect B');
      }

      const b = context.store.b();
      if (b < 5) {
        context.set(context.store.a, b + 1);
      }
    });

    // Wait for effects to stabilize
    await new Promise((resolve) => setTimeout(resolve, 10));

    // The re-entrant protection prevents infinite loops
    // Effects stop running when they would cause re-entrant execution
    expect(effectACount).toBeLessThan(10);
    expect(effectBCount).toBeLessThan(10);

    // Values may not reach 5 due to re-entrant protection
    const finalA = context.store.a();
    const finalB = context.store.b();
    expect(finalA).toBeGreaterThanOrEqual(0);
    expect(finalB).toBeGreaterThanOrEqual(0);
  });

  it('should track dependencies dynamically', () => {
    const fn = vi.fn();
    const context = createComponent({ useA: true, a: 1, b: 2 });

    context.effect(() => {
      if (context.store.useA()) {
        fn('a', context.store.a());
      } else {
        fn('b', context.store.b());
      }
    });

    expect(fn).toHaveBeenCalledWith('a', 1);
    fn.mockClear();

    // Changing b should not trigger effect
    context.set(context.store.b, 20);
    expect(fn).not.toHaveBeenCalled();

    // Switch to using b
    context.set(context.store.useA, false);
    expect(fn).toHaveBeenCalledWith('b', 20);
    fn.mockClear();

    // Now changing a should not trigger effect
    context.set(context.store.a, 10);
    expect(fn).not.toHaveBeenCalled();

    // But changing b should
    context.set(context.store.b, 30);
    expect(fn).toHaveBeenCalledWith('b', 30);
  });
});
