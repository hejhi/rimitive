import { describe, it, expect, vi } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';

describe('subscribe factory', () => {
  it('should call callback with initial value', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback = vi.fn();
    
    api.subscribe(s, callback);
    
    expect(callback).toHaveBeenCalledWith(10);
  });

  it('should call callback when signal changes', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback = vi.fn();
    
    const unsubscribe = api.subscribe(s, callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
    
    s.value = 20;
    
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(20);
    
    unsubscribe();
  });

  it('should work with computed values', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const count = api.signal(1);
    const double = api.computed(() => count.value * 2);
    const callback = vi.fn();
    
    api.subscribe(double, callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
    
    count.value = 3;
    
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(6);
  });

  it('should not call callback if computed value does not change', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const a = api.signal(1);
    const b = api.signal(2);
    const sum = api.computed(() => {
      // Always returns 10, regardless of inputs
      a.value;
      b.value;
      return 10;
    });
    
    const callback = vi.fn();
    api.subscribe(sum, callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(10);
    
    // Change signals but computed still returns 10
    api.batch(() => {
      a.value = 5;
      b.value = 5;
    });
    
    // Callback should not be called again
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should respect batching', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const count = api.signal(0);
    const callback = vi.fn();
    
    api.subscribe(count, callback);
    callback.mockClear();
    
    api.batch(() => {
      count.value = 1;
      count.value = 2;
      count.value = 3;
    });
    
    // Should only be called once with final value
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('should dispose correctly', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const count = api.signal(0);
    const callback = vi.fn();
    
    const unsubscribe = api.subscribe(count, callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    
    unsubscribe();
    
    count.value = 1;
    
    // Callback should not be called after dispose
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple subscriptions', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const count = api.signal(0);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    const unsub1 = api.subscribe(count, callback1);
    const unsub2 = api.subscribe(count, callback2);
    
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    
    count.value = 1;
    
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(2);
    
    unsub1();
    
    count.value = 2;
    
    // Only callback2 should be called
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(3);
    
    unsub2();
  });
});