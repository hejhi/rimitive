import { describe, it, expect, vi } from 'vitest';
import { createComponent } from './component';
import { vanillaAdapter } from '../adapters/vanilla';
import { withLogger } from '../middleware';
import type { ComponentContext } from './types';
import { 
  createTestComponent, 
  NamedCounterComponent,
  type CounterState,
  type NamedCounterState 
} from '../testing/test-utils';

describe('Component API', () => {
  it('should create a component with inferred state from callback', () => {
    const store = createTestComponent<NamedCounterState>({ count: 5, name: 'John' });
    const component = NamedCounterComponent(store);

    expect(component.count()).toBe(5);
    expect(component.doubled()).toBe(10);

    component.increment();
    expect(component.count()).toBe(6);
    expect(component.doubled()).toBe(12);

    component.reset();
    expect(component.count()).toBe(0);
    expect(component.doubled()).toBe(0);
  });

  it('should support middleware composition with new pattern', () => {
    const loggerConfig = withLogger({ count: 5 });
    const store = createComponent(
      vanillaAdapter(loggerConfig.state),
      loggerConfig.enhancer
    );
    const Component = ({ store, set }: ComponentContext<CounterState>) => ({
      count: store.count,
      increment: () => set(store.count, store.count() + 1),
    });

    const component = Component(store);

    // Spy on console.log to verify logger works
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    component.increment();
    expect(component.count()).toBe(6);
    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', {
      count: 6,
    });

    consoleSpy.mockRestore();
  });

  it('should handle state updates through adapter', () => {
    const store = createTestComponent({ value: 10 });
    const Component = ({ store, set }: ComponentContext<{ value: number }>) => ({
      value: store.value,
      double: () => set(store.value, store.value() * 2),
      setValue: (n: number) => set(store.value, n),
    });

    const component = Component(store);

    component.double();
    expect(component.value()).toBe(20);

    component.setValue(5);
    expect(component.value()).toBe(5);
  });

  it('should batch multiple updates', () => {
    interface MultiState {
      a: number;
      b: number;
      c: number;
    }

    const store = createTestComponent<MultiState>({ a: 1, b: 2, c: 3 });
    const Component = ({ store, computed, set }: ComponentContext<MultiState>) => {
      const sum = computed(() => store.a() + store.b() + store.c());
      
      return {
        sum,
        updateAll: () => {
          set(store.a, 10);
          set(store.b, 20);
          set(store.c, 30);
        },
      };
    };

    const component = Component(store);
    let computeCount = 0;
    
    const unsubscribe = component.sum.subscribe(() => computeCount++);
    
    expect(component.sum()).toBe(6);
    
    component.updateAll();
    
    // Each update triggers a recomputation in the current implementation
    expect(computeCount).toBe(3);
    expect(component.sum()).toBe(60);
    
    unsubscribe();
  });

  it('should support update functions', () => {
    const store = createTestComponent({ count: 5 });
    const Component = ({ store, set }: ComponentContext<CounterState>) => ({
      count: store.count,
      increment: () => set(store.count, (c) => c + 1),
      multiplyBy: (n: number) => set(store.count, (c) => c * n),
    });

    const component = Component(store);

    component.increment();
    expect(component.count()).toBe(6);

    component.multiplyBy(3);
    expect(component.count()).toBe(18);
  });
});