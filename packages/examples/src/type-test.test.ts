import { describe, it, expect } from 'vitest';
import { createComponent, createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';

describe('Type inference test', () => {
  it('should infer types correctly for simple component', () => {
    // Create the simplest possible component
    const simpleCounter = createComponent(() => {
      const model = createModel(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      }));

      const countView = createSlice(model, (m) => ({
        value: m.count
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment
      }));

      return {
        model,
        actions,
        views: {
          count: countView
        }
      };
    });

    // Create zustand adapter
    const store = createZustandAdapter(simpleCounter);

    // Test that we can access properties
    expect(store).toBeDefined();
    expect(store.actions).toBeDefined();
    expect(store.views).toBeDefined();
    expect(store.subscribe).toBeDefined();
    expect(typeof store.subscribe).toBe('function');
    
    // Test views access
    expect(store.views).toBeDefined();
    expect(store.views.count).toBeDefined();
    expect(typeof store.views.count).toBe('function');
    
    // Test view execution
    const viewResult = store.views.count();
    expect(viewResult).toBeDefined();
    expect(viewResult.value).toBe(0);
    
    // Test actions
    expect(store.actions.increment).toBeDefined();
    expect(typeof store.actions.increment).toBe('function');
    
    // Test mutation through actions
    store.actions.increment();
    
    // Test view reflects new state
    const newViewResult = store.views.count();
    expect(newViewResult.value).toBe(1);
  });

  it('should handle complex component with actions', () => {
    const complexCounter = createComponent(() => {
      const model = createModel(({ set, get }) => ({
        count: 0,
        step: 1,
        increment: () => set({ count: get().count + get().step }),
        decrement: () => set({ count: get().count - get().step }),
        setStep: (step: number) => set({ step })
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
        decrement: m.decrement,
        setStep: m.setStep
      }));

      const displayView = createSlice(model, (m) => ({
        count: m.count,
        step: m.step
      }));

      return {
        model,
        actions,
        views: {
          display: displayView
        }
      };
    });

    const store = createZustandAdapter(complexCounter);

    // Test actions access
    expect(store.actions).toBeDefined();
    expect(store.actions.increment).toBeDefined();
    expect(typeof store.actions.increment).toBe('function');
    
    // Test action execution and view updates
    const initialView = store.views.display();
    expect(initialView.count).toBe(0);
    expect(initialView.step).toBe(1);
    
    store.actions.increment();
    const view1 = store.views.display();
    expect(view1.count).toBe(1);
    
    store.actions.setStep(5);
    const view2 = store.views.display();
    expect(view2.step).toBe(5);
    
    store.actions.increment();
    const view3 = store.views.display();
    expect(view3.count).toBe(6);
    
    // Test view
    const view = store.views.display();
    expect(view.count).toBe(6);
    expect(view.step).toBe(5);
  });
});