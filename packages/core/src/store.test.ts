import { describe, expect, it, vi } from 'vitest';
import { createStore, createStoreWithMetadata } from './index';

describe('createStore', () => {
  it('should create a store with initial state', () => {
    const createSlice = createStore({ count: 0, name: 'John' });
    
    const state = createSlice(
      (selectors) => ({ count: selectors.count, name: selectors.name }),
      ({ count, name }) => ({
        getCount: () => count(),
        getName: () => name()
      })
    );
    
    expect(state().getCount()).toBe(0);
    expect(state().getName()).toBe('John');
  });

  it('should allow creating slices with behaviors', () => {
    const createSlice = createStore({ count: 0 });
    
    const counter = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        count: () => count(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        ),
        decrement: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() - 1 })
        )
      })
    );
    
    expect(counter().count()).toBe(0);
    
    counter().increment();
    expect(counter().count()).toBe(1);
    
    counter().increment();
    expect(counter().count()).toBe(2);
    
    counter().decrement();
    expect(counter().count()).toBe(1);
  });

  it('should share state between multiple slices', () => {
    const createSlice = createStore({ count: 0, name: 'John' });
    
    const counter = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        count: () => count(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        )
      })
    );
    
    const user = createSlice(
      (selectors) => ({ name: selectors.name }),
      ({ name: nameDep }, set) => ({
        name: () => nameDep(),
        setName: (newName: string) => set(
          (selectors) => ({ name: selectors.name }),
          () => ({ name: newName })
        )
      })
    );
    
    const display = createSlice(
      (selectors) => ({ count: selectors.count, name: selectors.name }),
      ({ count, name }) => ({
        summary: () => `${name()} has count: ${count()}`
      })
    );
    
    expect(display().summary()).toBe('John has count: 0');
    
    counter().increment();
    user().setName('Jane');
    
    expect(display().summary()).toBe('Jane has count: 1');
  });

  it('should only update specified properties in set', () => {
    const createSlice = createStore({ count: 0, name: 'John', age: 30 });
    
    const actions = createSlice(
      (selectors) => ({ count: selectors.count, name: selectors.name, age: selectors.age }),
      ({ count, name, age }, set) => ({
        updateCount: (newCount: number) => set(
          (selectors) => ({ count: selectors.count }),
          () => ({ count: newCount })
        ),
        getCount: () => count(),
        getName: () => name(),
        getAge: () => age()
      })
    );
    
    actions().updateCount(5);
    
    expect(actions().getCount()).toBe(5);
    expect(actions().getName()).toBe('John');
    expect(actions().getAge()).toBe(30);
  });

  it('should track dependencies correctly', () => {
    const store = createStoreWithMetadata({ count: 0, name: 'John', age: 30 });
    
    const slice = store.createSlice(
      (selectors) => ({
        count: selectors.count,
        name: selectors.name,
        // Note: age is not accessed
      }),
      ({ count, name }) => ({
        summary: () => `${name()} has count: ${count()}`
      })
    );
    
    const metadata = store.getMetadata(slice);
    
    // Should only depend on count and name
    expect(metadata?.dependencies.has('count')).toBe(true);
    expect(metadata?.dependencies.has('name')).toBe(true);
    expect(metadata?.dependencies.has('age')).toBe(false);
  });

  it('should support fine-grained subscriptions', () => {
    const store = createStoreWithMetadata({ count: 0, name: 'John' });
    
    const slice = store.createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        count: () => count(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        )
      })
    );
    
    const metadata = store.getMetadata(slice);
    const listener = vi.fn();
    const unsubscribe = metadata!.subscribe(listener);
    
    // Should only track count dependency
    expect(metadata?.dependencies.size).toBe(1);
    expect(metadata?.dependencies.has('count')).toBe(true);
    
    slice().increment();
    expect(listener).toHaveBeenCalled();
    
    unsubscribe();
  });
});