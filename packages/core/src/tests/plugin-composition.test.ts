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

describe('Plugin Composition', () => {
  it('should apply plugin to base lattice and merge APIs correctly', () => {
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

    // Create base props with properly typed getter and state
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

    // Define interface for enhanced lattice
    interface EnhancedApi extends ApiMethods {
      doubleCount: number;
      double: () => void;
    }

    // Create a plugin that adds new functionality
    const counterEnhancerPlugin = ((baseLattice) => {
      // Create enhanced API
      const { api: enhancedApi, hooks: enhancedHooks } = createAPI<
        {},
        EnhancedApi
      >({}, (set) => ({
        doubleCount: 0,
        double: () => set((state) => ({ doubleCount: state.doubleCount + 2 })),
      }));

      // Create enhanced props with properly typed getter
      interface EnhancedState {
        doubleCount: number;
      }

      const enhancedProps = createProps<{ enhancedApi: typeof enhancedApi }>(
        'enhancedCounter',
        { enhancedApi },
        (get) => {
          const state = get() as unknown as EnhancedState;
          return {
            'data-double-count': state.doubleCount,
            className: 'enhanced',
          };
        }
      );

      // Create merged props for counter, with null check
      const mergedCounterProps = mergeProps([
        baseLattice.props.counter as PropsStore, // We're certain it exists from our setup
        enhancedProps,
      ]);

      // Get access to the increment method with proper typing
      const typedBaseLatticeApi = baseLattice.api as unknown as BaseApi;

      // Return a new lattice with merged capabilities
      const mergedLattice: LatticeWithPlugins = {
        api: {
          ...baseLattice.api, // Include all properties from the base API
          ...enhancedApi, // Include all properties from the enhanced API
          // We need a custom implementation for the use property
          use: {
            ...baseLattice.api.use,
            ...enhancedApi.use,
          },
          // Ensure the property accessors work correctly
          get count() {
            return typedBaseLatticeApi.count;
          },
          get doubleCount() {
            return enhancedApi.doubleCount;
          },
          // Override the methods to ensure they update the appropriate state
          increment() {
            typedBaseLatticeApi.increment();
            return;
          },
          double() {
            enhancedApi.double();
            return;
          },
        },
        hooks: {
          before: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.before(methodName, hook);
            } else if (methodName in enhancedApi) {
              enhancedHooks.before(methodName, hook);
            }
            return baseLattice.api;
          },
          after: (methodName, hook) => {
            if (methodName in baseLattice.api) {
              baseLattice.hooks.after(methodName, hook);
            } else if (methodName in enhancedApi) {
              enhancedHooks.after(methodName, hook);
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
          // The plugin will return a new lattice with the plugin applied
          return plugin(this as unknown as Lattice) as LatticeWithPlugins<
            PluginResult<Lattice, P>
          >;
        },
      };

      return mergedLattice;
    }) as TypedPlugin;

    // Apply the plugin to the base lattice
    const enhancedLattice = baseLattice.use(counterEnhancerPlugin);

    // Use type assertion with an intermediate unknown step for safety
    const typedApi = enhancedLattice.api as unknown as BaseApi & EnhancedApi;

    // Verify that the original API methods are still accessible
    expect(typedApi.count).toBe(0);
    expect(typeof typedApi.increment).toBe('function');
    expect(typeof typedApi.decrement).toBe('function');

    // Verify that the enhanced API methods are accessible
    expect(typedApi.doubleCount).toBe(0);
    expect(typeof typedApi.double).toBe('function');

    // Test that the original API still works correctly
    typedApi.increment();
    expect(typedApi.count).toBe(1); // The improved implementation calls increment only once

    // Test that the enhanced API works correctly
    typedApi.double();
    expect(typedApi.doubleCount).toBe(2);

    // Check that the props are correctly merged
    // Using non-null assertion since we're certain counter exists from setup
    const counterProps = enhancedLattice.props.counter!.getState()({});
    expect(counterProps.role).toBe('button');
    expect(counterProps['aria-label']).toBe('Counter');
    expect(counterProps['data-count']).toBe(1); // Updated from the increment() call
    expect(counterProps['data-double-count']).toBe(2); // Updated from the double() call
    expect(counterProps.className).toBe('enhanced');
  });
});
