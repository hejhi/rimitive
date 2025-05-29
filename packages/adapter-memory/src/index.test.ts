import { describe, it, expect } from 'vitest';
import { createMemoryAdapter } from './index';

describe('createMemoryAdapter', () => {
  it('should export createMemoryAdapter function', () => {
    expect(createMemoryAdapter).toBeDefined();
    expect(typeof createMemoryAdapter).toBe('function');
  });

  it('should create an adapter with working primitives', () => {
    interface CounterState {
      count: number;
      increment: () => void;
      decrement: () => void;
    }

    // Create adapter and use primitives
    const adapter = createMemoryAdapter();
    const { primitives } = adapter;
    
    // Create store with initial state
    const store = primitives.createStore<CounterState>({
      count: 0,
      increment: () => {
        store.set(prev => ({ ...prev, count: prev.count + 1 }));
      },
      decrement: () => {
        store.set(prev => ({ ...prev, count: prev.count - 1 }));
      }
    });

    // Verify initial state
    expect(store.get().count).toBe(0);

    // Verify actions work
    store.get().increment();
    expect(store.get().count).toBe(1);

    store.get().decrement();
    expect(store.get().count).toBe(0);
  });

  it('should support subscriptions to state changes', () => {
    interface CounterState {
      count: number;
      increment: () => void;
    }

    const adapter = createMemoryAdapter();
    const { primitives } = adapter;
    
    const store = primitives.createStore<CounterState>({
      count: 0,
      increment: () => {
        store.set(prev => ({ ...prev, count: prev.count + 1 }));
      }
    });

    let callCount = 0;
    let lastState: CounterState | undefined;

    // Subscribe to state changes
    const unsubscribe = store.subscribe((state) => {
      callCount++;
      lastState = state;
    });

    // Trigger state change
    store.get().increment();

    // Verify subscription was called
    expect(callCount).toBe(1);
    expect(lastState?.count).toBe(1);

    // Unsubscribe and verify no more calls
    unsubscribe();
    store.get().increment();
    expect(callCount).toBe(1);
  });
});