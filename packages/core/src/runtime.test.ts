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
      getState: () => ({ ...mockState }),  // Return a copy
      setState: (updates) => {
        mockState = { ...mockState, ...updates };  // Create new object
        if (adapterListener) adapterListener();  // Notify after state change
      },
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

    // Change counter state
    component.counter().increment();
    expect(counterListener).toHaveBeenCalledTimes(1);
    expect(userListener).toHaveBeenCalledTimes(0); // Fine-grained: user slice not notified

    // Change user state
    component.user().setName('Bob');
    expect(counterListener).toHaveBeenCalledTimes(1); // Fine-grained: counter not notified
    expect(userListener).toHaveBeenCalledTimes(1);

    // Unsubscribe and verify
    unsubCounter();
    component.counter().increment();
    expect(counterListener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
    expect(userListener).toHaveBeenCalledTimes(1); // Fine-grained: not called
  });

  it('should demonstrate fine-grained subscriptions with multiple slices', async () => {
    let mockState: any = { a: 1, b: 2, c: 3, d: 4 };
    let adapterListener: (() => void) | undefined;
    
    const mockAdapter: StoreAdapter<any> = {
      getState: () => ({ ...mockState }),  // Return a copy to avoid reference issues
      setState: (updates) => {
        mockState = { ...mockState, ...updates };  // Create new object
        // Simulate adapter notification
        if (adapterListener) adapterListener();
      },
      subscribe: (listener) => {
        adapterListener = listener;
        return () => { adapterListener = undefined; };
      },
    };

    type State = { a: number; b: number; c: number; d: number };
    const createSlice = createLatticeStore<State>(mockAdapter);
    
    // Create slices with different dependencies
    const sliceA = createSlice(
      (selectors) => ({ a: selectors.a }),
      ({ a }) => ({ value: () => a() })
    );
    
    const sliceBC = createSlice(
      (selectors) => ({ b: selectors.b, c: selectors.c }),
      ({ b, c }) => ({ sum: () => b() + c() })
    );
    
    const sliceD = createSlice(
      (selectors) => ({ d: selectors.d }),
      ({ d }) => ({ value: () => d() })
    );
    
    // Track notifications
    const notifications = { a: 0, bc: 0, d: 0 };
    
    const { getSliceMetadata } = await import('./utils');
    getSliceMetadata(sliceA)!.subscribe(() => notifications.a++);
    getSliceMetadata(sliceBC)!.subscribe(() => notifications.bc++);
    getSliceMetadata(sliceD)!.subscribe(() => notifications.d++);
    
    // Change only 'a' - should only notify sliceA
    mockAdapter.setState({ a: 10 });
    expect(notifications).toEqual({ a: 1, bc: 0, d: 0 });
    
    // Change 'b' and 'c' - should only notify sliceBC
    mockAdapter.setState({ b: 20, c: 30 });
    expect(notifications).toEqual({ a: 1, bc: 1, d: 0 });
    
    // Change 'd' - should only notify sliceD
    mockAdapter.setState({ d: 40 });
    expect(notifications).toEqual({ a: 1, bc: 1, d: 1 });
    
    // Change all - should notify all slices
    mockAdapter.setState({ a: 100, b: 200, c: 300, d: 400 });
    expect(notifications).toEqual({ a: 2, bc: 2, d: 2 });
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