import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  createModel,
  createSlice,
  resolve,
  createLatticeStore,
} from '@lattice/core';
import { createStoreAdapter } from './index';

describe('Pinia Adapter', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  it('should work with the new runtime', () => {
    // Define a simple counter component
    const counter = () => {
      const model = createModel<{
        count: number;
        increment: () => void;
        decrement: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      // Actions are simple method selectors
      const actions = createSlice(model, (m) => ({
        increment: m().increment,
        decrement: m().decrement,
      }));

      // Create a base slice for views
      const counterSlice = createSlice(model, (m) => ({
        count: () => m().count,
        isPositive: () => m().count > 0,
        isNegative: () => m().count < 0,
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

      return { model, actions, views };
    };

    // Create the minimal adapter
    const adapter = createStoreAdapter<{
      count: number;
      increment: () => void;
      decrement: () => void;
    }>();

    // Create the store using the runtime
    const store = createLatticeStore(counter, adapter);

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
    const counter = () => {
      const model = createModel<{
        value: number;
        setValue: (v: number) => void;
      }>(({ set }) => ({
        value: 0,
        setValue: (v: number) => set({ value: v }),
      }));

      const actions = createSlice(model, (m) => ({
        setValue: m().setValue,
      }));

      const valueSlice = createSlice(model, (m) => ({
        get: () => m().value,
      }));

      const resolveViews = resolve({ value: valueSlice });
      const views = {
        current: resolveViews(({ value }) => () => ({ value: value.get() })),
      };

      return { model, actions, views };
    };

    const adapter = createStoreAdapter<{
      value: number;
      setValue: (v: number) => void;
    }>();
    const store = createLatticeStore(counter, adapter);

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
    const component = () => {
      const model = createModel<{
        base: number;
        multiply: (factor: number) => void;
      }>(({ set, get }) => ({
        base: 10,
        multiply: (factor: number) => set({ base: get().base * factor }),
      }));

      const actions = createSlice(model, (m) => ({
        multiply: m().multiply,
      }));

      const baseSlice = createSlice(model, (m) => ({
        value: () => m().base,
      }));

      const resolveViews = resolve({ base: baseSlice });

      const views = {
        multiplied: resolveViews(({ base }) => (factor: number) => ({
          result: base.value() * factor,
          label: `${base.value()} × ${factor} = ${base.value() * factor}`,
        })),
      };

      return { model, actions, views };
    };

    const adapter = createStoreAdapter<{
      base: number;
      multiply: (factor: number) => void;
    }>();
    const store = createLatticeStore(component, adapter);

    // Test parameterized view
    const doubled = store.views.multiplied(2) as any; // TODO: Fix type inference
    expect(doubled.result).toBe(20);
    expect(doubled.label).toBe('10 × 2 = 20');

    const tripled = store.views.multiplied(3) as any; // TODO: Fix type inference
    expect(tripled.result).toBe(30);
    expect(tripled.label).toBe('10 × 3 = 30');
  });


  it('should handle multiple instances', () => {
    const component = () => {
      const model = createModel<{
        value: number;
        setValue: (v: number) => void;
      }>(({ set }) => ({
        value: 0,
        setValue: (v: number) => set({ value: v }),
      }));

      const actions = createSlice(model, (m) => ({
        setValue: m().setValue,
      }));

      const valueSlice = createSlice(model, (m) => ({
        get: () => m().value,
      }));

      const resolveViews = resolve({ value: valueSlice });
      const views = {
        current: resolveViews(({ value }) => () => ({ value: value.get() })),
      };

      return { model, actions, views };
    };

    // Create two separate adapters/stores
    const adapter1 = createStoreAdapter<{
      value: number;
      setValue: (v: number) => void;
    }>();
    const store1 = createLatticeStore(component, adapter1);

    const adapter2 = createStoreAdapter<{
      value: number;
      setValue: (v: number) => void;
    }>();
    const store2 = createLatticeStore(component, adapter2);

    // Test initial state
    expect(store1.views.current().value).toBe(0);
    expect(store2.views.current().value).toBe(0);

    // Update store1
    store1.actions.setValue(42);
    expect(store1.views.current().value).toBe(42);
    expect(store2.views.current().value).toBe(0);

    // Update store2
    store2.actions.setValue(100);
    expect(store1.views.current().value).toBe(42);
    expect(store2.views.current().value).toBe(100);
  });
});
