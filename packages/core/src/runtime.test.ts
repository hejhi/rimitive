import { describe, expect, it, vi } from 'vitest';
import { createLatticeStore } from './runtime';
import { createStore } from './index';
import type { CreateStore, StoreAdapter } from './runtime';

describe('runtime with new createStore API', () => {
  it('should connect an app to an adapter', () => {
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

    // Create an app factory
    const createApp = (createStore: CreateStore<{ count: number }>) => {
      const createSlice = createStore({ count: 0 });

      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 }),
      }));

      return { counter };
    };

    // Create the store with runtime using factory
    const store = createLatticeStore(createApp, adapterFactory);

    // Verify factory was called with initial state
    expect(capturedInitialState).toEqual({ count: 0 });

    // Test the counter slice
    expect(store.counter.count()).toBe(0);

    // Test increment
    store.counter.increment();
    expect(mockState.count).toBe(1);

    // Test decrement
    store.counter.decrement();
    store.counter.decrement();
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

    const createApp = (
      createStore: CreateStore<{ count: number; multiplier: number }>
    ) => {
      const createSlice = createStore({ count: 0, multiplier: 2 });

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

    const store = createLatticeStore(createApp, adapterFactory);

    expect(store.counter.count()).toBe(0);
    expect(store.config.multiplier()).toBe(2);

    store.counter.increment();
    expect(store.counter.count()).toBe(1);

    store.counter.multiply();
    expect(store.counter.count()).toBe(2);

    store.config.setMultiplier(3);
    store.counter.multiply();
    expect(store.counter.count()).toBe(6);
  });

  it('should expose subscription capability', () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: () => ({}),
      setState: () => {},
      subscribe: vi.fn(() => () => {}),
    };

    const createApp = (createStore: CreateStore<any>) => {
      createStore({});
      return {};
    };

    const store = createLatticeStore(createApp, () => mockAdapter);

    expect(typeof store.subscribe).toBe('function');
    expect(store.subscribe).toBe(mockAdapter.subscribe);

    // Test that subscription works
    const unsubscribe = store.subscribe(() => {});
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

  it('should enforce single store pattern', () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: () => ({}),
      setState: () => {},
      subscribe: () => () => {},
    };

    const createApp = (createStore: CreateStore<any>) => {
      // First call should work
      createStore({ value: 1 });

      // Second call should throw
      expect(() => createStore({ value: 2 })).toThrow(
        'createStore can only be called once'
      );

      return {};
    };

    // This should not throw because the error is caught in the test
    createLatticeStore(createApp, () => mockAdapter);
  });

  it('should properly type the state through the adapter', () => {
    interface AppState {
      count: number;
      name: string;
    }

    let mockState: AppState = { name: 'test', count: 0 };

    const adapterFactory = (initialState: AppState) => {
      mockState = { ...initialState };

      const mockAdapter: StoreAdapter<AppState> = {
        getState: vi.fn(() => mockState),
        setState: vi.fn((updates) => Object.assign(mockState, updates)),
        subscribe: vi.fn(() => () => {}),
      };

      return mockAdapter;
    };

    const createApp = (createStore: CreateStore<AppState>) => {
      const createSlice = createStore({ count: 0, name: 'test' });

      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
      }));

      return { counter };
    };

    const store = createLatticeStore(createApp, adapterFactory);

    // Test operations
    store.counter.increment();
    expect(mockState.count).toBe(1);
  });
});
