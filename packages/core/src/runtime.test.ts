import { describe, expect, it, vi } from 'vitest';
import { createLatticeStore } from './runtime';
import type { ReactiveSliceFactory, StoreAdapter } from './index';

describe('createLatticeStore - adapter bridge', () => {
  it('should bridge an adapter to the reactive slice system', () => {
    // Track what happens during adapter creation
    let capturedInitialState: any;
    let mockState: any;

    // Create adapter factory that captures initial state
    const adapterFactory = (initialState: any) => {
      capturedInitialState = initialState;
      mockState = { ...initialState };

      const mockAdapter: StoreAdapter<typeof initialState> = {
        getState: vi.fn(() => mockState),
        setState: vi.fn((updates) => Object.assign(mockState, updates)),
        subscribe: vi.fn(() => () => {}),
      };

      return mockAdapter;
    };

    // Create a component using the new reactive API
    const createComponent = (createSlice: ReactiveSliceFactory<{ count: number }>) => {
      const counter = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
          decrement: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() - 1 })
          ),
        })
      );

      return { counter };
    };

    // Create adapter and store
    const adapter = adapterFactory({ count: 0 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Verify factory was called with initial state
    expect(capturedInitialState).toEqual({ count: 0 });

    // Test the counter slice
    expect(component.counter().value()).toBe(0);

    // Test increment
    component.counter().increment();
    expect(mockState.count).toBe(1);
    expect(component.counter().value()).toBe(1);

    // Test decrement
    component.counter().decrement();
    expect(mockState.count).toBe(0);
    expect(component.counter().value()).toBe(0);

    // Verify adapter methods were called
    expect(adapter.getState).toHaveBeenCalled();
    expect(adapter.setState).toHaveBeenCalledWith({ count: 1 });
    expect(adapter.subscribe).toHaveBeenCalled();
  });

  it('should work with composed slices', () => {
    let mockState: any;

    const adapterFactory = (initialState: any) => {
      mockState = { ...initialState };

      const mockAdapter: StoreAdapter<typeof initialState> = {
        getState: () => mockState,
        setState: (updates) => Object.assign(mockState, updates),
        subscribe: vi.fn(() => () => {}),
      };

      return mockAdapter;
    };

    const createComponent = (
      createSlice: ReactiveSliceFactory<{ count: number; multiplier: number }>
    ) => {
      const counter = createSlice(
        (selectors) => ({ count: selectors.count, multiplier: selectors.multiplier }),
        ({ count, multiplier }, set) => ({
          count: () => count(),
          multiplier: () => multiplier(), // Expose multiplier to avoid unused variable warning
          increment: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
          multiply: () => set(
            (selectors) => ({ count: selectors.count, multiplier: selectors.multiplier }),
            ({ count, multiplier }) => ({ count: count() * multiplier() })
          ),
        })
      );

      const config = createSlice(
        (selectors) => ({ multiplier: selectors.multiplier }),
        ({ multiplier }, set) => ({
          multiplier: () => multiplier(),
          setMultiplier: (value: number) => set(
            (selectors) => ({ multiplier: selectors.multiplier }),
            () => ({ multiplier: value })
          ),
        })
      );

      return { counter, config };
    };

    const adapter = adapterFactory({ count: 0, multiplier: 2 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    expect(component.counter().count()).toBe(0);
    expect(component.config().multiplier()).toBe(2);

    component.counter().increment();
    expect(component.counter().count()).toBe(1);

    component.counter().multiply();
    expect(component.counter().count()).toBe(2);

    component.config().setMultiplier(3);
    component.counter().multiply();
    expect(component.counter().count()).toBe(6);
  });

  it('should handle fine-grained subscriptions for slices', async () => {
    let mockState: any;
    let adapterListener: (() => void) | undefined;
    const mockAdapter: StoreAdapter<any> = {
      getState: () => mockState,
      setState: (updates) => Object.assign(mockState, updates),
      subscribe: vi.fn((listener) => {
        adapterListener = listener;
        return () => { adapterListener = undefined; };
      }),
    };

    type State = { count: number; name: string };

    const createComponent = (createSlice: ReactiveSliceFactory<State>) => {
      const counter = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
        })
      );

      const user = createSlice(
        (selectors) => ({ name: selectors.name }),
        ({ name }, set) => ({
          name: () => name(),
          setName: (newName: string) => set(
            (selectors) => ({ name: selectors.name }),
            () => ({ name: newName })
          ),
        })
      );

      return { counter, user };
    };

    mockState = { count: 0, name: 'Alice' };
    const createSlice = createLatticeStore(mockAdapter);
    const component = createComponent(createSlice);

    // Get slice metadata to access fine-grained subscriptions
    const { getSliceMetadata } = await import('./utils');
    const counterMeta = getSliceMetadata(component.counter);
    const userMeta = getSliceMetadata(component.user);

    // Subscribe to slices
    const counterListener = vi.fn();
    const userListener = vi.fn();

    const unsubCounter = counterMeta!.subscribe(counterListener);
    userMeta!.subscribe(userListener);

    // Manually trigger the adapter's listeners to simulate state changes
    const triggerChange = () => {
      // Trigger the adapter listener if it exists
      if (adapterListener) {
        adapterListener();
      }
    };

    // Change counter state
    component.counter().increment();
    triggerChange();
    expect(counterListener).toHaveBeenCalledTimes(1);
    expect(userListener).toHaveBeenCalledTimes(0); // Should NOT be called - fine-grained!

    // Change user state
    component.user().setName('Bob');
    triggerChange();
    expect(counterListener).toHaveBeenCalledTimes(1); // Should NOT be called again
    expect(userListener).toHaveBeenCalledTimes(1); // Should be called now

    // Unsubscribe and verify
    unsubCounter();
    component.counter().increment();
    triggerChange();
    expect(counterListener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
    expect(userListener).toHaveBeenCalledTimes(1); // Still only called once
  });

  it('should expose subscription capability on slices', async () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: () => ({ count: 0 }),
      setState: () => {},
      subscribe: vi.fn(() => () => {}),
    };

    const createComponent = (createSlice: ReactiveSliceFactory<{ count: number }>) => {
      const counter = createSlice(
        (selectors) => ({ count: selectors.count }),
        ({ count }, set) => ({
          value: () => count(),
          increment: () => set(
            (selectors) => ({ count: selectors.count }),
            ({ count }) => ({ count: count() + 1 })
          ),
        })
      );

      return { counter };
    };

    const createSlice = createLatticeStore(mockAdapter);
    const component = createComponent(createSlice);

    // Slices should have metadata with subscribe capability
    const { getSliceMetadata } = await import('./utils');
    const metadata = getSliceMetadata(component.counter);
    
    expect(metadata).toBeDefined();
    expect(metadata?.dependencies).toEqual(new Set(['count']));
    expect(typeof metadata?.subscribe).toBe('function');
  });
});