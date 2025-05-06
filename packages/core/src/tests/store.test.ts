import { describe, it, expect } from 'vitest';
import { createStore } from '../store';

describe('createStore', () => {
  it('should create a zustand store with proper state and actions', () => {
    type CounterState = {
      count: number;
      increment: () => void;
      decrement: () => void;
    };

    const useStore = createStore<CounterState>((set) => ({
      count: 0,
      increment: () =>
        set((state: CounterState) => ({ count: state.count + 1 })),
      decrement: () =>
        set((state: CounterState) => ({ count: state.count - 1 })),
    }));

    // The store should exist and be a function
    expect(useStore).toBeDefined();
    expect(typeof useStore).toBe('function');

    // Create a store instance
    const store = useStore.getState();

    // Initial state should be as defined
    expect(store.count).toBe(0);

    // Actions should modify state
    store.increment();
    expect(useStore.getState().count).toBe(1);

    store.decrement();
    expect(useStore.getState().count).toBe(0);
  });

  it('should allow subscribing to state changes', () => {
    interface SimpleState {
      count: number;
      increment: () => void;
    }

    const useStore = createStore<SimpleState>((set) => ({
      count: 0,
      increment: () =>
        set((state: SimpleState) => ({ count: state.count + 1 })),
    }));

    let callCount = 0;
    const unsubscribe = useStore.subscribe(() => {
      callCount++;
    });

    useStore.getState().increment();
    expect(callCount).toBe(1);

    unsubscribe();
    useStore.getState().increment();
    expect(callCount).toBe(1); // Should not increase after unsubscribe
  });
});
