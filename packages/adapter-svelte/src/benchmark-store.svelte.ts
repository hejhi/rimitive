/**
 * Pre-compiled Svelte store for benchmarking
 * This file uses real Svelte 5 runes
 */

import { LatticeStore, createStoreAdapter } from './svelte-adapter.svelte';
import { createLatticeStore } from '@lattice/core';
import type { RuntimeSliceFactory } from '@lattice/core';

// Create stores with different state shapes for benchmarking

// Simple counter store (using deep proxy for comparison)
export function createCounterStore() {
  const state = $state({ count: 0 });
  
  // Manual adapter creation for benchmarking
  const adapter = {
    getState: () => state,
    setState: (updates: any) => Object.assign(state, updates),
    subscribe: () => () => {}
  };
  
  const createSlice = createLatticeStore(adapter);
  
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
  
  const adapter = {
    getState: () => state,
    setState: (updates: any) => Object.assign(state, updates),
    subscribe: () => () => {}
  };
  
  const createSlice = createLatticeStore(adapter);
  
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
  
  const adapter = {
    getState: () => state,
    setState: (updates: any) => Object.assign(state, updates),
    subscribe: () => () => {}
  };
  
  const createSlice = createLatticeStore(adapter);
  
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

// Optimized class-based store using LatticeStore
class CounterStore extends LatticeStore {
  count = $state(0);
}

export function createOptimizedCounterStore() {
  const store = new CounterStore();
  const adapter = createStoreAdapter(store);
  const createSlice = createLatticeStore(adapter);
  
  const createComponent = (createSlice: RuntimeSliceFactory<CounterStore>) => {
    const counter = createSlice(({ get, set }) => ({
      value: () => get().count,
      setValue: (count: number) => set({ count }),
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 })
    }));
    return { counter };
  };
  
  return {
    state: store,
    component: createComponent(createSlice)
  };
}

// Another example using LatticeStore with complex state
class ComplexStore extends LatticeStore {
  name = $state('Test');
  age = $state(25);
  items = $state<string[]>(['a', 'b', 'c']);
  theme = $state('light');
  notifications = $state(true);
  
  // Computed property example
  get userInfo() {
    return `${this.name} (${this.age})`;
  }
}

export function createOptimizedComplexStore() {
  const store = new ComplexStore();
  const adapter = createStoreAdapter(store);
  const createSlice = createLatticeStore(adapter);
  
  const createComponent = (createSlice: RuntimeSliceFactory<ComplexStore>) => {
    const user = createSlice(({ get, set }) => ({
      setAge: (age: number) => set({ age }),
      setName: (name: string) => set({ name }),
      addItem: (item: string) => set({ items: [...get().items, item] }),
      clearItems: () => set({ items: [] }),
      toggleNotifications: () => set({ notifications: !get().notifications }),
      getUserInfo: () => get().userInfo
    }));
    return { user };
  };
  
  return {
    state: store,
    component: createComponent(createSlice)
  };
}