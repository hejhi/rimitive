import { describe, it, expect } from 'vitest';
import type { ModelFactory } from '@lattice/core';
import { createMemoryAdapter } from './index';

describe('createMemoryAdapter', () => {
  it('should export createMemoryAdapter function', () => {
    expect(createMemoryAdapter).toBeDefined();
    expect(typeof createMemoryAdapter).toBe('function');
  });

  it('should create an adapter that fulfills a simple counter model factory', () => {
    interface CounterState {
      count: number;
      increment: () => void;
      decrement: () => void;
    }

    // Simple counter model factory specification
    const counterModelFactory: ModelFactory<CounterState> = ({ set, get }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 })
    });

    // Create adapter and execute the model factory
    const adapter = createMemoryAdapter();
    const store = adapter(counterModelFactory);

    // Verify initial state
    expect(store.getState().count).toBe(0);

    // Verify actions work
    store.getState().increment();
    expect(store.getState().count).toBe(1);

    store.getState().decrement();
    expect(store.getState().count).toBe(0);
  });

  it('should support subscriptions to state changes', () => {
    interface CounterState {
      count: number;
      increment: () => void;
    }

    const counterModelFactory: ModelFactory<CounterState> = ({ set, get }) => ({
      count: 0,
      increment: () => set({ count: get().count + 1 })
    });

    const adapter = createMemoryAdapter();
    const store = adapter(counterModelFactory);

    let callCount = 0;
    let lastState: CounterState | undefined;

    // Subscribe to state changes
    const unsubscribe = store.subscribe((state) => {
      callCount++;
      lastState = state;
    });

    // Trigger state change
    store.getState().increment();

    // Verify subscription was called
    expect(callCount).toBe(1);
    expect(lastState?.count).toBe(1);

    // Unsubscribe and verify no more calls
    unsubscribe();
    store.getState().increment();
    expect(callCount).toBe(1);
  });
});