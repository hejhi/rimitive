import { describe, it, expect, vi } from 'vitest';
import { createStore } from './component';
import { withLogger } from './middleware';
import type { ComponentFactory, StoreConfig } from './runtime-types';

describe('Component Middleware', () => {
  it('should apply logger middleware', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    type CounterState = { count: number };

    const Counter: ComponentFactory<CounterState> = ({ store, set }) => {
      return {
        count: store.count,
        increment: () => set(store.count, store.count() + 1),
      };
    };

    const store = createStore(withLogger({ count: 0 }));
    const component = Counter(store);

    component.increment();

    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', {
      count: 1,
    });
    expect(component.count()).toBe(1);

    consoleSpy.mockRestore();
  });

  it('should work without middleware', () => {
    type CounterState = { count: number };

    const Counter: ComponentFactory<CounterState> = ({ store, set }) => {
      return {
        count: store.count,
        increment: () => set(store.count, store.count() + 1),
      };
    };

    const store = createStore({ count: 0 });
    const component = Counter(store);

    component.increment();
    expect(component.count()).toBe(1);
  });

  it('should compose multiple middleware', () => {
    const middleware1Calls: string[] = [];
    const middleware2Calls: string[] = [];

    const withMiddleware1 = <State extends Record<string, any>>(
      state: State
    ): StoreConfig<State> => ({
      state,
      enhancer: (context) => {
        middleware1Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware1Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      },
    });

    const withMiddleware2 = <State extends Record<string, any>>(
      state: State
    ): StoreConfig<State> => ({
      state,
      enhancer: (context) => {
        middleware2Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware2Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      },
    });

    type CounterState = { count: number };

    const Counter: ComponentFactory<CounterState> = ({ store, set }) => {
      return {
        count: store.count,
        increment: () => set(store.count, store.count() + 1),
      };
    };

    // For now, manually compose the enhancers
    const config1 = withMiddleware1({ count: 0 });
    const config2 = withMiddleware2({ count: 0 });
    
    const store = createStore({
      state: config1.state,
      enhancer: (ctx) => {
        const ctx1 = config1.enhancer ? config1.enhancer(ctx) : ctx;
        return config2.enhancer ? config2.enhancer(ctx1) : ctx1;
      }
    });
    const component = Counter(store);

    // Both middleware should initialize
    expect(middleware1Calls).toContain('init');
    expect(middleware2Calls).toContain('init');

    component.increment();

    // Both should wrap set (in reverse order - middleware2 wraps middleware1)
    expect(middleware2Calls).toContain('set');
    expect(middleware1Calls).toContain('set');
    expect(component.count()).toBe(1);
  });
});
