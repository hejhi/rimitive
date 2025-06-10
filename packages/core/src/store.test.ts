import { describe, expect, it } from 'vitest';
import { createStore } from './index';

describe('createStore', () => {
  it('should create a store with initial state', () => {
    const createSlice = createStore({ count: 0, name: 'John' });
    
    const state = createSlice(({ get }) => ({
      getState: () => get()
    }));
    
    expect(state.getState()).toEqual({ count: 0, name: 'John' });
  });

  it('should allow creating slices with behaviors', () => {
    const createSlice = createStore({ count: 0 });
    
    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 }),
      decrement: () => set({ count: get().count - 1 })
    }));
    
    expect(counter.count()).toBe(0);
    
    counter.increment();
    expect(counter.count()).toBe(1);
    
    counter.increment();
    expect(counter.count()).toBe(2);
    
    counter.decrement();
    expect(counter.count()).toBe(1);
  });

  it('should share state between multiple slices', () => {
    const createSlice = createStore({ count: 0, name: 'John' });
    
    const counter = createSlice(({ get, set }) => ({
      count: () => get().count,
      increment: () => set({ count: get().count + 1 })
    }));
    
    const user = createSlice(({ get, set }) => ({
      name: () => get().name,
      setName: (name: string) => set({ name })
    }));
    
    const display = createSlice(({ get }) => ({
      summary: () => `${get().name} has count: ${get().count}`
    }));
    
    expect(display.summary()).toBe('John has count: 0');
    
    counter.increment();
    user.setName('Jane');
    
    expect(display.summary()).toBe('Jane has count: 1');
  });

  it('should only update specified properties in set', () => {
    const createSlice = createStore({ count: 0, name: 'John', age: 30 });
    
    const actions = createSlice(({ get, set }) => ({
      updateCount: (count: number) => set({ count }),
      getState: () => get()
    }));
    
    actions.updateCount(5);
    
    expect(actions.getState()).toEqual({ count: 5, name: 'John', age: 30 });
  });
});