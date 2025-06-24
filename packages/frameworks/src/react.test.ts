import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createStore } from '@lattice/core';
import { useSlice, useSlices } from './react';

describe('React hooks', () => {
  // Create test slices using the new API
  const createTestSlices = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const counterSlice = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        value: () => count(),
        increment: () => set(
          ({ count }) => ({ count: count() + 1 })
        ),
        isEven: () => count() % 2 === 0,
      })
    );

    const userSlice = createSlice(
      (selectors) => ({ name: selectors.name }),
      ({ name }, set) => ({
        name: () => name(),
        setName: (newName: string) => set(
          () => ({ name: newName })
        ),
      })
    );

    const itemsSlice = createSlice(
      (selectors) => ({ items: selectors.items }),
      ({ items }, set) => ({
        all: () => items(),
        add: (item: string) => set(
          ({ items }) => ({ items: [...items(), item] })
        ),
        count: () => items().length,
      })
    );

    return { counterSlice, userSlice, itemsSlice };
  };

  describe('useSlice', () => {
    it('should return entire slice when no selector provided', () => {
      const { counterSlice } = createTestSlices();

      const { result } = renderHook(() => useSlice(counterSlice));

      expect(result.current.value()).toBe(0);
      expect(result.current.isEven()).toBe(true);
      
      act(() => {
        result.current.increment();
      });

      expect(result.current.value()).toBe(1);
      expect(result.current.isEven()).toBe(false);
    });

    it('should return selected value when selector provided', () => {
      const { counterSlice } = createTestSlices();

      const { result } = renderHook(() => 
        useSlice(counterSlice, c => c.value())
      );

      expect(result.current).toBe(0);
    });

    it('should re-render only when selected value changes', () => {
      const { counterSlice, userSlice } = createTestSlices();
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useSlice(counterSlice, c => c.value());
      });

      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);

      // Change different slice - should not re-render
      act(() => {
        userSlice().setName('alice');
      });

      expect(renderCount).toBe(1);

      // Change selected value - should re-render
      act(() => {
        counterSlice().increment();
      });

      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
    });

    it('should support complex selectors', () => {
      const { itemsSlice } = createTestSlices();

      const { result } = renderHook(() =>
        useSlice(itemsSlice, items => ({
          count: items.count(),
          isEmpty: items.all().length === 0,
        }))
      );

      expect(result.current).toEqual({ count: 0, isEmpty: true });

      act(() => {
        itemsSlice().add('apple');
      });

      expect(result.current).toEqual({ count: 1, isEmpty: false });
    });
  });

  describe('useSlices', () => {
    it('should handle multiple slices with selectors', () => {
      const { counterSlice, userSlice, itemsSlice } = createTestSlices();

      const { result } = renderHook(() =>
        useSlices({
          count: [counterSlice, c => c.value()],
          userName: [userSlice, u => u.name()],
          itemCount: [itemsSlice, i => i.count()],
        })
      );

      expect(result.current).toEqual({
        count: 0,
        userName: 'test',
        itemCount: 0,
      });

      act(() => {
        counterSlice().increment();
        userSlice().setName('alice');
        itemsSlice().add('apple');
      });

      expect(result.current).toEqual({
        count: 1,
        userName: 'alice',
        itemCount: 1,
      });
    });

    it('should handle entire slice selection', () => {
      const { counterSlice } = createTestSlices();

      const { result } = renderHook(() =>
        useSlices({
          counter: [counterSlice, c => c],
        })
      );

      expect(result.current.counter.value()).toBe(0);
      
      act(() => {
        result.current.counter.increment();
      });

      expect(result.current.counter.value()).toBe(1);
    });

    it('should optimize re-renders with shallow equality', () => {
      const { counterSlice, userSlice } = createTestSlices();
      let renderCount = 0;

      renderHook(() => {
        renderCount++;
        return useSlices({
          count: [counterSlice, c => c.value()],
        });
      });

      expect(renderCount).toBe(1);

      // Change unrelated slice - should not re-render
      act(() => {
        userSlice().setName('alice');
      });

      expect(renderCount).toBe(1);

      // Change selected value - should re-render
      act(() => {
        counterSlice().increment();
      });

      expect(renderCount).toBe(2);
    });
  });
});