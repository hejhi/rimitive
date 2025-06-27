import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, withState, createStore } from '@lattice/core';
import { useStore, useSignal, useAutoStore } from './react';

describe('React hooks', () => {
  // Create test components using the new API
  const createTestStores = () => {
    const Counter = createComponent(
      withState(() => ({ count: 0 })),
      ({ store, computed, set }) => ({
        value: store.count,
        increment: () => set({ count: store.count() + 1 }),
        isEven: computed(() => store.count() % 2 === 0),
      })
    );

    const User = createComponent(
      withState(() => ({ name: 'test' })),
      ({ store, set }) => ({
        name: store.name,
        setName: (newName: string) => set({ name: newName }),
      })
    );

    const Items = createComponent(
      withState(() => ({ items: [] as string[] })),
      ({ store, computed, set }) => ({
        all: store.items,
        add: (item: string) => set({ items: [...store.items(), item] }),
        count: computed(() => store.items().length),
      })
    );

    return { 
      counterStore: createStore(Counter, { count: 0 }),
      userStore: createStore(User, { name: 'test' }),
      itemsStore: createStore(Items, { items: [] })
    };
  };

  describe('useStore', () => {
    it('should return store with signals accessible directly', () => {
      const { counterStore } = createTestStores();

      const { result } = renderHook(() => useStore(counterStore));

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
      const { counterStore } = createTestStores();

      const { result } = renderHook(() => useSignal(counterStore.value));

      expect(result.current).toBe(0);
      
      act(() => {
        counterStore.increment();
      });

      expect(result.current).toBe(1);
    });

    it('should re-render only when signal changes', () => {
      const { counterStore, userStore } = createTestStores();
      
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useSignal(counterStore.value);
      });

      expect(renderCount).toBe(1);
      expect(result.current).toBe(0);
      
      act(() => {
        counterStore.increment();
      });

      expect(renderCount).toBe(2);
      expect(result.current).toBe(1);
      
      // Changing unrelated signal should not re-render
      act(() => {
        userStore.setName('new name');
      });
      
      expect(renderCount).toBe(2); // No new render
      expect(result.current).toBe(1);
    });

    it('should work with computed values', () => {
      const { counterStore } = createTestStores();

      const { result } = renderHook(() => useSignal(counterStore.isEven));

      expect(result.current).toBe(true);
      
      act(() => {
        counterStore.increment();
      });

      expect(result.current).toBe(false);
      
      act(() => {
        counterStore.increment();
      });

      expect(result.current).toBe(true);
    });
  });

  describe('useAutoStore', () => {
    it('should re-render when any signal in store changes', () => {
      const { itemsStore } = createTestStores();
      
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useAutoStore(itemsStore);
      });

      expect(renderCount).toBe(1);
      expect(result.current.count()).toBe(0);
      expect(result.current.all()).toEqual([]);
      
      act(() => {
        result.current.add('item1');
      });

      expect(renderCount).toBe(2);
      expect(result.current.count()).toBe(1);
      expect(result.current.all()).toEqual(['item1']);
      
      act(() => {
        result.current.add('item2');
      });

      expect(renderCount).toBe(3);
      expect(result.current.count()).toBe(2);
      expect(result.current.all()).toEqual(['item1', 'item2']);
    });
  });
});