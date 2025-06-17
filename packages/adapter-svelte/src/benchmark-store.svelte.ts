/**
 * Pre-compiled Svelte store for benchmarking
 * This file uses real Svelte 5 runes
 */

import { createStore } from './svelte-adapter';
import type { RuntimeSliceFactory } from '@lattice/core';

// Create stores with different state shapes for benchmarking

// Simple counter store
export function createCounterStore() {
  const state = $state({ count: 0 });
  const createSlice = createStore(state);
  
  const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      setValue: (count: number) => set({ count }),
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 })
    }));
    return { counter };
  };
  
  return {
    state,
    component: createComponent(createSlice)
  };
}

// Complex state store
interface ComplexState {
  user: { name: string; age: number };
  items: string[];
  settings: { theme: string; notifications: boolean };
}

export function createComplexStore() {
  const state = $state<ComplexState>({
    user: { name: 'Test', age: 25 },
    items: ['a', 'b', 'c'],
    settings: { theme: 'light', notifications: true }
  });
  
  const createSlice = createStore(state);
  
  const createComponent = (createSlice: RuntimeSliceFactory<ComplexState>) => {
    const user = createSlice(({ get, set }) => ({
      setAge: (age: number) => set({ user: { ...get().user, age } }),
      setName: (name: string) => set({ user: { ...get().user, name } }),
      addItem: (item: string) => set({ items: [...get().items, item] }),
      clearItems: () => set({ items: [] }),
      toggleNotifications: () => set({ 
        settings: { ...get().settings, notifications: !get().settings.notifications } 
      })
    }));
    return { user };
  };
  
  return {
    state,
    component: createComponent(createSlice)
  };
}

// Batch operations store
interface BatchState {
  count: number;
  total: number;
  items: number[];
}

export function createBatchStore() {
  const state = $state<BatchState>({ 
    count: 0, 
    total: 0, 
    items: [] 
  });
  
  const createSlice = createStore(state);
  
  const createComponent = (createSlice: RuntimeSliceFactory<BatchState>) => {
    const batch = createSlice(({ get, set }) => ({
      processBatch: (start: number, size: number) => {
        const current = get();
        const newItems = [];
        let newTotal = current.total;
        
        for (let i = 0; i < size; i++) {
          const value = start + i;
          newItems.push(value);
          newTotal += value;
        }
        
        set({
          count: current.count + size,
          total: newTotal,
          items: [...current.items, ...newItems]
        });
      },
      reset: () => set({ count: 0, total: 0, items: [] })
    }));
    return { batch };
  };
  
  return {
    state,
    component: createComponent(createSlice)
  };
}

// Direct state access for comparison
export function createDirectAccessStore() {
  const state = $state({ count: 0 });
  
  return {
    state,
    // Direct mutations for comparison
    increment: () => state.count++,
    decrement: () => state.count--,
    setValue: (value: number) => state.count = value,
    getValue: () => state.count
  };
}

// Optimized class-based store for better write performance
class CounterState {
  count = $state(0);
}

export function createOptimizedCounterStore() {
  const state = new CounterState();
  const createSlice = createStore(state);
  
  const createComponent = (createSlice: RuntimeSliceFactory<CounterState>) => {
    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      setValue: (count: number) => set({ count }),
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 })
    }));
    return { counter };
  };
  
  return {
    state,
    component: createComponent(createSlice)
  };
}