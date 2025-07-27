import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import {
  useSubscribe,
  useSignal,
  useSelector,
} from './hooks';
import { SignalProvider } from './context';
import { createTestSignalAPI } from '../test-setup';

describe('Signal Hooks', () => {
  // Create a wrapper that provides the signal context
  const createWrapper = (api: ReturnType<typeof createTestSignalAPI>) => {
    return ({ children }: { children: ReactNode }) => 
      React.createElement(SignalProvider, { api, children });
  };

  describe('useSubscribe', () => {
    it('should return current signal value', () => {
      const api = createTestSignalAPI();
      const count = api.signal(0);
      
      const { result } = renderHook(
        () => useSubscribe(count),
        { wrapper: createWrapper(api) }
      );

      expect(result.current).toBe(0);
    });

    it('should re-render when signal changes', () => {
      const api = createTestSignalAPI();
      const count = api.signal(0);
      
      const { result } = renderHook(
        () => useSubscribe(count),
        { wrapper: createWrapper(api) }
      );

      expect(result.current).toBe(0);

      act(() => {
        count.value = 1;
      });

      expect(result.current).toBe(1);
    });

    it('should work with computed values', () => {
      const api = createTestSignalAPI();
      const count = api.signal(5);
      const doubled = api.computed(() => count.value * 2);
      
      const { result } = renderHook(
        () => useSubscribe(doubled),
        { wrapper: createWrapper(api) }
      );

      expect(result.current).toBe(10);

      act(() => {
        count.value = 10;
      });

      expect(result.current).toBe(20);
    });

    it('should work with computed values derived from signals', () => {
      const api = createTestSignalAPI();
      const user = api.signal({ name: 'John', age: 30 });
      const name = api.computed(() => user.value.name);
      
      const { result } = renderHook(
        () => useSubscribe(name),
        { wrapper: createWrapper(api) }
      );

      expect(result.current).toBe('John');

      act(() => {
        user.value = { name: 'Jane', age: 25 };
      });

      expect(result.current).toBe('Jane');
    });
  });

  describe('useSignal', () => {
    it('should create a local signal with initial value', () => {
      const api = createTestSignalAPI();
      
      const { result } = renderHook(
        () => useSignal(42),
        { wrapper: createWrapper(api) }
      );
      
      const [value] = result.current;
      expect(value).toBe(42);
    });

    it('should update value with setter', () => {
      const api = createTestSignalAPI();
      
      const { result } = renderHook(
        () => useSignal(0),
        { wrapper: createWrapper(api) }
      );

      expect(result.current[0]).toBe(0);

      act(() => {
        result.current[1](10);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support function updates', () => {
      const api = createTestSignalAPI();
      
      const { result } = renderHook(
        () => useSignal(5),
        { wrapper: createWrapper(api) }
      );

      act(() => {
        result.current[1]((prev) => prev * 2);
      });

      expect(result.current[0]).toBe(10);
    });

    it('should support lazy initialization', () => {
      const api = createTestSignalAPI();
      const init = vi.fn(() => 42);
      
      const { result } = renderHook(
        () => useSignal(init),
        { wrapper: createWrapper(api) }
      );

      expect(result.current[0]).toBe(42);
      expect(init).toHaveBeenCalledOnce();
    });
  });

  describe('useSelector', () => {
    it('should select specific values from signal', () => {
      const api = createTestSignalAPI();
      const user = api.signal({ name: 'John', age: 30, email: 'john@example.com' });
      
      const { result } = renderHook(
        () => useSelector(user, (u) => u.name),
        { wrapper: createWrapper(api) }
      );

      expect(result.current).toBe('John');
    });

    it('computed should update when signal changes', () => {
      const api = createTestSignalAPI();
      const user = api.signal({ name: 'John', age: 30 });
      const nameComputed = api.computed(() => user.value.name);
      
      expect(nameComputed.value).toBe('John');
      
      user.value = { name: 'Jane', age: 30 };
      
      expect(nameComputed.value).toBe('Jane');
    });

    it('should only re-render when selected value changes', () => {
      const api = createTestSignalAPI();
      const user = api.signal({ name: 'John', age: 30 });
      const renderCount = { current: 0 };

      const { result } = renderHook(
        () => {
          renderCount.current++;
          return useSelector(user, (u) => u.name);
        },
        { wrapper: createWrapper(api) }
      );

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