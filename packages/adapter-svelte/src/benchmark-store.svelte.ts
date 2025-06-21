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

  const counter = createSlice(
    (selectors) => ({ count: selectors.count }),
    ({ count }, set) => ({
      value: () => count(),
      setValue: (value: number) => set(
        (selectors) => ({ count: selectors.count }),
        () => ({ count: value })
      ),
      increment: () => set(
        (selectors) => ({ count: selectors.count }),
        ({ count }) => ({ count: count() + 1 })
      ),
      decrement: () => set(
        (selectors) => ({ count: selectors.count }),
        ({ count }) => ({ count: count() - 1 })
      ),
    })
  );

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

  const user = createSlice(
    (selectors) => ({ 
      user: selectors.user,
      items: selectors.items,
      settings: selectors.settings
    }),
    (_deps, set) => ({
      setAge: (age: number) => set(
        (selectors) => ({ user: selectors.user }),
        ({ user }) => ({ user: { ...user(), age } })
      ),
      setName: (name: string) => set(
        (selectors) => ({ user: selectors.user }),
        ({ user }) => ({ user: { ...user(), name } })
      ),
      addItem: (item: string) => set(
        (selectors) => ({ items: selectors.items }),
        ({ items }) => ({ items: [...items(), item] })
      ),
      clearItems: () => set(
        (_selectors) => ({}),
        () => ({ items: [] })
      ),
      toggleNotifications: () => set(
        (selectors) => ({ settings: selectors.settings }),
        ({ settings }) => ({ 
          settings: {
            ...settings(),
            notifications: !settings().notifications,
          },
        })
      ),
    })
  );

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

  const batch = createSlice(
    (selectors) => ({
      count: selectors.count,
      total: selectors.total,
      items: selectors.items
    }),
    ({ count, total, items }, set) => ({
      processBatch: (start: number, size: number) => {
        const currentItems = items();
        const currentTotal = total();
        const currentCount = count();
        const newItems: number[] = [];
        let newTotal = currentTotal;

        for (let i = 0; i < size; i++) {
          const value = start + i;
          newItems.push(value);
          newTotal += value;
        }

        set(
          (selectors) => ({ 
            count: selectors.count, 
            total: selectors.total, 
            items: selectors.items 
          }),
          () => ({
            count: currentCount + size,
            total: newTotal,
            items: [...currentItems, ...newItems],
          })
        );
      },
      reset: () => set(
        (selectors) => ({ 
          count: selectors.count, 
          total: selectors.total, 
          items: selectors.items 
        }),
        () => ({ count: 0, total: 0, items: [] })
      ),
    })
  );

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
