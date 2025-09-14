import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createSubscribeFactory } from './subscribe';
import { createBatchFactory } from './batch';
import { createBaseContext } from './context';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createNodeScheduler } from './helpers/node-scheduler';
import { createPushPropagator } from './helpers/push-propagator';

function createTestContext() {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();

  return {
    ctx: baseCtx,
    graphEdges,
    push: createPushPropagator(),
    pull: createPullPropagator(baseCtx, graphEdges),
    nodeScheduler: createNodeScheduler(baseCtx),
  };
}

describe('Subscribe - Eager Updates', () => {
  let signal: ReturnType<typeof createSignalFactory>['method'];
  let computed: ReturnType<typeof createComputedFactory>['method'];
  let subscribe: ReturnType<typeof createSubscribeFactory>['method'];
  let batch: ReturnType<typeof createBatchFactory>['method'];

  beforeEach(() => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      subscribe: createSubscribeFactory,
      batch: createBatchFactory,
    }, createTestContext());

    signal = api.signal;
    computed = api.computed;
    subscribe = api.subscribe;
    batch = api.batch;
  });

  it('should call callback immediately on signal change', () => {
    const count = signal(0);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);

    // Should be called with initial value
    expect(callback).toHaveBeenCalledWith(0);
    expect(callback).toHaveBeenCalledTimes(1);

    // Should be called immediately on change
    count(1);
    expect(callback).toHaveBeenCalledWith(1);
    expect(callback).toHaveBeenCalledTimes(2);

    count(2);
    expect(callback).toHaveBeenCalledWith(2);
    expect(callback).toHaveBeenCalledTimes(3);

    // Cleanup
    unsubscribe();
  });

  it('should work with computed values', () => {
    const count = signal(1);
    const double = computed(() => count() * 2);
    const callback = vi.fn();

    const unsubscribe = subscribe(double, callback);

    // Initial value
    expect(callback).toHaveBeenCalledWith(2);
    expect(callback).toHaveBeenCalledTimes(1);

    // Should update when dependency changes
    count(2);
    expect(callback).toHaveBeenCalledWith(4);
    expect(callback).toHaveBeenCalledTimes(2);

    // Should update ONLY when dependency changes
    count(2);
    expect(callback).toHaveBeenCalledTimes(2);

    count(3);
    expect(callback).toHaveBeenCalledWith(6);
    expect(callback).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it('should execute eagerly even during batch', () => {
    const count = signal(0);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);
    callback.mockClear();

    batch(() => {
      count(1);
      // Subscribe callback should have been called immediately
      expect(callback).toHaveBeenCalledWith(1);
      expect(callback).toHaveBeenCalledTimes(1);

      count(2);
      expect(callback).toHaveBeenCalledWith(2);
      expect(callback).toHaveBeenCalledTimes(2);

      count(3);
      expect(callback).toHaveBeenCalledWith(3);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    // No additional calls after batch
    expect(callback).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it('should support multiple subscriptions to same source', () => {
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

    // Only callback2 should be called
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
    expect(callback).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  it('should handle derived computations in callback', () => {
    const a = signal(1);
    const b = signal(2);
    const results: number[] = [];

    // Subscribe to a, but use b in callback
    const unsubscribe = subscribe(a, (val: number) => {
      results.push(val + b());
    });

    expect(results).toEqual([3]); // Initial: 1 + 2

    a(2);
    expect(results).toEqual([3, 4]); // 2 + 2

    // Changing b WON'T trigger subscription - only subscribed to a
    b(3);
    expect(results).toEqual([3, 4]); // No change

    // Next a change will use current b value
    a(3);
    expect(results).toEqual([3, 4, 6]); // 3 + 3

    unsubscribe();
  });

  it('should handle nested subscriptions', () => {
    const outer = signal(1);
    const inner = signal(10);
    const results: string[] = [];

    const unsubscribe = subscribe(outer, (outerVal: number) => {
      results.push(`outer:${outerVal}`);

      // Create nested subscription
      const innerUnsub = subscribe(inner, (innerVal: number) => {
        results.push(`inner:${innerVal}`);
      });

      // Clean up after first inner callback
      innerUnsub();
    });

    expect(results).toEqual(['outer:1', 'inner:10']);

    outer(2);
    expect(results).toEqual(['outer:1', 'inner:10', 'outer:2', 'inner:10']);

    inner(20);
    // Inner subscription was cleaned up, so no new entries
    expect(results).toEqual(['outer:1', 'inner:10', 'outer:2', 'inner:10']);

    unsubscribe();
  });

  it('should not cause infinite loops with circular updates', () => {
    const a = signal(0);
    const b = signal(0);
    let callCount = 0;

    const unsubscribe = subscribe(a, (val: number) => {
      callCount++;
      if (callCount > 10) {
        throw new Error('Infinite loop detected');
      }
      // This doesn't create a loop because b changes don't trigger this subscription
      b(val + 1);
    });

    expect(callCount).toBe(1); // Initial call
    expect(b()).toBe(1);

    a(5);
    expect(callCount).toBe(2);
    expect(b()).toBe(6);

    unsubscribe();
  });

  it('should allow disposal multiple times safely', () => {
    const count = signal(0);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);

    unsubscribe();
    unsubscribe(); // Should not throw

    count(1);
    expect(callback).toHaveBeenCalledTimes(1); // Only initial call
  });

  it('should not fire callback when signal value does not change', () => {
    const count = signal(5);
    const callback = vi.fn();

    const unsubscribe = subscribe(count, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(5);

    callback.mockClear();

    // Set to same value
    count(5);
    expect(callback).toHaveBeenCalledTimes(0); // Should not fire

    // Change to different value
    count(6);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(6);

    // Set to same value again
    count(6);
    expect(callback).toHaveBeenCalledTimes(1); // Still just once

    unsubscribe();
  });

  it('should fire eagerly even during batch with intermediate values', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a() + b());
    const callback = vi.fn();

    const unsubscribe = subscribe(sum, callback);
    expect(callback).toHaveBeenCalledWith(5);

    callback.mockClear();

    // Change a and b - subscribe fires eagerly with intermediate values
    batch(() => {
      a(3); // Sum becomes 6 (3 + 3)
      b(2); // Sum becomes 5 (3 + 2)
    });

    // Subscribe fires eagerly for each change during batch
    expect(callback).toHaveBeenCalledTimes(2); // Fires for 6, then back to 5
    expect(callback).toHaveBeenNthCalledWith(1, 6); // Intermediate value
    expect(callback).toHaveBeenNthCalledWith(2, 5); // Final value

    // Now change to produce same result - optimization should prevent callback
    callback.mockClear();
    a(4); // 4 + 2 = 6
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(6);

    // Set to same value again - no callback due to optimization
    callback.mockClear();
    batch(() => {
      a(3); // 3 + 2 = 5, then...
      a(4); // 4 + 2 = 6
    });
    // Should see 5 then 6
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 5);
    expect(callback).toHaveBeenNthCalledWith(2, 6);

    unsubscribe();
  });
});