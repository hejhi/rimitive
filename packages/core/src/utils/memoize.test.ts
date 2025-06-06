import { describe, it, expect, vi } from 'vitest';
import { memoizeParameterizedView } from './memoize';

describe('memoizeParameterizedView', () => {
  it('should cache results for single object parameter', () => {
    const spy = vi.fn((obj: { id: number }) => ({ value: obj.id * 2 }));
    const memoized = memoizeParameterizedView(spy);

    const obj1 = { id: 1 };
    const obj2 = { id: 2 };

    // First call
    const result1 = memoized(obj1);
    expect(result1).toEqual({ value: 2 });
    expect(spy).toHaveBeenCalledTimes(1);

    // Second call with same object
    const result2 = memoized(obj1);
    expect(result2).toBe(result1); // Same reference
    expect(spy).toHaveBeenCalledTimes(1); // Not called again

    // Call with different object
    const result3 = memoized(obj2);
    expect(result3).toEqual({ value: 4 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should cache results for primitive parameters', () => {
    const spy = vi.fn((a: number, b: string) => `${a}:${b}`);
    const memoized = memoizeParameterizedView(spy);

    // First call
    const result1 = memoized(1, 'hello');
    expect(result1).toBe('1:hello');
    expect(spy).toHaveBeenCalledTimes(1);

    // Second call with same args
    const result2 = memoized(1, 'hello');
    expect(result2).toBe(result1);
    expect(spy).toHaveBeenCalledTimes(1); // Cached

    // Different args
    const result3 = memoized(2, 'world');
    expect(result3).toBe('2:world');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should handle null and undefined parameters', () => {
    const spy = vi.fn((a: number | null, b: string | undefined) => `${a}:${b}`);
    const memoized = memoizeParameterizedView(spy);

    const result1 = memoized(null, undefined);
    expect(result1).toBe('null:undefined');
    expect(spy).toHaveBeenCalledTimes(1);

    const result2 = memoized(null, undefined);
    expect(result2).toBe(result1);
    expect(spy).toHaveBeenCalledTimes(1); // Cached
  });

  it('should limit primitive cache size', () => {
    const spy = vi.fn((n: number) => n * 2);
    const memoized = memoizeParameterizedView(spy, 3); // Max 3 entries

    // Add more than the cache limit
    expect(memoized(1)).toBe(2);
    expect(memoized(2)).toBe(4);
    expect(memoized(3)).toBe(6);
    expect(memoized(4)).toBe(8);
    expect(memoized(5)).toBe(10);
    
    // Should have called function 5 times
    expect(spy).toHaveBeenCalledTimes(5);

    // Reset spy
    spy.mockClear();

    // Recent items should be cached
    expect(memoized(5)).toBe(10);
    expect(memoized(4)).toBe(8);
    expect(memoized(3)).toBe(6);
    
    // Should not have made any new calls for cached items
    expect(spy).toHaveBeenCalledTimes(0);
    
    // Oldest items should have been evicted and need recomputation
    expect(memoized(1)).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
    
    expect(memoized(2)).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should not cache mixed object/primitive arguments', () => {
    const spy = vi.fn((obj: object, str: string) => ({ obj, str }));
    const memoized = memoizeParameterizedView(spy);

    const obj1 = { id: 1 };
    
    const result1 = memoized(obj1, 'hello');
    expect(spy).toHaveBeenCalledTimes(1);

    // Same arguments should not be cached (mixed types)
    const result2 = memoized(obj1, 'hello');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result2).not.toBe(result1);
  });

  it('should work with no arguments', () => {
    const spy = vi.fn(() => ({ timestamp: Date.now() }));
    const memoized = memoizeParameterizedView(spy);

    const result1 = memoized();
    expect(spy).toHaveBeenCalledTimes(1);

    // Should be cached
    const result2 = memoized();
    expect(result2).toBe(result1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should allow garbage collection of object keys', () => {
    const spy = vi.fn((obj: object) => ({ ...obj }));
    const memoized = memoizeParameterizedView(spy);

    // Create object in a scope that can be garbage collected
    (() => {
      const tempObj = { temp: true };
      memoized(tempObj);
      expect(spy).toHaveBeenCalledTimes(1);
      // tempObj goes out of scope here
    })();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // New object with same shape should require new computation
    const newObj = { temp: true };
    memoized(newObj);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});