import { describe, expect, it, vi } from 'vitest';
import { createLatticeStore } from './runtime';
import { createStore } from './index';
import type { RuntimeSliceFactory, StoreAdapter } from './index';

describe('runtime with new createStore API', () => {
  it('should connect an component to an adapter', () => {
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

    // Create an component factory
    const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      return { counter };
    };

    // Create adapter and store
    const adapter = adapterFactory({ count: 0 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Verify factory was called with initial state
    expect(capturedInitialState).toEqual({ count: 0 });

    // Test the counter slice
    expect(component.counter.selector.count()).toBe(0);

    // Test increment
    component.counter.selector.increment();
    expect(mockState.count).toBe(1);

    // Test decrement
    component.counter.selector.decrement();
    component.counter.selector.decrement();
    expect(mockState.count).toBe(-1);
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
      createSlice: RuntimeSliceFactory<{ count: number; multiplier: number }>
    ) => {
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        multiply: () => set({ count: get().count * get().multiplier }),
      }));

      const config = createSlice(({ get, set }) => ({
        multiplier: () => get().multiplier,
        setMultiplier: (value: number) => set({ multiplier: value }),
      }));

      return { counter, config };
    };

    const adapter = adapterFactory({ count: 0, multiplier: 2 });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    expect(component.counter.selector.count()).toBe(0);
    expect(component.config.selector.multiplier()).toBe(2);

    component.counter.selector.increment();
    expect(component.counter.selector.count()).toBe(1);

    component.counter.selector.multiply();
    expect(component.counter.selector.count()).toBe(2);

    component.config.selector.setMultiplier(3);
    component.counter.selector.multiply();
    expect(component.counter.selector.count()).toBe(6);
  });

  it('should expose subscription capability on slices', () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: () => ({ count: 0 }),
      setState: () => {},
      subscribe: vi.fn(() => () => {}),
    };

    const createComponent = (createSlice: RuntimeSliceFactory<{ count: number }>) => {
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));
      
      return { counter };
    };

    const createSlice = createLatticeStore(mockAdapter);
    const component = createComponent(createSlice);

    expect(typeof component.counter.subscribe).toBe('function');
    expect(component.counter.subscribe).toBe(mockAdapter.subscribe);

    // Test that subscription works
    const unsubscribe = component.counter.subscribe(() => {});
    expect(mockAdapter.subscribe).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });

  it('should work with standalone createStore for comparison', () => {
    // This demonstrates how the new createStore works independently
    const createSlice = createStore({ count: 0, name: 'test' });

    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 }),
    }));

    const editor = createSlice(({ get, set }) => ({
      name: () => get().name,
      setName: (name: string) => set({ name }),
    }));

    expect(counter.count()).toBe(0);
    expect(editor.name()).toBe('test');

    counter.increment();
    expect(counter.count()).toBe(1);

    editor.setName('updated');
    expect(editor.name()).toBe('updated');
  });

  it('should work with multiple slices sharing the same state', () => {
    let mockState: any;
    const mockAdapter: StoreAdapter<any> = {
      getState: () => mockState,
      setState: (updates) => Object.assign(mockState, updates),
      subscribe: () => () => {},
    };

    const createComponent = (createSlice: RuntimeSliceFactory<{ value1: number; value2: number }>) => {
      const slice1 = createSlice(({ get, set }) => ({
        value1: () => get().value1,
        increment1: () => set({ value1: get().value1 + 1 }),
      }));

      const slice2 = createSlice(({ get, set }) => ({
        value2: () => get().value2,
        increment2: () => set({ value2: get().value2 + 1 }),
      }));

      return { slice1, slice2 };
    };

    mockState = { value1: 1, value2: 2 };
    const createSlice = createLatticeStore(mockAdapter);
    const component = createComponent(createSlice);
    
    expect(component.slice1.selector.value1()).toBe(1);
    expect(component.slice2.selector.value2()).toBe(2);
  });

  it('should properly type the state through the adapter', () => {
    interface ComponentState {
      count: number;
      name: string;
    }

    let mockState: ComponentState = { name: 'test', count: 0 };

    const adapterFactory = (initialState: ComponentState) => {
      mockState = { ...initialState };

      const mockAdapter: StoreAdapter<ComponentState> = {
        getState: vi.fn(() => mockState),
        setState: vi.fn((updates) => Object.assign(mockState, updates)),
        subscribe: vi.fn(() => () => {}),
      };

      return mockAdapter;
    };

    const createComponent = (createSlice: RuntimeSliceFactory<ComponentState>) => {
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));

      return { counter };
    };

    const adapter = adapterFactory({ count: 0, name: 'test' });
    const createSlice = createLatticeStore(adapter);
    const component = createComponent(createSlice);

    // Test operations
    component.counter.selector.increment();
    expect(mockState.count).toBe(1);
  });
});
