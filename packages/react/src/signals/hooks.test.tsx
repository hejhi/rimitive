import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { useSubscribe, useSignal, useSelector } from './hooks';
import { SignalProvider } from './context';
import { createTestSignalAPI } from '../test-setup';

describe('Signal Hooks', () => {
  // Create a wrapper that provides the signal context
  const createWrapper = (svc: ReturnType<typeof createTestSignalAPI>) => {
    return ({ children }: { children: ReactNode }) =>
      React.createElement(SignalProvider, { svc, children });
  };

  describe('useSubscribe', () => {
    it('should return current signal value', () => {
      const svc = createTestSignalAPI();
      const count = svc.signal(0);

      const { result } = renderHook(() => useSubscribe(count), {
        wrapper: createWrapper(svc),
      });

      expect(result.current).toBe(0);
    });

    it('should re-render when signal changes', () => {
      const svc = createTestSignalAPI();
      const count = svc.signal(0);

      const { result } = renderHook(() => useSubscribe(count), {
        wrapper: createWrapper(svc),
      });

      expect(result.current).toBe(0);

      act(() => {
        count(1);
      });

      expect(result.current).toBe(1);
    });

    it('should work with computed values', () => {
      const svc = createTestSignalAPI();
      const count = svc.signal(5);
      const doubled = svc.computed(() => count() * 2);

      const { result } = renderHook(() => useSubscribe(doubled), {
        wrapper: createWrapper(svc),
      });

      expect(result.current).toBe(10);

      act(() => {
        count(10);
      });

      expect(result.current).toBe(20);
    });

    it('should work with computed values derived from signals', () => {
      const svc = createTestSignalAPI();
      const user = svc.signal({ name: 'John', age: 30 });
      const name = svc.computed(() => user().name);

      const { result } = renderHook(() => useSubscribe(name), {
        wrapper: createWrapper(svc),
      });

      expect(result.current).toBe('John');

      act(() => {
        user({ name: 'Jane', age: 25 });
      });

      expect(result.current).toBe('Jane');
    });
  });

  describe('useSignal', () => {
    it('should create a local signal with initial value', () => {
      const svc = createTestSignalAPI();

      const { result } = renderHook(() => useSignal(42), {
        wrapper: createWrapper(svc),
      });

      const [value] = result.current;
      expect(value).toBe(42);
    });

    it('should update value with setter', () => {
      const svc = createTestSignalAPI();

      const { result } = renderHook(() => useSignal(0), {
        wrapper: createWrapper(svc),
      });

      expect(result.current[0]).toBe(0);

      act(() => {
        result.current[1](10);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support function updates', () => {
      const svc = createTestSignalAPI();

      const { result } = renderHook(() => useSignal(5), {
        wrapper: createWrapper(svc),
      });

      act(() => {
        result.current[1]((prev) => prev * 2);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support lazy initialization', () => {
      const svc = createTestSignalAPI();
      const init = vi.fn(() => 42);

      const { result } = renderHook(() => useSignal(init), {
        wrapper: createWrapper(svc),
      });

      expect(result.current[0]).toBe(42);
      expect(init).toHaveBeenCalledOnce();
    });
  });

  describe('useSelector', () => {
    it('should select specific values from signal', () => {
      const svc = createTestSignalAPI();
      const user = svc.signal({
        name: 'John',
        age: 30,
        email: 'john@example.com',
      });

      const { result } = renderHook(
        () =>
          useSelector(
            user,
            (u: { name: string; age: number; email: string }) => u.name
          ),
        { wrapper: createWrapper(svc) }
      );

      expect(result.current).toBe('John');
    });

    it('computed should update when signal changes', () => {
      const svc = createTestSignalAPI();
      const user = svc.signal({ name: 'John', age: 30 });
      const nameComputed = svc.computed(() => user().name);

      expect(nameComputed()).toBe('John');

      user({ name: 'Jane', age: 30 });

      expect(nameComputed()).toBe('Jane');
    });

    it('should only re-render when selected value changes', () => {
      const svc = createTestSignalAPI();
      const user = svc.signal({ name: 'John', age: 30 });
      const renderCount = { current: 0 };

      const { result } = renderHook(
        () => {
          renderCount.current++;
          return useSelector(
            user,
            (u: { name: string; age: number }) => u.name
          );
        },
        { wrapper: createWrapper(svc) }
      );

      expect(result.current).toBe('John');
      expect(renderCount.current).toBe(1);

      // Update age - should not re-render
      act(() => {
        user({ name: 'John', age: 31 });
      });

      expect(renderCount.current).toBe(1);

      // Update name - should re-render
      act(() => {
        user({ name: 'Jane', age: 31 });
      });

      expect(result.current).toBe('Jane');
      expect(renderCount.current).toBe(2);
    });
  });
});
