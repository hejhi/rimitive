import { describe, it, expect, vi } from 'vitest';
import { createStore } from './component';
import { withLogger } from './middleware';
import type { ComponentMiddleware, ComponentFactory } from './runtime-types';

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

    const store = createStore({ count: 0 }, [withLogger<CounterState>()]);
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

    const middleware1 = <State extends Record<string, any>>(): ComponentMiddleware<State> => 
      (context) => {
        middleware1Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware1Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      };

    const middleware2 = <State extends Record<string, any>>(): ComponentMiddleware<State> => 
      (context) => {
        middleware2Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware2Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      };

    type CounterState = { count: number };

    const Counter: ComponentFactory<CounterState> = ({ store, set }) => {
      return {
        count: store.count,
        increment: () => set(store.count, store.count() + 1),
      };
    };

    const store = createStore({ count: 0 }, [
      middleware1<CounterState>(),
      middleware2<CounterState>()
    ]);
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
