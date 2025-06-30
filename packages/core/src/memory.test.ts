import { describe, it, expect, vi } from 'vitest';
import { createComponent, withState, createStore } from './component';

describe('Memory Optimization', () => {
  it('should create WeakRef-cached keyed selectors', () => {
    const DataStore = createComponent(
      withState(() => ({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item-${i}`,
          value: i
        }))
      })),
      ({ store }) => {
        const itemById = store.items(
          (id: string) => id,
          (item, id) => item.id === id
        );
        
        return {
          items: store.items,
          itemById
        };
      }
    );

    const store = createStore(DataStore, {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        value: i
      }))
    });

    // Create multiple derived signals
    const signal1 = store.itemById('item-0');
    const signal2 = store.itemById('item-5');
    const signal3 = store.itemById('item-0'); // Should return same as signal1
    
    // Verify they work
    expect(signal1()?.value).toBe(0);
    expect(signal2()?.value).toBe(5);
    
    // Verify same key returns same signal (cache hit)
    expect(signal1).toBe(signal3);
  });

  it('should clean up dead WeakRefs periodically', async () => {
    // Mock timers
    vi.useFakeTimers();
    
    const TestStore = createComponent(
      withState(() => ({ data: ['a', 'b', 'c'] })),
      ({ store }) => {
        const getByValue = store.data(
          (val: string) => val,
          (item, val) => item === val
        );
        
        return {
          data: store.data,
          getByValue
        };
      }
    );

    const store = createStore(TestStore, { data: ['a', 'b', 'c'] });
    
    // Create signals but don't hold references
    store.getByValue('a')();
    store.getByValue('b')();
    store.getByValue('c')();
    
    // Fast-forward past cleanup interval (30 seconds)
    vi.advanceTimersByTime(31000);
    
    // Cleanup should have run, but we can't easily test the result
    // without access to the internal cache and GC control
    
    vi.useRealTimers();
  });

  it('should maintain O(1) performance with WeakRef cache', () => {
    const LargeStore = createComponent(
      withState(() => ({
        users: Array.from({ length: 10000 }, (_, i) => ({
          id: `user-${i}`,
          name: `User ${i}`
        }))
      })),
      ({ store, set }) => {
        const userById = store.users(
          (id: string) => id,
          (user, id) => user.id === id
        );
        
        return {
          users: store.users,
          userById,
          updateUser: (id: string, name: string) => {
            const user = userById(id)();
            if (user) {
              set(userById(id), { ...user, name });
            }
          }
        };
      }
    );

    const store = createStore(LargeStore, {
      users: Array.from({ length: 10000 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`
      }))
    });
    
    // First access - O(n)
    const start1 = performance.now();
    const user1 = store.userById('user-5000')();
    const time1 = performance.now() - start1;
    
    // Second access - O(1) from cache
    const start2 = performance.now();
    const user2 = store.userById('user-5000')();
    const time2 = performance.now() - start2;
    
    // Update - O(1)
    const start3 = performance.now();
    store.updateUser('user-5000', 'Updated User');
    const time3 = performance.now() - start3;
    
    // Second access should be much faster
    expect(time2).toBeLessThan(time1 / 10);
    expect(time3).toBeLessThan(1);
    
    // Verify update worked
    expect(store.userById('user-5000')()?.name).toBe('Updated User');
  });

  it('should handle cache misses gracefully', () => {
    const Store = createComponent(
      withState(() => ({ items: [1, 2, 3] })),
      ({ store }) => {
        const getItem = store.items(
          (val: number) => val,
          (item, val) => item === val
        );
        
        return {
          items: store.items,
          getItem
        };
      }
    );

    const store = createStore(Store, { items: [1, 2, 3] });
    
    // Access item multiple times
    const item1a = store.getItem(2);
    const item1b = store.getItem(2);
    
    // Should return same signal instance (from WeakRef cache)
    expect(item1a).toBe(item1b);
    
    // Value should be correct
    expect(item1a()).toBe(2);
  });
});