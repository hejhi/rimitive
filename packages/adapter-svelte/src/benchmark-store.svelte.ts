/**
 * Pre-compiled Svelte store for benchmarking
 * This file uses real Svelte 5 runes with the class-based approach
 */

import { LatticeStore, createSliceFactory } from './svelte-adapter.svelte';

// Simple counter store using class-based approach
class CounterStore extends LatticeStore {
  count = $state(0);
}

export function createCounterStore() {
  const store = new CounterStore();
  const createSlice = createSliceFactory(store);

  const counter = createSlice(({ get, set }) => ({
    value: () => get().count,
    setValue: (count: number) => set({ count }),
    increment: () => set({ count: get().count + 1 }),
    decrement: () => set({ count: get().count - 1 }),
  }));

  return {
    state: store,
    component: { counter },
  };
}

class ComplexStore extends LatticeStore {
  user = $state({ name: 'Test', age: 25 });
  items = $state<string[]>(['a', 'b', 'c']);
  settings = $state({ theme: 'light', notifications: true });
}

export function createComplexStore() {
  const store = new ComplexStore();
  const createSlice = createSliceFactory(store);

  const user = createSlice(({ get, set }) => ({
    setAge: (age: number) => set({ user: { ...get().user, age } }),
    setName: (name: string) => set({ user: { ...get().user, name } }),
    addItem: (item: string) => set({ items: [...get().items, item] }),
    clearItems: () => set({ items: [] }),
    toggleNotifications: () =>
      set({
        settings: {
          ...get().settings,
          notifications: !get().settings.notifications,
        },
      }),
  }));

  return {
    state: store,
    component: { user },
  };
}

class BatchStore extends LatticeStore {
  count = $state(0);
  total = $state(0);
  items = $state<number[]>([]);
}

export function createBatchStore() {
  const store = new BatchStore();
  const createSlice = createSliceFactory(store);

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
        items: [...current.items, ...newItems],
      });
    },
    reset: () => set({ count: 0, total: 0, items: [] }),
  }));

  return {
    state: store,
    component: { batch },
  };
}

// Direct state access for comparison (using class approach)
class DirectAccessStore extends LatticeStore {
  count = $state(0);
}

export function createDirectAccessStore() {
  const store = new DirectAccessStore();

  return {
    state: store,
    // Direct mutations for comparison
    increment: () => store.count++,
    decrement: () => store.count--,
    setValue: (value: number) => (store.count = value),
    getValue: () => store.count,
  };
}
