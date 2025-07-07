import { describe, it, expect, vi } from 'vitest';
import { createComponent } from './component';
import { withLogger } from '../middleware';
import type { ComponentContext } from './types';
import {
  createTestComponent,
  NamedCounterComponent,
  type CounterState,
  type NamedCounterState,
} from '../../testing/test-utils';

describe('Component API', () => {
  it('should create a component with inferred state from callback', () => {
    const store = createTestComponent<NamedCounterState>({
      count: 5,
      name: 'John',
    });
    const component = NamedCounterComponent(store);

    expect(component.count.value).toBe(5);
    expect(component.doubled.value).toBe(10);

    component.increment();
    expect(component.count.value).toBe(6);
    expect(component.doubled.value).toBe(12);

    component.reset();
    expect(component.count.value).toBe(0);
    expect(component.doubled.value).toBe(0);
  });

  it('should support middleware composition with new pattern', () => {
    const store = createComponent({ count: 5 });
    const Component = ({ store, set }: ComponentContext<CounterState>) => ({
      count: store.count,
      increment: () => set(store, { count: store.count.value + 1 }),
    });

    const component = Component(withLogger(store));

    // Spy on console.log to verify logger works
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    component.increment();
    expect(component.count.value).toBe(6);
    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', {
      count: 6,
    });

    consoleSpy.mockRestore();
  });

  it('should handle state updates through adapter', () => {
    const store = createTestComponent({ value: 10 });
    const Component = ({
      store,
    }: ComponentContext<{ value: number }>) => ({
      value: store.value,
      double: () => store.value.value = store.value.value * 2,
      setValue: (n: number) => store.value.value = n,
    });

    const component = Component(store);

    component.double();
    expect(component.value.value).toBe(20);

    component.setValue(5);
    expect(component.value.value).toBe(5);
  });

  it('should batch multiple updates', () => {
    interface MultiState {
      a: number;
      b: number;
      c: number;
    }

    const store = createTestComponent<MultiState>({ a: 1, b: 2, c: 3 });
    const Component = ({
      store,
      computed,
      set,
    }: ComponentContext<MultiState>) => {
      const sum = computed(() => store.a.value + store.b.value + store.c.value);

      return {
        sum,
        updateAll: () => {
          set(store, { a: 10, b: 20, c: 30 });
        },
      };
    };

    const component = Component(store);
    let computeCount = 0;

    const unsubscribe = component.sum.subscribe(() => computeCount++);

    expect(component.sum.value).toBe(6);

    component.updateAll();

    // Batch update triggers only one recomputation
    expect(computeCount).toBe(1);
    expect(component.sum.value).toBe(60);

    unsubscribe();
  });

  it('should support update functions', () => {
    const store = createTestComponent({ count: 5 });
    const Component = ({ store }: ComponentContext<CounterState>) => ({
      count: store.count,
      increment: () => store.count.value = store.count.value + 1,
      multiplyBy: (n: number) => store.count.value = store.count.value * n,
    });

    const component = Component(store);

    component.increment();
    expect(component.count.value).toBe(6);

    component.multiplyBy(3);
    expect(component.count.value).toBe(18);
  });
});
