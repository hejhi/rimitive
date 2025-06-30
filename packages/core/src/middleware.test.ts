import { describe, it, expect, vi } from 'vitest';
import { createComponent, withState, createStore } from './component';
import { withLogger } from './middleware';
import type { ComponentMiddleware } from './runtime-types';
import type { FromMarker } from './component-types';

describe('Component Middleware', () => {
  it('should apply logger middleware', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    type CounterState = { count: number };

    const Counter = createComponent(
      withLogger(withState<CounterState>()),
      ({ store, set }) => {
        return {
          count: store.count,
          increment: () => set(store.count, store.count() + 1),
        };
      }
    );

    const store = createStore(Counter, { count: 0 });

    store.increment();

    expect(consoleSpy).toHaveBeenCalledWith('[Lattice Logger] State update:', {
      count: 1,
    });
    expect(store.count()).toBe(1);

    consoleSpy.mockRestore();
  });

  it('should work without middleware', () => {
    type CounterState = { count: number };

    const Counter = createComponent(
      withState<CounterState>(),
      ({ store, set }) => {
        return {
          count: store.count,
          increment: () => set(store.count, store.count() + 1),
        };
      }
    );

    const store = createStore(Counter, { count: 0 });

    store.increment();
    expect(store.count()).toBe(1);
  });

  it('should compose multiple middleware', () => {
    const middleware1Calls: string[] = [];
    const middleware2Calls: string[] = [];

    const middleware1 = <State extends Record<string, any>>() => (marker: FromMarker<State>) => {
      const mw: ComponentMiddleware<State> = (context) => {
        middleware1Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware1Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      };
      return {
        ...marker,
        _middleware: [...marker._middleware, mw],
      };
    };

    const middleware2 = <State extends Record<string, any>>() => (marker: FromMarker<State>) => {
      const mw: ComponentMiddleware<State> = (context) => {
        middleware2Calls.push('init');
        const originalSet = context.set;
        context.set = ((signal: any, updates: any) => {
          middleware2Calls.push('set');
          originalSet(signal, updates);
        }) as typeof context.set;
        return context;
      };
      return {
        ...marker,
        _middleware: [...marker._middleware, mw],
      };
    };

    type CounterState = { count: number };

    const Counter = createComponent(
      middleware2<CounterState>()(middleware1<CounterState>()(withState<CounterState>())),
      ({ store, set }) => {
        return {
          count: store.count,
          increment: () => set(store.count, store.count() + 1),
        };
      }
    );

    const store = createStore(Counter, { count: 0 });

    // Both middleware should initialize
    expect(middleware1Calls).toContain('init');
    expect(middleware2Calls).toContain('init');

    store.increment();

    // Both should wrap set (in reverse order - middleware2 wraps middleware1)
    expect(middleware2Calls).toContain('set');
    expect(middleware1Calls).toContain('set');
    expect(store.count!()).toBe(1);
  });
});
