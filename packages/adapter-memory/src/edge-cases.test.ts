import { describe, it, expect } from 'vitest';
import type { ModelFactory } from '@lattice/core';
import { createMemoryAdapter } from './index';

describe('Memory Adapter Edge Cases', () => {
  it('should handle empty state updates', () => {
    interface State {
      value: number;
      update: () => void;
    }

    const modelFactory: ModelFactory<State> = ({ set }) => ({
      value: 42,
      update: () => set({}) // Empty update
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    const initialState = store.getState();
    
    let updateCount = 0;
    store.subscribe(() => updateCount++);
    
    store.getState().update();
    
    // State reference should change even with empty update
    expect(store.getState()).not.toBe(initialState);
    expect(store.getState().value).toBe(42); // Value preserved
    expect(updateCount).toBe(1); // Subscribers notified
  });

  it('should handle rapid successive updates', () => {
    interface CounterState {
      count: number;
      increment: () => void;
    }

    const modelFactory: ModelFactory<CounterState> = ({ set, get }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    const updates: number[] = [];
    store.subscribe((state) => updates.push(state.count));

    // Rapid updates
    for (let i = 0; i < 10; i++) {
      store.getState().increment();
    }

    expect(store.getState().count).toBe(10);
    expect(updates).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('should handle circular references in state', () => {
    interface CircularState {
      name: string;
      self?: CircularState;
      setSelf: () => void;
    }

    const modelFactory: ModelFactory<CircularState> = ({ set, get }) => ({
      name: 'circular',
      self: undefined,
      setSelf: () => {
        const state = get();
        set({ self: state });
      }
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    // This should not cause infinite recursion
    store.getState().setSelf();
    
    expect(store.getState().self).toBeDefined();
    expect(store.getState().self?.name).toBe('circular');
  });

  it('should handle functions as state values', () => {
    interface FunctionState {
      operation: (a: number, b: number) => number;
      result: number;
      setOperation: (op: (a: number, b: number) => number) => void;
      calculate: (a: number, b: number) => void;
    }

    const modelFactory: ModelFactory<FunctionState> = ({ set, get }) => ({
      operation: (a, b) => a + b,
      result: 0,
      setOperation: (op) => set({ operation: op }),
      calculate: (a, b) => {
        const { operation } = get();
        set({ result: operation(a, b) });
      }
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    // Initial operation
    store.getState().calculate(5, 3);
    expect(store.getState().result).toBe(8);

    // Change operation
    store.getState().setOperation((a, b) => a * b);
    store.getState().calculate(5, 3);
    expect(store.getState().result).toBe(15);
  });

  it('should handle subscription during state update', () => {
    interface State {
      value: number;
      subscribeInUpdate: () => void;
    }

    let lateSubscriberCalled = false;

    const modelFactory: ModelFactory<State> = ({ set }) => ({
      value: 0,
      subscribeInUpdate: () => {
        set({ value: 1 });
        // Note: In real usage, store reference would need to be available
        // This tests that the adapter handles this case gracefully
      }
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    const calls: number[] = [];
    store.subscribe((state) => {
      calls.push(state.value);
      
      // Subscribe during notification (edge case)
      if (state.value === 1 && !lateSubscriberCalled) {
        store.subscribe(() => {
          lateSubscriberCalled = true;
        });
      }
    });

    store.getState().subscribeInUpdate();
    
    expect(calls).toEqual([1]);
    
    // Late subscriber should work for next update
    store.getState().subscribeInUpdate();
    expect(lateSubscriberCalled).toBe(true);
  });

  it('should handle exceptions in model methods gracefully', () => {
    interface ErrorState {
      value: number;
      throwError: () => void;
      safeUpdate: () => void;
    }

    const modelFactory: ModelFactory<ErrorState> = ({ set, get }) => ({
      value: 0,
      throwError: () => {
        throw new Error('Intentional error');
      },
      safeUpdate: () => set({ value: get().value + 1 })
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    // Error in method should not break the store
    expect(() => store.getState().throwError()).toThrow('Intentional error');
    
    // Store should still be functional
    store.getState().safeUpdate();
    expect(store.getState().value).toBe(1);
  });

  it('should handle very large state objects efficiently', () => {
    interface LargeState {
      items: Array<{ id: number; data: string }>;
      addItem: (data: string) => void;
      updateItem: (id: number, data: string) => void;
    }

    const modelFactory: ModelFactory<LargeState> = ({ set, get }) => ({
      items: [],
      addItem: (data) => {
        const id = get().items.length;
        set({ items: [...get().items, { id, data }] });
      },
      updateItem: (id, data) => {
        set({
          items: get().items.map(item =>
            item.id === id ? { ...item, data } : item
          )
        });
      }
    });

    const adapter = createMemoryAdapter();
    const store = adapter(modelFactory);

    // Add many items
    for (let i = 0; i < 1000; i++) {
      store.getState().addItem(`Item ${i}`);
    }

    expect(store.getState().items).toHaveLength(1000);

    // Update specific item
    store.getState().updateItem(500, 'Updated Item');
    expect(store.getState().items[500]?.data).toBe('Updated Item');
  });
});