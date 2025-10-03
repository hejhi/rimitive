import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  signal,
  subscribe,
  computed,
  resetGlobalState,
} from './test-setup';

describe('Subscribe', () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it('should call callback on signal change', () => {
    const count = signal(0);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);

    expect(callback).toHaveBeenCalledWith(0);
    expect(callback).toHaveBeenCalledTimes(1);

    count(1);
    expect(callback).toHaveBeenCalledWith(1);
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('should work with computed values', () => {
    const count = signal(1);
    const double = computed(() => count() * 2);
    const callback = vi.fn();

    const unsubscribe = subscribe(double, callback);

    expect(callback).toHaveBeenCalledWith(2);

    count(2);
    expect(callback).toHaveBeenCalledWith(4);
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('should support multiple subscriptions', () => {
    const count = signal(0);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const unsubscribe1 = subscribe(count, callback1);
    const unsubscribe2 = subscribe(count, callback2);

    callback1.mockClear();
    callback2.mockClear();

    count(1);

    expect(callback1).toHaveBeenCalledWith(1);
    expect(callback2).toHaveBeenCalledWith(1);

    unsubscribe1();

    count(2);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith(2);

    unsubscribe2();
  });

  it('should unsubscribe cleanly', () => {
    const count = signal(0);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);
    callback.mockClear();

    count(1);
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();

    count(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle derived computations in callback', () => {
    const a = signal(1);
    const b = signal(2);
    const results: number[] = [];

    const unsubscribe = subscribe(a, (val: number) => {
      results.push(val + b());
    });

    expect(results).toEqual([3]); // 1 + 2

    a(2);
    expect(results).toEqual([3, 4]); // 2 + 2

    // Changing b won't trigger - only subscribed to a
    b(3);
    expect(results).toEqual([3, 4]);

    a(3);
    expect(results).toEqual([3, 4, 6]); // 3 + 3

    unsubscribe();
  });

  it('should not fire when value unchanged', () => {
    const count = signal(5);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);
    expect(callback).toHaveBeenCalledWith(5);

    callback.mockClear();

    count(5); // Same value
    expect(callback).not.toHaveBeenCalled();

    count(6);
    expect(callback).toHaveBeenCalledWith(6);

    unsubscribe();
  });
});
