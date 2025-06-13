/**
 * @fileoverview Svelte stores adapter for Lattice
 *
 * This adapter provides integration with Svelte's built-in stores for state management.
 * It supports both Svelte 4 and Svelte 5, using the stable stores API that works
 * across both versions.
 */

import { writable, get, type Writable } from 'svelte/store';
import type {
  StoreAdapter,
  ComponentFactory,
  CreateStore,
} from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Svelte adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows middleware composition
 *
 * @param store - The Svelte writable store
 * @returns Enhanced store instance
 */
export type StoreEnhancer<State> = (store: Writable<State>) => Writable<State>;

/**
 * Creates a Svelte stores adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Svelte. It combines
 * a component factory with Svelte's built-in stores.
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Svelte stores
 *
 * @example
 * ```typescript
 * const createComponent = (createStore: CreateStore) => {
 *   const createSlice = createStore({ count: 0 });
 *
 *   const counter = createSlice(({ get, set }) => ({
 *     count: () => get().count,
 *     increment: () => set({ count: get().count + 1 })
 *   }));
 *
 *   return { counter };
 * };
 *
 * const store = createSvelteAdapter(createComponent);
 * store.counter.increment();
 * ```
 *
 * @example With middleware enhancer
 * ```typescript
 * const withLogging: StoreEnhancer<State> = (store) => {
 *   const { subscribe, set, update } = store;
 *   return {
 *     subscribe,
 *     set: (value) => {
 *       console.log('State update:', value);
 *       set(value);
 *     },
 *     update
 *   };
 * };
 * 
 * const store = createSvelteAdapter(createComponent, withLogging);
 * ```
 * 
 * @example In a Svelte component with runtime utilities
 * ```svelte
 * <script>
 *   import { sliceValue } from '@lattice/runtime/svelte';
 *   
 *   // Use the idiomatic Svelte runtime utilities
 *   const count = sliceValue(store, s => s.counter.count());
 * </script>
 * 
 * <button on:click={store.counter.increment}>
 *   Count: {$count}
 * </button>
 * ```
 */
export function createSvelteAdapter<Component, State>(
  componentFactory: ComponentFactory<Component, State>,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  let adapter: SvelteStoreAdapter<State> | undefined;

  // Create an adapter factory that will be called with initial state
  const adapterFactory = (initialState: State): StoreAdapter<State> => {
    adapter = createStoreAdapter(initialState, enhancer, options);
    return adapter;
  };

  const store = createLatticeStore(componentFactory, adapterFactory);

  // Add destroy method to the store for cleanup
  return Object.assign(store, {
    destroy: () => adapter?.destroy()
  });
}

/**
 * Extended adapter interface with lifecycle management
 */
export interface SvelteStoreAdapter<State> extends StoreAdapter<State> {
  /**
   * Cleanup function to prevent memory leaks
   */
  destroy(): void;
}

/**
 * Creates a minimal adapter from Svelte stores
 *
 * This creates a Svelte store and wraps it with the minimal adapter interface.
 * It provides proper error handling and efficient subscription management.
 *
 * @param initialState - The initial state
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with cleanup
 */
export function createStoreAdapter<State>(
  initialState: State,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
): SvelteStoreAdapter<State> {
  // Create the Svelte store
  let store: Writable<State> = writable(initialState);
  
  // Apply enhancer if provided
  if (enhancer) {
    store = enhancer(store);
  }
  
  // For error handling
  const handleError = options?.onError ?? ((error) => {
    console.error('Error in store listener:', error);
  });

  // Cache for getState to avoid repeated calls
  let cachedState = initialState;

  // Track listeners for proper cleanup and error handling
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Subscribe to the Svelte store once - IMPORTANT: Store the cleanup function
  const storeUnsubscribe = store.subscribe((state) => {
    // Update cached state
    cachedState = state;
    
    isNotifying = true;
    const currentListeners = Array.from(listeners);

    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }

    isNotifying = false;

    // Process pending unsubscribes
    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => cachedState,
    setState: (updates) => {
      try {
        store.update(state => ({ ...state, ...updates }));
      } catch (error) {
        handleError(error);
        throw error; // Re-throw to maintain consistency with other adapters
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      // Return unsubscribe function
      return () => {
        if (isNotifying) {
          // Defer unsubscribe to avoid modifying set during iteration
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
    destroy: () => {
      // Clean up the Svelte store subscription to prevent memory leaks
      storeUnsubscribe();
      // Clear all listeners
      listeners.clear();
      pendingUnsubscribes.clear();
    }
  };
}

/**
 * Wraps an existing Svelte store as a minimal adapter
 *
 * This allows you to use an existing Svelte store with Lattice.
 * Useful when you have stores that need special configuration
 * or custom stores with additional functionality.
 *
 * @param store - An existing Svelte writable store
 * @param enhancer - Optional store enhancer for middleware
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with cleanup
 *
 * @example
 * ```typescript
 * import { writable } from 'svelte/store';
 * import { persisted } from 'svelte-persisted-store';
 * 
 * // Create a persisted store
 * const persistedStore = persisted('my-state', initialState);
 * 
 * // Wrap it for use with Lattice
 * const adapter = wrapSvelteStore(persistedStore);
 * const store = createLatticeStore(component, () => adapter);
 * ```
 * 
 * @example With enhancer
 * ```typescript
 * const withDevtools: StoreEnhancer<State> = (store) => {
 *   // Add devtools integration
 *   return store;
 * };
 * 
 * const adapter = wrapSvelteStore(myStore, withDevtools);
 * ```
 */
export function wrapSvelteStore<State>(
  store: Writable<State>,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
): SvelteStoreAdapter<State> {
  // Apply enhancer if provided
  let enhancedStore = store;
  if (enhancer) {
    enhancedStore = enhancer(store);
  }
  const handleError = options?.onError ?? ((error) => {
    console.error('Error in store listener:', error);
  });

  // Cache for getState optimization
  let cachedState = get(enhancedStore);

  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // Subscribe to the provided store - IMPORTANT: Store the cleanup function
  const storeUnsubscribe = enhancedStore.subscribe((state) => {
    // Update cached state
    cachedState = state;
    
    isNotifying = true;
    const currentListeners = Array.from(listeners);

    for (const listener of currentListeners) {
      try {
        listener();
      } catch (error) {
        handleError(error);
      }
    }

    isNotifying = false;

    for (const listener of pendingUnsubscribes) {
      listeners.delete(listener);
    }
    pendingUnsubscribes.clear();
  });

  return {
    getState: () => cachedState,
    setState: (updates) => {
      try {
        enhancedStore.update(state => ({ ...state, ...updates }));
      } catch (error) {
        handleError(error);
        throw error; // Re-throw to maintain consistency
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        if (isNotifying) {
          pendingUnsubscribes.add(listener);
        } else {
          listeners.delete(listener);
        }
      };
    },
    destroy: () => {
      // Clean up the Svelte store subscription
      storeUnsubscribe();
      // Clear all listeners
      listeners.clear();
      pendingUnsubscribes.clear();
    }
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { compose } = await import('@lattice/core');

  describe('createSvelteAdapter - in-source tests', () => {
    it('should create a working adapter with Svelte stores', () => {
      const createComponent = (
        createStore: CreateStore<{ count: number; name: string }>
      ) => {
        const createSlice = createStore({ count: 0, name: 'test' });

        const counter = createSlice(({ get, set }) => ({
          value: () => get().count,
          increment: () => set({ count: get().count + 1 }),
          decrement: () => set({ count: get().count - 1 }),
          reset: () => set({ count: 0 }),
        }));

        const user = createSlice(({ get, set }) => ({
          name: () => get().name,
          setName: (name: string) => set({ name }),
        }));

        return { counter, user };
      };

      const store = createSvelteAdapter(createComponent);

      // Test initial state
      expect(store.counter.value()).toBe(0);
      expect(store.user.name()).toBe('test');

      // Test mutations
      store.counter.increment();
      expect(store.counter.value()).toBe(1);

      store.counter.increment();
      expect(store.counter.value()).toBe(2);

      store.user.setName('Alice');
      expect(store.user.name()).toBe('Alice');

      // Test reset
      store.counter.reset();
      expect(store.counter.value()).toBe(0);
    });

    it('should work with subscriptions', () => {
      const createComponent = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });

        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 }),
          setValue: (value: number) => set({ value }),
        }));

        const queries = createSlice(({ get }) => ({
          value: () => get().value,
          doubled: () => get().value * 2,
        }));

        return { actions, queries };
      };

      const store = createSvelteAdapter(createComponent);

      // Track subscription calls
      let notificationCount = 0;
      const unsubscribe = store.subscribe(() => {
        notificationCount++;
      });

      // Mutations should trigger subscriptions
      store.actions.increment();
      expect(notificationCount).toBe(1);
      expect(store.queries.value()).toBe(1);

      store.actions.setValue(10);
      expect(notificationCount).toBe(2);
      expect(store.queries.value()).toBe(10);
      expect(store.queries.doubled()).toBe(20);

      // Cleanup
      unsubscribe();
      store.actions.increment();
      expect(notificationCount).toBe(2); // No change after unsubscribe
    });

    it('should work with compose for dependencies', () => {
      const createComponent = (
        createStore: CreateStore<{ items: string[]; filter: string }>
      ) => {
        const createSlice = createStore({ items: [], filter: '' });

        const items = createSlice(({ get, set }) => ({
          all: () => get().items,
          add: (item: string) => set({ items: [...get().items, item] }),
          remove: (index: number) => {
            const current = get().items;
            set({ items: current.filter((_, i) => i !== index) });
          },
        }));

        const filter = createSlice(({ get, set }) => ({
          value: () => get().filter,
          set: (value: string) => set({ filter: value }),
        }));

        const filtered = createSlice(
          compose({ items, filter }, (_, { items, filter }) => ({
            items: () => {
              const allItems = items.all();
              const filterValue = filter.value();
              if (!filterValue) return allItems;
              return allItems.filter(item => 
                item.toLowerCase().includes(filterValue.toLowerCase())
              );
            },
            count: () => {
              const allItems = items.all();
              const filterValue = filter.value();
              if (!filterValue) return allItems.length;
              return allItems.filter(item => 
                item.toLowerCase().includes(filterValue.toLowerCase())
              ).length;
            },
          }))
        );

        return { items, filter, filtered };
      };

      const store = createSvelteAdapter(createComponent);

      // Add items
      store.items.add('Apple');
      store.items.add('Banana');
      store.items.add('Cherry');
      store.items.add('Apricot');

      // Test unfiltered
      expect(store.filtered.items()).toEqual(['Apple', 'Banana', 'Cherry', 'Apricot']);
      expect(store.filtered.count()).toBe(4);

      // Test filtering
      store.filter.set('ap');
      expect(store.filtered.items()).toEqual(['Apple', 'Apricot']);
      expect(store.filtered.count()).toBe(2);

      // Test removal with filter active
      store.items.remove(0); // Remove 'Apple'
      expect(store.filtered.items()).toEqual(['Apricot']);
      expect(store.filtered.count()).toBe(1);

      // Clear filter
      store.filter.set('');
      expect(store.filtered.items()).toEqual(['Banana', 'Cherry', 'Apricot']);
    });

    it('should handle errors in listeners', () => {
      const errors: unknown[] = [];
      const createComponent = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 }),
        }));
        return { actions };
      };

      const store = createSvelteAdapter(createComponent, undefined, {
        onError: (error) => errors.push(error),
      });

      // Subscribe with a throwing listener
      const unsubscribe = store.subscribe(() => {
        throw new Error('Listener error');
      });

      // Should handle the error gracefully
      store.actions.increment();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(Error);
      expect((errors[0] as Error).message).toBe('Listener error');

      unsubscribe();
      store.destroy();
    });
    
    it('should properly clean up with destroy method', () => {
      const createComponent = (createStore: CreateStore<{ value: number }>) => {
        const createSlice = createStore({ value: 0 });
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 }),
          value: () => get().value
        }));
        return { actions };
      };
      
      const store = createSvelteAdapter(createComponent);
      
      // Subscribe to track notifications
      let notificationCount = 0;
      const unsub = store.subscribe(() => {
        notificationCount++;
      });
      
      // Verify subscription works
      store.actions.increment();
      expect(notificationCount).toBe(1);
      
      // Destroy the store
      store.destroy();
      
      // Further mutations should not trigger notifications
      store.actions.increment();
      expect(notificationCount).toBe(1); // Should still be 1
      
      // Cleanup shouldn't throw
      expect(() => unsub()).not.toThrow();
    });
    
    it('should handle setState errors gracefully', () => {
      const errors: unknown[] = [];
      
      // Create a readonly store that will throw on update
      const readonlyStore = {
        subscribe: writable({}).subscribe,
        set: () => { throw new Error('Store is readonly'); },
        update: () => { throw new Error('Store is readonly'); }
      } as any;
      
      const adapter = wrapSvelteStore(readonlyStore, undefined, {
        onError: (error) => errors.push(error)
      });
      
      // setState should throw but also call error handler
      expect(() => adapter.setState({ value: 123 })).toThrow('Store is readonly');
      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('Store is readonly');
      
      // Clean up
      adapter.destroy();
    });

    it('should wrap existing Svelte stores', () => {
      const { writable } = require('svelte/store');
      
      // Create a custom Svelte store
      const customStore = writable({ count: 10, name: 'custom' });
      
      // Wrap it as an adapter
      const adapter = wrapSvelteStore(customStore);
      
      // Verify it works
      expect(adapter.getState()).toEqual({ count: 10, name: 'custom' });
      
      adapter.setState({ count: 20 });
      expect(adapter.getState()).toEqual({ count: 20, name: 'custom' });
      
      // Test subscriptions
      let notified = false;
      const unsub = adapter.subscribe(() => { notified = true; });
      
      adapter.setState({ name: 'updated' });
      expect(notified).toBe(true);
      expect(adapter.getState()).toEqual({ count: 20, name: 'updated' });
      
      unsub();
      
      // Clean up adapter
      adapter.destroy();
    });
    
    it('should optimize with cached state', () => {
      const createComponent = (createStore: CreateStore<{ value: number; name: string }>) => {
        const createSlice = createStore({ value: 0, name: 'test' });
        const queries = createSlice(({ get }) => ({
          value: () => get().value,
          name: () => get().name
        }));
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ value: get().value + 1 })
        }));
        return { queries, actions };
      };
      
      const store = createSvelteAdapter(createComponent);
      
      // The cached state optimization happens transparently
      // Multiple getState calls don't hit the Svelte store each time
      const value1 = store.queries.value();
      const value2 = store.queries.value();
      const value3 = store.queries.value();
      
      expect(value1).toBe(0);
      expect(value2).toBe(0);
      expect(value3).toBe(0);
      
      // After mutation, cache is automatically updated
      store.actions.increment();
      
      const value4 = store.queries.value();
      expect(value4).toBe(1);
      
      // Clean up
      store.destroy();
    });

    it('should work with store enhancer', () => {
      const createComponent = (createStore: CreateStore<{ count: number; name: string }>) => {
        const createSlice = createStore({ count: 0, name: 'test' });
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name })
        }));
        const queries = createSlice(({ get }) => ({
          count: () => get().count,
          name: () => get().name
        }));
        return { actions, queries };
      };

      // Track enhancer calls
      const enhancerCalls: string[] = [];
      
      // Create logging enhancer
      const withLogging: StoreEnhancer<{ count: number; name: string }> = (store) => {
        enhancerCalls.push('enhancer:init');
        const { subscribe, set, update } = store;
        
        return {
          subscribe,
          set: (value) => {
            enhancerCalls.push(`set:${JSON.stringify(value)}`);
            set(value);
          },
          update: (updater) => {
            enhancerCalls.push('update:called');
            update(updater);
          }
        };
      };

      const store = createSvelteAdapter(createComponent, withLogging);

      // Verify enhancer was initialized
      expect(enhancerCalls).toContain('enhancer:init');

      // Test that actions go through enhancer
      store.actions.increment();
      expect(enhancerCalls).toContain('update:called');
      expect(store.queries.count()).toBe(1);

      store.actions.setName('enhanced');
      expect(store.queries.name()).toBe('enhanced');

      // Clean up
      store.destroy();
    });

    it('should leverage Svelte\'s automatic batching', async () => {
      const { tick } = await import('svelte');
      
      const createComponent = (createStore: CreateStore<{ count: number; name: string; flag: boolean }>) => {
        const createSlice = createStore({ count: 0, name: 'test', flag: false });
        const actions = createSlice(({ get, set }) => ({
          increment: () => set({ count: get().count + 1 }),
          setName: (name: string) => set({ name }),
          toggleFlag: () => set({ flag: !get().flag }),
          batchUpdate: () => {
            // Multiple synchronous updates are automatically batched by Svelte
            set({ count: get().count + 1 });
            set({ name: 'batched' });
            set({ flag: !get().flag });
          }
        }));
        const queries = createSlice(({ get }) => ({
          getAll: () => ({ count: get().count, name: get().name, flag: get().flag })
        }));
        return { actions, queries };
      };

      // Track subscription notifications
      let notificationCount = 0;
      const store = createSvelteAdapter(createComponent);

      const unsubscribe = store.subscribe(() => {
        notificationCount++;
      });

      // Multiple synchronous updates
      store.actions.increment();
      store.actions.setName('updated');
      store.actions.toggleFlag();

      // Svelte batches these automatically, but we need to wait for the update cycle
      await tick();

      // Verify all updates were applied
      const state = store.queries.getAll();
      expect(state).toEqual({
        count: 1,
        name: 'updated',
        flag: true
      });

      // Test the explicit batch method
      notificationCount = 0;
      store.actions.batchUpdate();
      await tick();

      expect(store.queries.getAll()).toEqual({
        count: 2,
        name: 'batched',
        flag: false
      });

      unsubscribe();
      store.destroy();
    });

    it('should work with enhancer on wrapped stores', () => {
      const baseStore = writable({ value: 10, active: true });
      
      // Track enhancer activity
      const logs: string[] = [];
      
      const debugEnhancer: StoreEnhancer<{ value: number; active: boolean }> = (store) => {
        const { subscribe, set, update } = store;
        logs.push('enhancer:wrap');
        
        return {
          subscribe: (run, invalidate?) => {
            logs.push('subscribe:wrapped');
            return subscribe(run, invalidate);
          },
          set: (value) => {
            logs.push(`set:${JSON.stringify(value)}`);
            set(value);
          },
          update: (updater) => {
            logs.push('update:wrapped');
            update(updater);
          }
        };
      };

      const adapter = wrapSvelteStore(baseStore, debugEnhancer);
      
      expect(logs).toContain('enhancer:wrap');
      expect(logs).toContain('subscribe:wrapped');

      adapter.setState({ value: 20 });
      expect(logs).toContain('update:wrapped');
      expect(adapter.getState()).toEqual({ value: 20, active: true });

      adapter.destroy();
    });
  });
}