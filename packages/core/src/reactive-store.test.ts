import { describe, expect, it, vi } from 'vitest';
import { createReactiveStore } from './reactive-store';

describe('createReactiveStore', () => {
  it('should create a store with reactive slices', () => {
    const createSlice = createReactiveStore({ count: 0, name: 'John' });
    
    const slice = createSlice(
      (selectors) => ({
        count: selectors.count,
        name: selectors.name,
      }),
      ({ count, name }, set) => ({
        count: () => count(),
        name: () => name(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        ),
        setName: (newName: string) => set(
          (selectors) => ({ name: selectors.name }),
          ({ name }) => ({ name: newName })
        ),
      })
    );
    
    expect(slice.count()).toBe(0);
    expect(slice.name()).toBe('John');
    
    slice.increment();
    expect(slice.count()).toBe(1);
    
    slice.setName('Jane');
    expect(slice.name()).toBe('Jane');
  });

  it('should track dependencies correctly', () => {
    const createSlice = createReactiveStore({ count: 0, name: 'John', age: 30 });
    
    const slice = createSlice(
      (selectors) => ({
        count: selectors.count,
        name: selectors.name,
        // Note: age is not accessed
      }),
      ({ count, name }) => ({
        summary: () => `${name()} has count: ${count()}`,
      })
    );
    
    // Should only depend on count and name
    expect(slice._dependencies.has('count')).toBe(true);
    expect(slice._dependencies.has('name')).toBe(true);
    expect(slice._dependencies.has('age')).toBe(false);
  });

  it('should support fine-grained subscriptions', () => {
    const createSlice = createReactiveStore({ count: 0, name: 'John' });
    
    const slice = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        count: () => count(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        ),
      })
    );
    
    const listener = vi.fn();
    const unsubscribe = slice._subscribe(listener);
    
    // Should only track count dependency
    expect(slice._dependencies.size).toBe(1);
    expect(slice._dependencies.has('count')).toBe(true);
    
    slice.increment();
    expect(listener).toHaveBeenCalled();
    
    unsubscribe();
  });

  it('should work with custom adapter supporting keyed subscriptions', () => {
    let state = { count: 0, name: 'John' };
    const keyedListeners = new Map<Set<string>, Set<() => void>>();
    
    const adapter = {
      getState: () => state,
      setState: (updates: any) => {
        const changedKeys = new Set<string>();
        for (const key in updates) {
          if (!Object.is(state[key], updates[key])) {
            changedKeys.add(key);
          }
        }
        
        if (changedKeys.size > 0) {
          state = { ...state, ...updates };
          
          // Notify keyed listeners
          for (const [keys, listeners] of keyedListeners) {
            const shouldNotify = [...keys].some(key => changedKeys.has(key));
            if (shouldNotify) {
              listeners.forEach(listener => listener());
            }
          }
        }
      },
      subscribe: vi.fn(() => () => {}),
      subscribeToKeys: vi.fn((keys: Set<string>, listener: () => void) => {
        if (!keyedListeners.has(keys)) {
          keyedListeners.set(keys, new Set());
        }
        keyedListeners.get(keys)!.add(listener);
        
        return () => {
          const listeners = keyedListeners.get(keys);
          if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
              keyedListeners.delete(keys);
            }
          }
        };
      }),
    };
    
    const createSlice = createReactiveStore(state, adapter);
    
    const countSlice = createSlice(
      (selectors) => ({ count: selectors.count }),
      ({ count }, set) => ({
        count: () => count(),
        increment: () => set(
          (selectors) => ({ count: selectors.count }),
          ({ count }) => ({ count: count() + 1 })
        ),
      })
    );
    
    const nameSlice = createSlice(
      (selectors) => ({ name: selectors.name }),
      ({ name }, set) => ({
        name: () => name(),
        setName: (newName: string) => set(
          (selectors) => ({ name: selectors.name }),
          ({ name }) => ({ name: newName })
        ),
      })
    );
    
    const countListener = vi.fn();
    const nameListener = vi.fn();
    
    countSlice._subscribe(countListener);
    nameSlice._subscribe(nameListener);
    
    // Changing count should only notify count listener
    countSlice.increment();
    expect(countListener).toHaveBeenCalledTimes(1);
    expect(nameListener).toHaveBeenCalledTimes(0);
    
    // Changing name should only notify name listener
    nameSlice.setName('Jane');
    expect(countListener).toHaveBeenCalledTimes(1);
    expect(nameListener).toHaveBeenCalledTimes(1);
  });

  it('should support two-phase set pattern', () => {
    const createSlice = createReactiveStore({ x: 0, y: 0, z: 0 });
    
    const slice = createSlice(
      (selectors) => ({
        x: selectors.x,
        y: selectors.y,
        z: selectors.z,
      }),
      ({ x, y, z }, set) => ({
        x: () => x(),
        y: () => y(),
        z: () => z(),
        moveX: (delta: number) => set(
          (selectors) => ({ x: selectors.x }),
          ({ x }) => ({ x: x() + delta })
        ),
        moveXY: (deltaX: number, deltaY: number) => set(
          (selectors) => ({ x: selectors.x, y: selectors.y }),
          ({ x, y }) => ({ x: x() + deltaX, y: y() + deltaY })
        ),
        reset: () => set(
          (selectors) => selectors,
          () => ({ x: 0, y: 0, z: 0 })
        ),
      })
    );
    
    slice.moveX(5);
    expect(slice.x()).toBe(5);
    expect(slice.y()).toBe(0);
    
    slice.moveXY(3, 7);
    expect(slice.x()).toBe(8);
    expect(slice.y()).toBe(7);
    
    slice.reset();
    expect(slice.x()).toBe(0);
    expect(slice.y()).toBe(0);
    expect(slice.z()).toBe(0);
  });
});