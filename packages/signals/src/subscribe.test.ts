import { describe, it, expect, vi } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createSubscribeFactory } from './subscribe';
import { createBatchFactory } from './batch';

describe('subscribe factory', () => {
  it('should call callback with initial value', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback = vi.fn();
    
    api.subscribe(s, callback);
    
    expect(callback).toHaveBeenCalledWith(10);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should call callback when signal changes', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback = vi.fn();
    
    api.subscribe(s, callback);
    callback.mockClear();
    
    s.value = 20;
    expect(callback).toHaveBeenCalledWith(20);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should work with computed values', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const doubled = api.computed(() => s.value * 2);
    const callback = vi.fn();
    
    api.subscribe(doubled, callback);
    expect(callback).toHaveBeenCalledWith(20);
    callback.mockClear();
    
    s.value = 15;
    expect(callback).toHaveBeenCalledWith(30);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback if computed value does not change', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      subscribe: createSubscribeFactory,
      batch: createBatchFactory,
    });

    const a = api.signal(2);
    const b = api.signal(3);
    const sum = api.computed(() => a.value + b.value);
    const callback = vi.fn();
    
    api.subscribe(sum, callback);
    expect(callback).toHaveBeenCalledWith(5);
    callback.mockClear();
    
    // Change both signals in a batch so sum remains 5
    api.batch(() => {
      a.value = 3;
      b.value = 2;
    });
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should respect batching', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      subscribe: createSubscribeFactory,
      batch: createBatchFactory,
    });

    const s1 = api.signal(1);
    const s2 = api.signal(2);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    api.subscribe(s1, callback1);
    api.subscribe(s2, callback2);
    callback1.mockClear();
    callback2.mockClear();
    
    api.batch(() => {
      s1.value = 10;
      s2.value = 20;
      // Callbacks should not be called yet
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
    
    // After batch completes
    expect(callback1).toHaveBeenCalledWith(10);
    expect(callback2).toHaveBeenCalledWith(20);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should dispose correctly', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback = vi.fn();
    
    const unsubscribe = api.subscribe(s, callback);
    callback.mockClear();
    
    unsubscribe();
    
    s.value = 20;
    expect(callback).not.toHaveBeenCalled();
  });
  
  it('should handle multiple subscriptions', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      subscribe: createSubscribeFactory,
    });

    const s = api.signal(10);
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    const unsub1 = api.subscribe(s, callback1);
    api.subscribe(s, callback2);
    
    callback1.mockClear();
    callback2.mockClear();
    
    s.value = 20;
    expect(callback1).toHaveBeenCalledWith(20);
    expect(callback2).toHaveBeenCalledWith(20);
    
    unsub1();
    callback1.mockClear();
    callback2.mockClear();
    
    s.value = 30;
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith(30);
  });
});