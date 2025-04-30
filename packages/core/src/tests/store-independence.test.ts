import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';

describe('Store Independence', () => {
  interface CounterState {
    count: number;
    increment: () => void;
  }

  interface NameState {
    name: string;
    setName: (name: string) => void;
  }

  it('should create multiple independent stores that do not interfere with each other', () => {
    // Create two different stores
    const useCounterStore = create<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    const useNameStore = create<NameState>((set) => ({
      name: 'test',
      setName: (name: string) => set({ name }),
    }));

    // Set up subscribers to track updates
    const counterSubscriber = vi.fn();
    const nameSubscriber = vi.fn();

    useCounterStore.subscribe(counterSubscriber);
    useNameStore.subscribe(nameSubscriber);

    // Update counter store
    useCounterStore.getState().increment();

    // Counter subscriber should be called, name subscriber should not
    expect(counterSubscriber).toHaveBeenCalledTimes(1);
    expect(nameSubscriber).toHaveBeenCalledTimes(0);

    // Update name store
    useNameStore.getState().setName('new name');

    // Name subscriber should be called once, counter subscriber still once
    expect(counterSubscriber).toHaveBeenCalledTimes(1);
    expect(nameSubscriber).toHaveBeenCalledTimes(1);

    // Verify store states remain separate
    expect(useCounterStore.getState().count).toBe(1);
    expect(useNameStore.getState().name).toBe('new name');
  });
});
