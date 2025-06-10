import { describe, it, expect } from 'vitest';
import type { CreateStore } from '@lattice/core';
import {
  compose,
  resolve,
  createLatticeStore,
} from '@lattice/core';
import { createStoreAdapter } from '.';

describe('Minimal Zustand Adapter', () => {
  it('should work with the runtime', () => {
    // Define a simple counter component
    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ count: 0 });

      // Actions slice
      const actions = createSlice(({ get, set }) => ({
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      // Create a counter slice for views
      const counterSlice = createSlice(({ get }) => ({
        count: () => get().count,
        isPositive: () => get().count > 0,
        isNegative: () => get().count < 0,
      }));

      // Views use resolve for UI-ready data
      const resolveViews = resolve({ counter: counterSlice });

      const views = {
        display: resolveViews(({ counter }) => {
          return () => {
            return {
              value: counter.count(),
              label: `Count: ${counter.count()}`,
              positive: counter.isPositive(),
              negative: counter.isNegative(),
            };
          };
        }),
      };

      return { actions, views, getState: () => createSlice(({ get }) => get()) };
    };

    // Create the minimal adapter
    const adapter = createStoreAdapter<{ count: number }>();

    // Create the store using the runtime
    const store = createLatticeStore(createApp, adapter);

    // Test initial state
    expect(store.getState().count).toBe(0);

    // Test view - views are always functions
    const view = store.views.display();
    expect(view.value).toBe(0);
    expect(view.label).toBe('Count: 0');
    expect(view.positive).toBe(false);
    expect(view.negative).toBe(false);

    // Test actions
    store.actions.increment();

    // Test updated view
    const updatedView = store.views.display();
    expect(updatedView.value).toBe(1);
    expect(updatedView.label).toBe('Count: 1');
    expect(updatedView.positive).toBe(true);
    expect(updatedView.negative).toBe(false);

    // Test decrement
    store.actions.decrement();
    store.actions.decrement();

    const finalView = store.views.display();
    expect(finalView.value).toBe(-1);
    expect(finalView.negative).toBe(true);
  });

  it('should support subscriptions', () => {
    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ value: 0 });

      const actions = createSlice(({ get, set }) => ({
        setValue: (v: number) => set({ value: v }),
      }));

      const valueSlice = createSlice(({ get }) => ({
        get: () => get().value,
      }));

      const resolveViews = resolve({ value: valueSlice });
      const views = {
        current: resolveViews(({ value }) => () => ({ value: value.get() })),
      };

      return { actions, views };
    };

    const adapter = createStoreAdapter<{ value: number }>();
    const store = createLatticeStore(createApp, adapter);

    // Track subscription calls
    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    // Initial state
    expect(store.views.current().value).toBe(0);
    expect(callCount).toBe(0);

    // Update state
    store.actions.setValue(42);
    expect(store.views.current().value).toBe(42);
    expect(callCount).toBe(1);

    // Another update
    store.actions.setValue(100);
    expect(store.views.current().value).toBe(100);
    expect(callCount).toBe(2);

    // Unsubscribe
    unsubscribe();
    store.actions.setValue(200);
    expect(callCount).toBe(2); // No more calls
  });

  it('should handle parameterized views', () => {
    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ base: 10 });

      const actions = createSlice(({ get, set }) => ({
        multiply: (factor: number) => set({ base: get().base * factor }),
      }));

      const baseSlice = createSlice(({ get }) => ({
        value: () => get().base,
      }));

      const resolveViews = resolve({ base: baseSlice });

      const views = {
        multiplied: resolveViews(({ base }) => (factor: number) => ({
          result: base.value() * factor,
          label: `${base.value()} × ${factor} = ${base.value() * factor}`,
        })),
      };

      return { actions, views };
    };

    const adapter = createStoreAdapter<{ base: number }>();
    const store = createLatticeStore(createApp, adapter);

    // Test parameterized view
    const doubled = store.views.multiplied(2);
    expect(doubled.result).toBe(20);
    expect(doubled.label).toBe('10 × 2 = 20');

    const tripled = store.views.multiplied(3);
    expect(tripled.result).toBe(30);
    expect(tripled.label).toBe('10 × 3 = 30');
  });
});
