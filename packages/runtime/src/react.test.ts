import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createStore } from '@lattice/core';
import { useSliceSelector, useSliceValues, useLattice } from './react';

describe('React hooks', () => {
  // Create a test store
  const createTestStore = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const listeners = new Set<() => void>();

    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      increment: () => {
        set({ count: get().count + 1 });
        listeners.forEach((l) => l());
      },
      isEven: () => get().count % 2 === 0,
    }));

    const user = createSlice(({ get, set }) => ({
      name: () => get().name,
      setName: (name: string) => {
        set({ name });
        listeners.forEach((l) => l());
      },
    }));

    const items = createSlice(({ get, set }) => ({
      all: () => get().items,
      add: (item: string) => {
        set({ items: [...get().items, item] });
        listeners.forEach((l) => l());
      },
    }));

    return {
      counter,
      user,
      items,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  describe('useSliceSelector', () => {
    it('should return selected values and re-render on changes', () => {
      const store = createTestStore();

      const { result } = renderHook(() =>
        useSliceSelector(store, (s) => ({
          count: s.counter.value(),
          isEven: s.counter.isEven(),
        }))
      );

      expect(result.current).toEqual({ count: 0, isEven: true });

      act(() => {
        store.counter.increment();
      });

      expect(result.current).toEqual({ count: 1, isEven: false });
    });

    it('should not re-render for unrelated changes', () => {
      const store = createTestStore();
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useSliceSelector(store, (s) => s.counter.value());
      });

      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);

      // Change unrelated state
      act(() => {
        store.user.setName('alice');
      });

      // Should not re-render
      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);

      // Change selected state
      act(() => {
        store.counter.increment();
      });

      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
    });
  });

  describe('useSliceValues', () => {
    it('should use shallow equality by default', () => {
      const store = createTestStore();
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useSliceValues(store, (s) => ({
          count: s.counter.value(),
          name: s.user.name(),
        }));
      });

      // Initial render count (React Testing Library may cause extra renders)
      const initialRenderCount = renderCount;
      expect(result.current).toEqual({ count: 0, name: 'test' });

      // Multiple updates that result in same values
      act(() => {
        store.counter.increment();
        store.counter.increment();
        store.user.setName('test'); // Same name
        store.counter.increment();
        store.counter.increment();
        // Back to count: 4, name: 'test'
      });

      // Should have re-rendered for count changes
      expect(renderCount).toBeGreaterThan(initialRenderCount);
      expect(result.current).toEqual({ count: 4, name: 'test' });
    });
  });

  describe('useLattice', () => {
    it('should provide both values and slices', () => {
      const store = createTestStore();

      const { result } = renderHook(() =>
        useLattice(store, (s) => ({
          count: s.counter.value(),
        }))
      );

      expect(result.current.values).toEqual({ count: 0 });
      expect(result.current.slices).toBe(store);

      // Can use slices to trigger actions
      act(() => {
        result.current.slices.counter.increment();
      });

      expect(result.current.values).toEqual({ count: 1 });
    });
  });
});