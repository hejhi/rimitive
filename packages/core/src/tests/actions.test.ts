import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Basic Actions Pattern', () => {
  it('actions correctly call model methods', () => {
    // Create a test store
    const counterStore = create(() => ({ count: 0 }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(counterStore, (state) => ({
      count: state.count,
    }));

    // Create model with getters and mutations
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getCount: () => selectedState.count,
      increment: () =>
        counterStore.setState((state) => ({ count: state.count + 1 })),
      decrement: () =>
        counterStore.setState((state) => ({ count: state.count - 1 })),
      reset: () => counterStore.setState({ count: 0 }),
    }));

    // Spy on model methods
    const incrementSpy = vi.spyOn(model, 'increment');
    const decrementSpy = vi.spyOn(model, 'decrement');
    const resetSpy = vi.spyOn(model, 'reset');

    // Create actions object
    const actions = {
      increment: () => model.increment(),
      decrement: () => model.decrement(),
      reset: () => model.reset(),
    };

    // Test initial state
    expect(model.getCount()).toBe(0);

    // Call actions and check that they correctly call model methods
    actions.increment();
    expect(incrementSpy).toHaveBeenCalledTimes(1);
    expect(model.getCount()).toBe(1);

    actions.decrement();
    expect(decrementSpy).toHaveBeenCalledTimes(1);
    expect(model.getCount()).toBe(0);

    // Increment multiple times
    actions.increment();
    actions.increment();
    expect(incrementSpy).toHaveBeenCalledTimes(3);
    expect(model.getCount()).toBe(2);

    // Reset should be called and state should be 0
    actions.reset();
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(model.getCount()).toBe(0);
  });
});
