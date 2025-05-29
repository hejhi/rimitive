import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';
import { createModel, createSlice, createComponent } from '@lattice/core';

describe('Memory Adapter - Read-only Slices', () => {
  it('should throw error when trying to set on a slice', () => {
    const adapter = createMemoryAdapter();
    const primitives = adapter.primitives;
    
    const store = primitives.createStore({ count: 0, name: 'test' });
    const slice = primitives.createSlice(store, state => ({ count: state.count }));
    
    // Slices should be read-only
    expect(() => slice.set({ count: 5 })).toThrow('Cannot set value on a slice - slices are read-only projections');
  });

  it('should throw error when trying to set on action slices', () => {
    const component = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 })
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment
      }));

      return { model, actions, views: {} };
    });

    const adapter = createMemoryAdapter();
    const { actions } = adapter.executeComponent(component);

    // Actions slice should be read-only
    expect(() => actions.set({ increment: () => {} })).toThrow('Cannot set value on a slice - slices are read-only projections');
  });

  it('should throw error when trying to set on view slices', () => {
    const component = createComponent(() => {
      const model = createModel<{
        count: number;
        disabled: boolean;
      }>(() => ({
        count: 5,
        disabled: false
      }));

      const displaySlice = createSlice(model, (m) => ({
        value: m.count,
        isDisabled: m.disabled
      }));

      return { 
        model, 
        actions: createSlice(model, () => ({})),
        views: { display: displaySlice }
      };
    });

    const adapter = createMemoryAdapter();
    const { views } = adapter.executeComponent(component);

    const display = views.display;
    // View slice should be read-only
    expect(() => display.set({ value: 10, isDisabled: false })).toThrow('Cannot set value on a slice - slices are read-only projections');
  });

  it('should allow set on the model store but not on slices', () => {
    const component = createComponent(() => {
      const model = createModel<{
        count: number;
        name: string;
      }>(() => ({
        count: 0,
        name: 'test'
      }));

      return { 
        model, 
        actions: createSlice(model, () => ({})),
        views: {
          countSlice: createSlice(model, m => ({ count: m.count }))
        }
      };
    });

    const adapter = createMemoryAdapter();
    const { model, views } = adapter.executeComponent(component);

    // Model store should allow set
    expect(() => model.set({ count: 5, name: 'updated' })).not.toThrow();
    expect(model.get().count).toBe(5);

    // But slices should not
    const countSlice = views.countSlice;
    expect(() => countSlice.set({ count: 10 })).toThrow('Cannot set value on a slice - slices are read-only projections');
  });

  it('should maintain read-only property through slice transformations', () => {
    const adapter = createMemoryAdapter();
    const primitives = adapter.primitives;
    
    const store = primitives.createStore({ x: 10, y: 20 });
    const positionSlice = primitives.createSlice(store, state => ({
      x: state.x,
      y: state.y
    }));
    
    // Create a slice of a slice (transformation)
    const distanceSlice = primitives.createSlice(positionSlice, pos => ({
      distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y)
    }));
    
    // Both slices should be read-only
    expect(() => positionSlice.set({ x: 5, y: 5 })).toThrow('Cannot set value on a slice - slices are read-only projections');
    expect(() => distanceSlice.set({ distance: 100 })).toThrow('Cannot set value on a slice - slices are read-only projections');
  });

  it('should properly handle functional updates being rejected', () => {
    const adapter = createMemoryAdapter();
    const primitives = adapter.primitives;
    
    const store = primitives.createStore({ count: 0 });
    const slice = primitives.createSlice(store, state => state);
    
    // Try functional update - should also throw
    expect(() => slice.set((prev: any) => ({ count: prev.count + 1 }))).toThrow('Cannot set value on a slice - slices are read-only projections');
  });
});