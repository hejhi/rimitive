import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLatticeContext } from './context-hooks';
import { createTestSignalAPI } from '../test-setup';

describe('Lattice Context Hooks', () => {
  describe('useLatticeContext', () => {
    it('should create and manage context lifecycle', () => {
      // For testing, we'll create a mock extension set using the test API
      const testAPI = createTestSignalAPI();
      const mockExtensions = [
        { name: 'signal' as const, impl: testAPI.signal },
        { name: 'computed' as const, impl: testAPI.computed },
        { name: 'effect' as const, impl: testAPI.effect },
        { name: 'batch' as const, impl: testAPI.batch },
      ];

      const { result, unmount } = renderHook(() =>
        useLatticeContext(...mockExtensions)
      );

      // Context should have all impls
      expect(typeof result.current.signal).toBe('function');
      expect(typeof result.current.computed).toBe('function');
      expect(typeof result.current.effect).toBe('function');
      expect(typeof result.current.batch).toBe('function');
      expect(typeof result.current.dispose).toBe('function');

      // Create a signal to verify it works
      const count = result.current.signal(0);
      expect(count()).toBe(0);

      // Spy on dispose to verify cleanup
      const disposeSpy = vi.fn();
      const originalDispose = result.current.dispose.bind(result.current);
      result.current.dispose = () => {
        disposeSpy();
        originalDispose();
      };

      unmount();

      expect(disposeSpy).toHaveBeenCalledOnce();
    });

    it('should only create context once per component instance', () => {
      // For testing, we'll create a mock extension set using the test API
      const testAPI = createTestSignalAPI();
      const mockExtensions = [
        { name: 'signal' as const, impl: testAPI.signal },
        { name: 'computed' as const, impl: testAPI.computed },
        { name: 'effect' as const, impl: testAPI.effect },
        { name: 'batch' as const, impl: testAPI.batch },
      ];

      const { result, rerender } = renderHook(() =>
        useLatticeContext(...mockExtensions)
      );

      const firstContext = result.current;

      // Multiple rerenders should not create new contexts
      rerender();
      rerender();

      expect(result.current).toBe(firstContext);
    });

    it('should allow signal creation and updates', () => {
      // For testing, we'll create a mock extension set using the test API
      const testAPI = createTestSignalAPI();
      const mockExtensions = [
        { name: 'signal' as const, impl: testAPI.signal },
        { name: 'computed' as const, impl: testAPI.computed },
        { name: 'effect' as const, impl: testAPI.effect },
        { name: 'batch' as const, impl: testAPI.batch },
      ];

      const { result } = renderHook(() => useLatticeContext(...mockExtensions));

      const count = result.current.signal(0);
      const doubled = result.current.computed(() => count() * 2);

      expect(count()).toBe(0);
      expect(doubled()).toBe(0);

      act(() => {
        count(10);
      });

      expect(count()).toBe(10);
      expect(doubled()).toBe(20);
    });

    it('should support batch updates', () => {
      // For testing, we'll create a mock extension set using the test API
      const testAPI = createTestSignalAPI();
      const mockExtensions = [
        { name: 'signal' as const, impl: testAPI.signal },
        { name: 'computed' as const, impl: testAPI.computed },
        { name: 'effect' as const, impl: testAPI.effect },
        { name: 'batch' as const, impl: testAPI.batch },
      ];

      const { result } = renderHook(() => useLatticeContext(...mockExtensions));

      const a = result.current.signal(1);
      const b = result.current.signal(2);
      const sum = result.current.computed(() => a() + b());

      let computeCount = 0;
      result.current.effect(() => {
        void sum(); // Track the sum
        computeCount++;
      });

      expect(computeCount).toBe(1);

      act(() => {
        result.current.batch(() => {
          a(10);
          b(20);
        });
      });

      // Should only compute once due to batching
      expect(computeCount).toBe(2);
      expect(sum()).toBe(30);
    });

    it('should work with custom extensions', () => {
      // Create a custom extension
      const counterExtension = {
        name: 'counter' as const,
        impl: (() => {
          let count = 0;
          return {
            increment: () => ++count,
            decrement: () => --count,
            get: () => count,
          };
        })(),
      };

      const { result } = renderHook(() => useLatticeContext(counterExtension));

      // Should have the custom extension impl
      expect(typeof result.current.counter).toBe('object');
      expect(typeof result.current.counter.increment).toBe('function');
      expect(typeof result.current.dispose).toBe('function');

      // Test custom functionality
      expect(result.current.counter.get()).toBe(0);
      act(() => {
        result.current.counter.increment();
        result.current.counter.increment();
      });
      expect(result.current.counter.get()).toBe(2);
    });
  });
});
