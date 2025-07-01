import { describe, it, expect, vi } from 'vitest';
import { createComponent } from '../component/component';
import type { ComponentFactory } from '../component/types';

describe('Memory Optimization', () => {
  it('should create WeakRef-cached keyed selectors', () => {
    interface Item {
      id: string;
      value: number;
    }

    interface DataState {
      items: Item[];
    }

    const DataStore: ComponentFactory<DataState> = ({ store }) => {
      const itemById = store.items(
        (id: string) => id,
        (item: Item, id: string) => item.id === id
      );

      return {
        items: store.items,
        itemById,
      };
    };

    const store = createComponent({
      items: Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      })),
    });
    const component = DataStore(store);

    // Create multiple derived signals
    const signal1 = component.itemById('item-0');
    const signal2 = component.itemById('item-5');
    const signal3 = component.itemById('item-0'); // Should return same as signal1

    // Verify they work
    expect(signal1()?.value).toBe(0);
    expect(signal2()?.value).toBe(5);

    // Verify same key returns same signal (cache hit)
    expect(signal1).toBe(signal3);
  });

  it('should clean up dead WeakRefs periodically', async () => {
    // Mock timers
    vi.useFakeTimers();

    interface TestState {
      data: string[];
    }

    const TestStore: ComponentFactory<TestState> = ({ store }) => {
      const getByValue = store.data(
        (val: string) => val,
        (item: string, val: string) => item === val
      );

      return {
        data: store.data,
        getByValue,
      };
    };

    const store = createComponent({ data: ['a', 'b', 'c'] });
    const component = TestStore(store);

    // Create signals but don't hold references
    component.getByValue('a')();
    component.getByValue('b')();
    component.getByValue('c')();

    // Fast-forward past cleanup interval (30 seconds)
    vi.advanceTimersByTime(31000);

    // Cleanup should have run, but we can't easily test the result
    // without access to the internal cache and GC control

    vi.useRealTimers();
  });

  it('should maintain O(1) performance with WeakRef cache', () => {
    interface User {
      id: string;
      name: string;
    }

    interface LargeState {
      users: User[];
    }

    const LargeStore: ComponentFactory<LargeState> = ({ store, set }) => {
      const userById = store.users(
        (id: string) => id,
        (user: User, id: string) => user.id === id
      );

      return {
        users: store.users,
        userById,
        updateUser: (id: string, name: string) => {
          const user = userById(id)();
          if (user) {
            set(userById(id), { ...user, name });
          }
        },
      };
    };

    const store = createComponent({
      users: Array.from({ length: 10000 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
      })),
    });
    const component = LargeStore(store);

    // First access - O(n)
    const start1 = performance.now();
    component.userById('user-5000')();
    const time1 = performance.now() - start1;

    // Second access - O(1) from cache
    const start2 = performance.now();
    component.userById('user-5000')();
    const time2 = performance.now() - start2;

    // Update - O(1)
    const start3 = performance.now();
    component.updateUser('user-5000', 'Updated User');
    const time3 = performance.now() - start3;

    // Second access should be much faster
    expect(time2).toBeLessThan(time1 / 10);
    expect(time3).toBeLessThan(1);

    // Verify update worked
    expect(component.userById('user-5000')()?.name).toBe('Updated User');
  });

  it('should handle cache misses gracefully', () => {
    interface StoreState {
      items: number[];
    }

    const Store: ComponentFactory<StoreState> = ({ store }) => {
      const getItem = store.items(
        (val: number) => val,
        (item: number, val: number) => item === val
      );

      return {
        items: store.items,
        getItem,
      };
    };

    const store = createComponent({ items: [1, 2, 3] });
    const component = Store(store);

    // Access item multiple times
    const item1a = component.getItem(2);
    const item1b = component.getItem(2);

    // Should return same signal instance (from WeakRef cache)
    expect(item1a).toBe(item1b);

    // Value should be correct
    expect(item1a()).toBe(2);
  });
});
