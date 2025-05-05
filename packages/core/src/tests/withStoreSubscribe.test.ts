import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { withStoreSubscribe } from '../state';

describe('withStoreSubscribe utility', () => {
  it('correctly subscribes to a Zustand store and selects state', () => {
    // Create a test store
    const testStore = create(() => ({ count: 0, name: 'test' }));

    // Create a state selector
    const selector = (state: { count: number; name: string }) => ({
      count: state.count,
      name: state.name,
    });

    // Use withStoreSubscribe to subscribe to the store with the selector
    const subscriber = withStoreSubscribe(testStore, selector);

    // Initial state check
    expect(subscriber.getState()).toEqual({ count: 0, name: 'test' });

    // Update the store state
    testStore.setState({ count: 5, name: 'updated' });

    // Check that subscriber state is updated
    expect(subscriber.getState()).toEqual({ count: 5, name: 'updated' });

    // Test subscription mechanism
    const mockSubscriber = vi.fn();
    const unsubscribe = subscriber.subscribe(mockSubscriber);

    // Trigger state change
    testStore.setState({ count: 10, name: 'test again' });

    // Check that subscriber was called with the selected state
    expect(mockSubscriber).toHaveBeenCalledWith({
      count: 10,
      name: 'test again',
    });

    // Test unsubscribe functionality
    unsubscribe();
    testStore.setState({ count: 15, name: 'final' });

    // Should still only have been called once
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });
});
