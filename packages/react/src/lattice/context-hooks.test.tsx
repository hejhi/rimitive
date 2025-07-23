import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLatticeContext } from './context-hooks';
import { coreExtensions } from '@lattice/signals';

describe('Lattice Context Hooks', () => {
  describe('useLatticeContext', () => {
    it('should create and manage context lifecycle', () => {
      const { result, unmount } = renderHook(() =>
        useLatticeContext(...coreExtensions)
      );

      // Context should have all methods
      expect(typeof result.current.signal).toBe('function');
      expect(typeof result.current.computed).toBe('function');
      expect(typeof result.current.effect).toBe('function');
      expect(typeof result.current.batch).toBe('function');
      expect(typeof result.current.dispose).toBe('function');

      // Create a signal to verify it works
      const count = result.current.signal(0);
      expect(count.value).toBe(0);

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
      const { result, rerender } = renderHook(() =>
        useLatticeContext(...coreExtensions)
      );

      const firstContext = result.current;

      // Multiple rerenders should not create new contexts
      rerender();
      rerender();

      expect(result.current).toBe(firstContext);
    });

    it('should allow signal creation and updates', () => {
      const { result } = renderHook(() =>
        useLatticeContext(...coreExtensions)
      );

      const count = result.current.signal(0);
      const doubled = result.current.computed(() => count.value * 2);

      expect(count.value).toBe(0);
      expect(doubled.value).toBe(0);

      act(() => {
        count.value = 10;
      });

      expect(count.value).toBe(10);
      expect(doubled.value).toBe(20);
    });

    it('should support batch updates', () => {
      const { result } = renderHook(() =>
        useLatticeContext(...coreExtensions)
      );

      const a = result.current.signal(1);
      const b = result.current.signal(2);
      const sum = result.current.computed(() => a.value + b.value);

      let computeCount = 0;
      result.current.effect(() => {
        void sum.value; // Track the sum
        computeCount++;
      });

      expect(computeCount).toBe(1);

      act(() => {
        result.current.batch(() => {
          a.value = 10;
          b.value = 20;
        });
      });

      // Should only compute once due to batching
      expect(computeCount).toBe(2);
      expect(sum.value).toBe(30);
    });

    it('should work with custom extensions', () => {
      // Create a custom extension
      const counterExtension = {
        name: 'counter' as const,
        method: (() => {
          let count = 0;
          return {
            increment: () => ++count,
            decrement: () => --count,
            get: () => count,
          };
        })(),
      };

      const { result } = renderHook(() =>
        useLatticeContext(counterExtension)
      );

      // Should have the custom extension method
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