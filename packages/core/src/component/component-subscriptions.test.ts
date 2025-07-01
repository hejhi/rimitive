import { describe, it, expect } from 'vitest';
import type { ComponentContext } from './types';
import {
  createTestComponent,
  CounterComponent,
  type NamedCounterState,
} from '../../testing/test-utils';

describe('Component Subscriptions', () => {
  it('should support fine-grained subscriptions', () => {
    const Counter = ({ store, set }: ComponentContext<NamedCounterState>) => {
      return {
        count: store.count,
        name: store.name,
        increment: () => set(store.count, store.count() + 1),
        setName: (n: string) => set(store.name, n),
      };
    };

    const store = createTestComponent({ count: 0, name: 'initial' });
    const component = Counter(store);

    let countUpdates = 0;
    let nameUpdates = 0;

    const unsubCount = component.count.subscribe(() => countUpdates++);
    const unsubName = component.name.subscribe(() => nameUpdates++);

    component.increment();
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(0);

    component.setName('updated');
    expect(countUpdates).toBe(1);
    expect(nameUpdates).toBe(1);

    unsubCount();
    unsubName();

    component.increment();
    expect(countUpdates).toBe(1); // No more updates after unsubscribe
    expect(nameUpdates).toBe(1);
  });

  it('should update computed values when dependencies change', () => {
    interface MultiState {
      a: number;
      b: number;
    }

    const Multi = ({ store, computed, set }: ComponentContext<MultiState>) => {
      const sum = computed(() => store.a() + store.b());

      return {
        a: store.a,
        b: store.b,
        sum,
        updateBoth: () => {
          set(store.a, store.a() + 1);
          set(store.b, store.b() + 1);
        },
      };
    };

    const store = createTestComponent({ a: 1, b: 2 });
    const component = Multi(store);

    expect(component.sum()).toBe(3);

    component.updateBoth();
    expect(component.sum()).toBe(5);

    // Verify individual updates work too
    store.set(store.store.a, 10);
    expect(component.sum()).toBe(13); // 10 + 3 (b is still 3 from updateBoth)
  });

  it('should handle subscription cleanup', () => {
    const store = createTestComponent({ count: 0 });
    const component = CounterComponent(store);

    const subscriptions: (() => void)[] = [];
    let totalUpdates = 0;

    // Create multiple subscriptions
    for (let i = 0; i < 5; i++) {
      subscriptions.push(component.count.subscribe(() => totalUpdates++));
    }

    component.increment();
    expect(totalUpdates).toBe(5); // All 5 subscriptions fired

    // Unsubscribe some
    subscriptions[0]?.();
    subscriptions[1]?.();

    totalUpdates = 0;
    component.increment();
    expect(totalUpdates).toBe(3); // Only 3 remaining subscriptions

    // Cleanup rest
    subscriptions.slice(2).forEach((unsub) => unsub());

    totalUpdates = 0;
    component.increment();
    expect(totalUpdates).toBe(0); // No subscriptions left
  });

  it('should support computed value subscriptions', () => {
    interface State {
      items: string[];
      filter: string;
    }

    const Filtered = ({ store, computed }: ComponentContext<State>) => {
      const filtered = computed(() =>
        store.items().filter((item) => item.includes(store.filter()))
      );

      return {
        items: store.items,
        filter: store.filter,
        filtered,
      };
    };

    const store = createTestComponent({
      items: ['apple', 'banana', 'cherry'],
      filter: 'a',
    });
    const component = Filtered(store);

    let filterUpdates = 0;
    const unsubscribe = component.filtered.subscribe(() => filterUpdates++);

    expect(component.filtered()).toEqual(['apple', 'banana']);

    // Changing filter should trigger update
    store.set(store.store.filter, 'e');
    expect(filterUpdates).toBe(1);
    expect(component.filtered()).toEqual(['apple', 'cherry']);

    // Changing items should also trigger update
    store.set(store.store.items, [...store.store.items(), 'elderberry']);
    expect(filterUpdates).toBe(2);
    expect(component.filtered()).toEqual(['apple', 'cherry', 'elderberry']);

    unsubscribe();
  });
});
