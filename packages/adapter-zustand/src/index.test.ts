import { describe, it, expect } from 'vitest';
import { createZustandAdapter } from './index';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createComponent, createModel, createSlice } from '@lattice/core';

describe('createZustandAdapter', () => {
  it('should export createZustandAdapter function', () => {
    expect(createZustandAdapter).toBeDefined();
    expect(typeof createZustandAdapter).toBe('function');
  });

  it('should create a state creator that works with Zustand create()', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      const actions = createSlice(model, (m) => ({
        increment: m.increment,
      }));

      return { model, actions, views: {} };
    });

    const useStore = create(createZustandAdapter(counter));
    
    // Verify initial state
    expect(useStore.getState().count).toBe(0);
    
    // Verify methods work
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);
  });
  
  it('should support state subscriptions through Zustand', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m.increment })),
        views: {},
      };
    });

    const useStore = create(createZustandAdapter(counter));
    
    // Track state changes
    const states: any[] = [];
    const unsubscribe = useStore.subscribe((state) => {
      states.push({ count: state.count });
    });
    
    // Make changes
    useStore.getState().increment();
    useStore.getState().increment();
    
    expect(states.length).toBe(2);
    expect(states[0].count).toBe(1);
    expect(states[1].count).toBe(2);
    
    unsubscribe();
  });
  
  it('should handle slice selection with Zustand selectors', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        multiplier: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        multiplier: 2,
        increment: () => set({ count: get().count + 1 }),
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m.increment })),
        views: {},
      };
    });

    const useStore = create(createZustandAdapter(counter));
    
    // Use Zustand selector
    const selectDoubled = (state: any) => state.count * state.multiplier;
    expect(selectDoubled(useStore.getState())).toBe(0);
    
    useStore.getState().increment();
    expect(selectDoubled(useStore.getState())).toBe(2);
  });
  
  it('should support middleware integration', () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        increment: () => void;
      }>(({ set, get }) => ({
        count: 0,
        increment: () => set({ count: get().count + 1 }),
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ increment: m.increment })),
        views: {},
      };
    });

    // Test with devtools middleware
    const useStoreWithDevtools = create(
      devtools(createZustandAdapter(counter), { name: 'counter-store' })
    );
    
    expect(useStoreWithDevtools.getState().count).toBe(0);
    
    // Test with persist middleware
    const useStoreWithPersist = create(
      persist(createZustandAdapter(counter), { name: 'counter-storage' })
    );
    
    expect(useStoreWithPersist.getState().count).toBe(0);
    
    // Test with combined middleware
    const useStoreWithBoth = create(
      devtools(
        persist(createZustandAdapter(counter), { name: 'counter-storage' }),
        { name: 'counter-store' }
      )
    );
    
    expect(useStoreWithBoth.getState().count).toBe(0);
  });
  
  it('should handle async actions properly', async () => {
    const counter = createComponent(() => {
      const model = createModel<{
        count: number;
        loading: boolean;
        incrementAsync: () => Promise<void>;
      }>(({ set, get }) => ({
        count: 0,
        loading: false,
        incrementAsync: async () => {
          set({ loading: true });
          await new Promise(resolve => setTimeout(resolve, 10));
          set({ count: get().count + 1, loading: false });
        },
      }));

      return {
        model,
        actions: createSlice(model, (m) => ({ incrementAsync: m.incrementAsync })),
        views: {},
      };
    });

    const useStore = create(createZustandAdapter(counter));
    
    expect(useStore.getState().count).toBe(0);
    expect(useStore.getState().loading).toBe(false);
    
    // Start async operation
    const promise = useStore.getState().incrementAsync();
    expect(useStore.getState().loading).toBe(true);
    
    // Wait for completion
    await promise;
    expect(useStore.getState().count).toBe(1);
    expect(useStore.getState().loading).toBe(false);
  });
});