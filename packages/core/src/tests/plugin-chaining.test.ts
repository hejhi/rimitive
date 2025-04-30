import { describe, it, expect } from 'vitest';
import { createAPI } from '../api';
import { createLattice } from '../lattice';
import { createProps, mergeProps } from '../props';
import {
  ApiMethods,
  TypedPlugin,
  LatticeWithPlugins,
  PropsStore,
  Lattice,
  PluginResult,
} from '../types';

describe('Plugin Chaining', () => {
  it('should allow chaining multiple plugins with proper state sharing and API merging', () => {
    // Create a base API
    interface BaseApi extends ApiMethods {
      count: number;
      increment: () => void;
      decrement: () => void;
    }

    const { api: baseApi, hooks: baseHooks } = createAPI<{}, BaseApi>(
      {},
      (set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        decrement: () => set((state) => ({ count: state.count - 1 })),
      })
    );

    // Create base props
    interface BaseState {
      count: number;
    }

    const baseProps = createProps<{ baseApi: typeof baseApi }>(
      'counter',
      { baseApi },
      (get) => {
        const state = get() as unknown as BaseState;
        return {
          role: 'button',
          'aria-label': 'Counter',
          'data-count': state.count,
        };
      }
    );

    // Create a base lattice
    const baseLattice = createLattice('base', {
      api: baseApi,
      hooks: baseHooks,
      props: { counter: baseProps },
    });

    // First plugin: doubles the counter
    interface DoubleApi extends ApiMethods {
      doubleCount: number;
      double: () => void;
    }

    const doublePlugin = ((baseLattice) => {
      const { api: doubleApi, hooks: doubleHooks } = createAPI<{}, DoubleApi>(
        {},
        (set) => ({
          doubleCount: 0,
          double: () =>
            set((state) => ({ doubleCount: state.doubleCount + 2 })),
        })
      );

      interface DoubleState {
        doubleCount: number;
      }

      const doubleProps = createProps<{ doubleApi: typeof doubleApi }>(
        'doubleCounter',
        { doubleApi },
        (get) => {
          const state = get() as unknown as DoubleState;
          return {
            'data-double-count': state.doubleCount,
            className: 'doubled',
          };
        }
      );

      // Merge props
      const mergedCounterProps = mergeProps([
        baseLattice.props.counter as PropsStore,
        doubleProps,
      ]);

      // Type assertion to access base API
      const typedBaseLatticeApi = baseLattice.api as unknown as BaseApi;

      // Create enhanced lattice
      const enhancedLattice: LatticeWithPlugins = {
        api: {
          ...baseLattice.api,
          ...doubleApi,
          // We need a custom implementation for the use property
          use: baseLattice.api.use,
          // Ensure property accessors work correctly
          get count() {
            return typedBaseLatticeApi.count;
          },
          get doubleCount() {
            return doubleApi.doubleCount;
          },
          // Override methods
          increment() {
            typedBaseLatticeApi.increment();
            return;
          },
          double() {
            doubleApi.double();
            return;
          },
        },
        hooks: {
          before: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.before(methodName, hook);
            } else if (methodName in doubleApi) {
              doubleHooks.before(methodName, hook);
            }
            return baseLattice.api;
          },
          after: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.after(methodName, hook);
            } else if (methodName in doubleApi) {
              doubleHooks.after(methodName, hook);
            }
            return baseLattice.api;
          },
        },
        props: {
          ...baseLattice.props,
          counter: mergedCounterProps,
        },
        use<P extends TypedPlugin<Lattice, Lattice>>(
          plugin: P
        ): LatticeWithPlugins<PluginResult<Lattice, P>> {
          return plugin(this as unknown as Lattice) as LatticeWithPlugins<
            PluginResult<Lattice, P>
          >;
        },
      };

      return enhancedLattice;
    }) as TypedPlugin;

    // Second plugin: multiplies the counter by 3
    interface TripleApi extends ApiMethods {
      tripleCount: number;
      triple: () => void;
    }

    const triplePlugin = ((baseLattice) => {
      const { api: tripleApi, hooks: tripleHooks } = createAPI<{}, TripleApi>(
        {},
        (set) => ({
          tripleCount: 0,
          triple: () =>
            set((state) => ({ tripleCount: state.tripleCount + 3 })),
        })
      );

      interface TripleState {
        tripleCount: number;
      }

      const tripleProps = createProps<{ tripleApi: typeof tripleApi }>(
        'tripleCounter',
        { tripleApi },
        (get) => {
          const state = get() as unknown as TripleState;
          return {
            'data-triple-count': state.tripleCount,
            'data-multiplier': '3',
          };
        }
      );

      // Type assertions to access base lattice APIs
      const mergedCounterProps = mergeProps([
        baseLattice.props.counter as PropsStore,
        tripleProps,
      ]);

      // Type assertion for existing API methods
      const typedBaseLatticeApi = baseLattice.api as unknown as BaseApi &
        DoubleApi;

      // Create enhanced lattice
      const enhancedLattice: LatticeWithPlugins = {
        api: {
          ...baseLattice.api,
          ...tripleApi,
          use: baseLattice.api.use,
          // Ensure property accessors work correctly
          get count() {
            return typedBaseLatticeApi.count;
          },
          get doubleCount() {
            return typedBaseLatticeApi.doubleCount;
          },
          get tripleCount() {
            return tripleApi.tripleCount;
          },
          // Override methods to ensure state consistency
          increment() {
            typedBaseLatticeApi.increment();
            return;
          },
          double() {
            typedBaseLatticeApi.double();
            return;
          },
          triple() {
            tripleApi.triple();
            return;
          },
        },
        hooks: {
          before: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.before(methodName, hook);
            } else if (methodName in tripleApi) {
              tripleHooks.before(methodName, hook);
            }
            return baseLattice.api;
          },
          after: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.after(methodName, hook);
            } else if (methodName in tripleApi) {
              tripleHooks.after(methodName, hook);
            }
            return baseLattice.api;
          },
        },
        props: {
          ...baseLattice.props,
          counter: mergedCounterProps,
        },
        use<P extends TypedPlugin<Lattice, Lattice>>(
          plugin: P
        ): LatticeWithPlugins<PluginResult<Lattice, P>> {
          return plugin(this as unknown as Lattice) as LatticeWithPlugins<
            PluginResult<Lattice, P>
          >;
        },
      };

      return enhancedLattice;
    }) as TypedPlugin;

    // Chain plugins onto base lattice
    const enhancedLattice = baseLattice.use(doublePlugin).use(triplePlugin);

    // Access the fully enhanced API with type assertion
    const typedApi = enhancedLattice.api as unknown as BaseApi &
      DoubleApi &
      TripleApi;

    // Test state initialization
    expect(typedApi.count).toBe(0);
    expect(typedApi.doubleCount).toBe(0);
    expect(typedApi.tripleCount).toBe(0);

    // Verify method existence
    expect(typeof typedApi.increment).toBe('function');
    expect(typeof typedApi.double).toBe('function');
    expect(typeof typedApi.triple).toBe('function');

    // Test method functionality and state propagation
    typedApi.increment();
    expect(typedApi.count).toBe(1);

    typedApi.double();
    expect(typedApi.doubleCount).toBe(2);

    typedApi.triple();
    expect(typedApi.tripleCount).toBe(3);

    // Test hooks propagation
    let beforeIncrementCalled = false;
    let afterTripleCalled = false;

    enhancedLattice.hooks.before('increment', () => {
      beforeIncrementCalled = true;
    });

    enhancedLattice.hooks.after('triple', () => {
      afterTripleCalled = true;
    });

    typedApi.increment();
    expect(beforeIncrementCalled).toBe(true);

    typedApi.triple();
    expect(afterTripleCalled).toBe(true);

    // Test props merging across all plugin layers
    const counterProps = enhancedLattice.props.counter!.getState()({});
    expect(counterProps.role).toBe('button');
    expect(counterProps['aria-label']).toBe('Counter');
    expect(counterProps['data-count']).toBe(2); // After second increment
    expect(counterProps['data-double-count']).toBe(2); // From double plugin
    expect(counterProps['data-triple-count']).toBe(6); // From triple plugin - only called once now
    expect(counterProps.className).toBe('doubled'); // From double plugin
    expect(counterProps['data-multiplier']).toBe('3'); // From triple plugin
  });
});
