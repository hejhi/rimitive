import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createStore, computed } from '@lattice/core';
import { useSlice, useSignal } from './react';

describe('React hooks', () => {
  // Create test slices using the new API
  const createTestSlices = () => {
    const createSlice = createStore({
      count: 0,
      name: 'test',
      items: [] as string[],
    });

    const counterSlice = createSlice(({ count }) => ({
      value: count, // count is already a signal
      increment: () => count(count() + 1),
      isEven: computed(() => count() % 2 === 0),
    }));

    const userSlice = createSlice(({ name }) => ({
      name, // name is already a signal
      setName: (newName: string) => name(newName),
    }));

    const itemsSlice = createSlice(({ items }) => ({
      all: items, // items is already a signal
      add: (item: string) => items([...items(), item]),
      count: computed(() => items().length),
    }));

    return { counterSlice, userSlice, itemsSlice };
  };

  describe('useSlice', () => {
    it('should return slice with signals accessible directly', () => {
      const { counterSlice } = createTestSlices();

      const { result } = renderHook(() => useSlice(counterSlice));

      // Signals are accessed by calling them
      expect(result.current.value()).toBe(0);
      expect(result.current.isEven()).toBe(true);
      
      act(() => {
        result.current.increment();
      });

      expect(result.current.value()).toBe(1);
      expect(result.current.isEven()).toBe(false);
    });
  });

  describe('useSignal', () => {
    it('should subscribe to signal and return current value', () => {
      const { counterSlice } = createTestSlices();
      const slice = counterSlice();

      const { result } = renderHook(() => useSignal(slice.value));

      expect(result.current).toBe(0);
      
      act(() => {
        slice.increment();
      });

      expect(result.current).toBe(1);
    });

    it('should re-render only when signal changes', () => {
      const { counterSlice, userSlice } = createTestSlices();
      const counter = counterSlice();
      const user = userSlice();
      
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useSignal(counter.value);
      });

      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);
      
      act(() => {
        counter.increment();
      });

      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);

      // Changing unrelated signal should not re-render
      act(() => {
        user.setName('alice');
      });

      expect(renderCount).toBe(2); // No additional render
      expect(result.current).toBe(1);
    });

    it('should work with computed signals', () => {
      const { counterSlice } = createTestSlices();
      const slice = counterSlice();

      const { result } = renderHook(() => useSignal(slice.isEven));

      expect(result.current).toBe(true);
      
      act(() => {
        slice.increment();
      });

      expect(result.current).toBe(false);
    });
  });
});