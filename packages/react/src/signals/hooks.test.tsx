import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { signal, computed } from '@lattice/signals';
import {
  useSubscribe,
  useSignal,
  useComputed,
  useSignalEffect,
  useSelector,
} from './hooks';

describe('Signal Hooks', () => {
  describe('useSubscribe', () => {
    it('should return current signal value', () => {
      const count = signal(0);
      const { result } = renderHook(() => useSubscribe(count));

      expect(result.current).toBe(0);
    });

    it('should re-render when signal changes', () => {
      const count = signal(0);
      const { result } = renderHook(() => useSubscribe(count));

      expect(result.current).toBe(0);

      act(() => {
        count.value = 1;
      });

      expect(result.current).toBe(1);
    });

    it('should work with computed values', () => {
      const count = signal(5);
      const doubled = computed(() => count.value * 2);
      const { result } = renderHook(() => useSubscribe(doubled));

      expect(result.current).toBe(10);

      act(() => {
        count.value = 10;
      });

      expect(result.current).toBe(20);
    });

    it('should work with selected values', () => {
      const user = signal({ name: 'John', age: 30 });
      const name = user.select((u) => u.name);
      const { result } = renderHook(() => useSubscribe(name));

      expect(result.current).toBe('John');

      act(() => {
        user.value = { name: 'Jane', age: 25 };
      });

      expect(result.current).toBe('Jane');
    });
  });

  describe('useSignal', () => {
    it('should create a local signal with initial value', () => {
      const { result } = renderHook(() => useSignal(42));
      const [value] = result.current;

      expect(value).toBe(42);
    });

    it('should update value with setter', () => {
      const { result } = renderHook(() => useSignal(0));

      expect(result.current[0]).toBe(0);

      act(() => {
        result.current[1](10);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support function updates', () => {
      const { result } = renderHook(() => useSignal(5));

      act(() => {
        result.current[1]((prev) => prev * 2);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support lazy initialization', () => {
      const init = vi.fn(() => 42);
      const { result } = renderHook(() => useSignal(init));

      expect(result.current[0]).toBe(42);
      expect(init).toHaveBeenCalledOnce();
    });
  });

  describe('useComputed', () => {
    it('should return a computed instance', () => {
      const count = signal(5);
      const { result } = renderHook(() => useComputed(() => count.value * 2));

      expect(result.current.value).toBe(10);

      act(() => {
        count.value = 7;
      });

      expect(result.current.value).toBe(14);
    });

    it('should work with useSubscribe', () => {
      const count = signal(5);
      const { result } = renderHook(() => {
        const computed = useComputed(() => count.value * 2);
        return useSubscribe(computed);
      });

      expect(result.current).toBe(10);

      act(() => {
        count.value = 7;
      });

      expect(result.current).toBe(14);
    });

    it('should respect manual dependencies', () => {
      let multiplier = 2;
      const count = signal(5);

      const { result, rerender } = renderHook(
        ({ mult }) => {
          const computed = useComputed(() => count.value * mult, [mult]);
          return useSubscribe(computed);
        },
        { initialProps: { mult: multiplier } }
      );

      expect(result.current).toBe(10);

      // Change multiplier and rerender
      multiplier = 3;
      rerender({ mult: multiplier });

      expect(result.current).toBe(15);
    });
  });

  describe('useSignalEffect', () => {
    it('should run effect when dependencies change', () => {
      const count = signal(0);
      const effectFn = vi.fn();

      renderHook(() => {
        useSignalEffect(() => {
          effectFn(count.value);
        });
      });

      expect(effectFn).toHaveBeenCalledWith(0);

      act(() => {
        count.value = 1;
      });

      expect(effectFn).toHaveBeenCalledWith(1);
      expect(effectFn).toHaveBeenCalledTimes(2);
    });

    it('should support cleanup functions', () => {
      const cleanup = vi.fn();
      const count = signal(0);

      const { unmount } = renderHook(() => {
        useSignalEffect(() => {
          const value = count.value;
          return () => {
            cleanup(value);
          };
        });
      });

      act(() => {
        count.value = 1;
      });

      expect(cleanup).toHaveBeenCalledWith(0);

      unmount();

      expect(cleanup).toHaveBeenCalledWith(1);
    });

    it('should track dependencies automatically', () => {
      const a = signal(1);
      const b = signal(2);
      const effectFn = vi.fn();

      renderHook(() => {
        useSignalEffect(() => {
          effectFn(a.value + b.value);
        });
      });

      expect(effectFn).toHaveBeenCalledWith(3);

      act(() => {
        a.value = 2;
      });

      expect(effectFn).toHaveBeenCalledWith(4);

      act(() => {
        b.value = 3;
      });

      expect(effectFn).toHaveBeenCalledWith(5);
    });
  });

  describe('useSelector', () => {
    it('should select specific values from signal', () => {
      const user = signal({ name: 'John', age: 30, email: 'john@example.com' });
      const { result } = renderHook(() => useSelector(user, (u) => u.name));

      expect(result.current).toBe('John');
    });

    it('should only re-render when selected value changes', () => {
      const user = signal({ name: 'John', age: 30 });
      const renderCount = { current: 0 };

      const { result } = renderHook(() => {
        renderCount.current++;
        return useSelector(user, (u) => u.name);
      });

      expect(result.current).toBe('John');
      expect(renderCount.current).toBe(1);

      // Update age - should not re-render
      act(() => {
        user.value = { name: 'John', age: 31 };
      });

      expect(renderCount.current).toBe(1);

      // Update name - should re-render
      act(() => {
        user.value = { name: 'Jane', age: 31 };
      });

      expect(result.current).toBe('Jane');
      expect(renderCount.current).toBe(2);
    });
  });
});
