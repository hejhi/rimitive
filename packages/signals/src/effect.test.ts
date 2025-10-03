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
});
