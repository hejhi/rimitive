import { describe, expect, it, vi } from 'vitest';
import { createLatticeStore } from './runtime';
import { createStore } from './index';
import type { CreateStore, StoreAdapter } from './runtime';

describe('runtime with new createStore API', () => {
  it('should connect an app to an adapter', () => {
    // Create a mock adapter
    const mockState = { count: 0 };
    const mockAdapter: StoreAdapter<typeof mockState> = {
      getState: vi.fn(() => mockState),
      setState: vi.fn((updates) => Object.assign(mockState, updates)),
      subscribe: vi.fn(() => () => {}),
    };

    // Create an app factory
    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ count: 0 });
      
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 }),
        decrement: () => set({ count: get().count - 1 })
      }));
      
      return { counter };
    };

    // Create the store with runtime
    const store = createLatticeStore(createApp, mockAdapter);

    // Verify initial state was set
    expect(mockAdapter.setState).toHaveBeenCalledWith({ count: 0 });

    // Test the counter slice
    expect(store.counter.count()).toBe(0);
    
    // Test increment
    store.counter.increment();
    expect(mockAdapter.setState).toHaveBeenCalledWith({ count: 1 });
    expect(store.counter.count()).toBe(1);

    // Test decrement
    store.counter.decrement();
    expect(mockAdapter.setState).toHaveBeenCalledWith({ count: 0 });
  });

  it('should work with composed slices', () => {
    const mockState = { count: 0, multiplier: 2 };
    const mockAdapter: StoreAdapter<typeof mockState> = {
      getState: vi.fn(() => mockState),
      setState: vi.fn((updates) => Object.assign(mockState, updates)),
      subscribe: vi.fn(() => () => {}),
    };

    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ count: 0, multiplier: 2 });
      
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 })
      }));
      
      const settings = createSlice(({ get, set }) => ({
        multiplier: () => get().multiplier,
        setMultiplier: (value: number) => set({ multiplier: value })
      }));
      
      return { counter, settings };
    };

    const store = createLatticeStore(createApp, mockAdapter);
    
    expect(store.counter.count()).toBe(0);
    expect(store.settings.multiplier()).toBe(2);
    
    store.settings.setMultiplier(3);
    expect(mockAdapter.setState).toHaveBeenCalledWith({ multiplier: 3 });
    expect(store.settings.multiplier()).toBe(3);
  });

  it('should expose subscription capability', () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: vi.fn(() => ({ count: 0 })),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const createApp = (createStore: CreateStore) => {
      const createSlice = createStore({ count: 0 });
      return { createSlice };
    };

    const store = createLatticeStore(createApp, mockAdapter);
    
    const listener = vi.fn();
    store.subscribe(listener);
    
    expect(mockAdapter.subscribe).toHaveBeenCalledWith(listener);
  });

  it('should work with standalone createStore for comparison', () => {
    // Show that the same app can work without runtime
    const createSlice = createStore({ count: 0 });
    
    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 })
    }));
    
    expect(counter.count()).toBe(0);
    counter.increment();
    expect(counter.count()).toBe(1);
  });

  it('should enforce single store pattern', () => {
    const mockAdapter: StoreAdapter<any> = {
      getState: vi.fn(() => ({ count: 0 })),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const createApp = (createStore: CreateStore) => {
      // First createStore call should succeed
      const createSlice1 = createStore({ count: 0, name: 'test' });
      
      // Second createStore call should throw
      expect(() => {
        createStore({ value: 42 });
      }).toThrow('createStore can only be called once per app');
      
      return { createSlice1 };
    };

    const store = createLatticeStore(createApp, mockAdapter);
    expect(store.createSlice1).toBeDefined();
  });

  it('should properly type the state through the adapter', () => {
    type AppState = { count: number; name: string };
    
    const mockAdapter: StoreAdapter<AppState> = {
      getState: vi.fn(() => ({ count: 0, name: 'test' })),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    };

    const createApp = (createStore: CreateStore) => {
      // The createStore call defines the state shape
      const createSlice = createStore<AppState>({ count: 0, name: 'test' });
      
      const counter = createSlice(({ get, set }) => ({
        count: () => get().count,
        increment: () => set({ count: get().count + 1 })
      }));
      
      return { counter };
    };

    const store = createLatticeStore(createApp, mockAdapter);
    
    // Verify that initial state was set correctly
    expect(mockAdapter.setState).toHaveBeenCalledWith({ count: 0, name: 'test' });
    
    // Test operations
    store.counter.increment();
    expect(mockAdapter.setState).toHaveBeenCalledWith({ count: 1 });
  });
});