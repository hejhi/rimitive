import { describe, it, expect, vi } from 'vitest';
import { subscribeToSlices, shallowEqual } from './subscribe';

describe('subscribeToSlices', () => {
  // Create a simple test store
  const createTestStore = (initialState = { count: 0, name: 'test' }) => {
    let state = initialState;
    const listeners = new Set<() => void>();

    const store = {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      counter: {
        value: () => state.count,
        increment: () => {
          state = { ...state, count: state.count + 1 };
          listeners.forEach((l) => l());
        },
      },
      user: {
        name: () => state.name,
        setName: (name: string) => {
          state = { ...state, name };
          listeners.forEach((l) => l());
        },
      },
    };

    return store;
  };

  it('should only call callback when selected values change', () => {
    const store = createTestStore();
    const callback = vi.fn();

    const unsubscribe = subscribeToSlices(
      store,
      (s) => s.counter.value(),
      callback
    );

    // Callback should not be called on subscription
    expect(callback).not.toHaveBeenCalled();

    // Change unrelated state
    store.user.setName('new name');
    expect(callback).not.toHaveBeenCalled();

    // Change selected state
    store.counter.increment();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1, 0);

    unsubscribe();
  });

  it('should support selecting multiple values', () => {
    const store = createTestStore();
    const callback = vi.fn();

    subscribeToSlices(
      store,
      (s) => ({
        count: s.counter.value(),
        name: s.user.name(),
      }),
      callback
    );

    store.counter.increment();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      { count: 1, name: 'test' },
      { count: 0, name: 'test' }
    );

    store.user.setName('alice');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(
      { count: 1, name: 'alice' },
      { count: 1, name: 'test' }
    );
  });

  it('should support fireImmediately option', () => {
    const store = createTestStore();
    const callback = vi.fn();

    subscribeToSlices(store, (s) => s.counter.value(), callback, {
      fireImmediately: true,
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(0, undefined);
  });

  it('should handle selector errors gracefully', () => {
    const store = createTestStore();
    const callback = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    subscribeToSlices(
      store,
      () => {
        throw new Error('Selector error');
      },
      callback
    );

    expect(callback).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Error in subscribeToSlices selector:',
      expect.any(Error)
    );

    consoleError.mockRestore();
  });

  it('should use custom equality function', () => {
    const store = createTestStore({ count: 1, name: 'test' });
    const callback = vi.fn();

    // Only care about count changes > 5
    const customEqual = (a: number, b: number) => Math.abs(a - b) < 5;

    subscribeToSlices(store, (s) => s.counter.value(), callback, {
      equalityFn: customEqual,
    });

    // Small changes should not trigger callback
    store.counter.increment(); // 2
    store.counter.increment(); // 3
    store.counter.increment(); // 4
    expect(callback).not.toHaveBeenCalled();

    // Large change should trigger
    store.counter.increment(); // 5
    store.counter.increment(); // 6
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(6, 1);
  });
});

describe('shallowEqual', () => {
  it('should return true for identical values', () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual('test', 'test')).toBe(true);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(undefined, undefined)).toBe(true);
  });

  it('should return true for shallowly equal objects', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowEqual({}, {})).toBe(true);
  });

  it('should return false for different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual('a', 'b')).toBe(false);
    expect(shallowEqual(null, undefined)).toBe(false);
  });

  it('should return false for deeply different objects', () => {
    const obj1 = { a: { b: 1 } };
    const obj2 = { a: { b: 1 } };
    expect(shallowEqual(obj1, obj2)).toBe(false); // Different object references
  });
});