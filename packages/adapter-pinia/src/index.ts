/**
 * @fileoverview Pinia adapter for Lattice
 *
 * This adapter provides integration with Pinia for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createPinia, defineStore, type Pinia, type Store } from 'pinia';
import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Configuration options for Pinia adapters
 */
export interface AdapterOptions {
  /**
   * Custom error handler for listener errors.
   * Default: logs to console.error
   */
  onError?: (error: unknown) => void;
}

/**
 * Store enhancer function that allows plugin composition
 *
 * @param stateCreator - Function that returns the initial state
 * @param pinia - The Pinia instance to enhance
 * @param storeId - The unique store ID
 * @returns Enhanced Pinia store instance
 */
export type StoreEnhancer<State extends Record<string, any>> = (
  stateCreator: () => State,
  pinia: Pinia,
  storeId: string
) => Store<string, State>;

/**
 * Creates a Pinia adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Pinia. It combines
 * an component factory with Pinia's state management.
 *
 * @param componentFactory - The Lattice component factory
 * @param enhancer - Optional store enhancer for plugins
 * @param options - Optional configuration for the adapter
 * @returns A Lattice store backed by Pinia
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
 * const store = createPiniaAdapter(createComponent);
 * store.counter.increment();
 * ```
 *
 * @example With plugins
 * ```typescript
 * import { createPersistedState } from 'pinia-plugin-persistedstate';
 *
 * const store = createPiniaAdapter(createComponent, (stateCreator, pinia, storeId) => {
 *   pinia.use(createPersistedState({
 *     key: id => `__persisted__${id}`,
 *     storage: localStorage,
 *   }));
 *
 *   const useStore = defineStore(storeId, {
 *     state: stateCreator
 *   });
 *
 *   return useStore(pinia);
 * });
 * ```
 */
export function createPiniaAdapter<
  Component,
  State extends Record<string, any> = any,
>(
  componentFactory: ComponentFactory<Component, State>,
  enhancer?: StoreEnhancer<State>,
  options?: AdapterOptions
) {
  // Create an adapter factory that will be called with initial state
  const adapterFactory = (initialState: State): StoreAdapter<State> => {
    const pinia = createPinia();
    const storeId = `lattice-${Date.now()}-${Math.random()}`;

    // Create store with or without enhancer
    const store = enhancer
      ? enhancer(() => initialState, pinia, storeId)
      : createDefaultStore(() => initialState, pinia, storeId);

    return createStoreAdapter(store, options);
  };

  return createLatticeStore(componentFactory, adapterFactory);
}

/**
 * Creates a default Pinia store
 */
function createDefaultStore<State extends Record<string, any>>(
  stateCreator: () => State,
  pinia: Pinia,
  storeId: string
): Store<string, State> {
  const useStore = defineStore(storeId, {
    state: stateCreator,
  });

  return useStore(pinia);
}

/**
 * Creates a minimal adapter from a Pinia store
 *
 * This wraps a Pinia store with minimal adapter interface.
 * Handles edge cases like unsubscribe during notification.
 *
 * @param store - The Pinia store to wrap
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter
 */
export function createStoreAdapter<State extends Record<string, any>>(
  store: Store<string, State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  // Track listeners for edge case handling
  const listeners = new Set<() => void>();
  let isNotifying = false;
  const pendingUnsubscribes = new Set<() => void>();

  // For error handling
  const handleError =
    options?.onError ??
    ((error) => {
      console.error('Error in store listener:', error);
    });

  // Subscribe to Pinia and forward to our listeners
  store.$subscribe(() => {
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
    getState: () => {
      // Return a deep copy to prevent mutation of the original state
      // Pinia's state is reactive, so we need to ensure we return plain objects
      return JSON.parse(JSON.stringify(store.$state)) as State;
    },
    setState: (updates) => {
      // Pinia's $patch expects the updates to be compatible with UnwrapRef<State>
      // We use a function to avoid type issues with Vue's reactivity system
      store.$patch((state) => {
        Object.assign(state as any, updates);
      });
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
  };
}

/**
 * Wraps an existing Pinia store as a minimal adapter
 *
 * This allows you to use an existing Pinia store with Lattice.
 * Uses the same sophisticated subscription management as createStoreAdapter
 * to handle edge cases like unsubscribe during notification.
 *
 * @param store - An existing Pinia store
 * @param options - Optional configuration for the adapter
 * @returns A minimal store adapter with proper subscription management
 *
 * @example
 * ```typescript
 * const piniaStore = useCounterStore();
 * const adapter = wrapPiniaStore(piniaStore);
 * const store = createLatticeStore(componentFactory, adapter);
 * ```
 */
export function wrapPiniaStore<State extends Record<string, any>>(
  store: Store<string, State>,
  options?: AdapterOptions
): StoreAdapter<State> {
  return createStoreAdapter(store, options);
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';
export type { SubscribableStore } from '@lattice/core';

// Note: Vue composables are available from '@lattice/runtime/vue'
// They work with any adapter including this Pinia adapter

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, beforeEach } = import.meta.vitest;
  const { compose } = await import('@lattice/core');
  type CreateStore = import('@lattice/core').CreateStore<any>;

  describe('createPiniaAdapter - in-source tests', () => {
    beforeEach(() => {
      // Reset Pinia between tests
      const pinia = createPinia();
      (pinia as any)._s.clear();
    });

    it('should demonstrate the new API with resolve for selectors', () => {
      const createComponent = (createStore: CreateStore) => {
        const createSlice = createStore({ count: 0, multiplier: 2 });

        // Actions that mutate state
        const actions = createSlice(
          ({ get, set }: { get: () => any; set: (updates: any) => void }) => ({
            increment: () => set({ count: get().count + 1 }),
            decrement: () => set({ count: get().count - 1 }),
            setMultiplier: (m: number) => set({ multiplier: m }),
          })
        );

        // Queries that read state
        const queries = createSlice(({ get }: { get: () => any }) => ({
          count: () => get().count,
          multiplier: () => get().multiplier,
        }));

        // Create computed views
        const computed = createSlice(({ get }: { get: () => any }) => ({
          value: () => get().count,
          doubled: () => get().count * 2,
          multiplied: () => get().count * get().multiplier,
          label: () =>
            `Count: ${get().count} (*${get().multiplier} = ${get().count * get().multiplier})`,
        }));

        return { actions, queries, computed };
      };

      const store = createPiniaAdapter(createComponent);

      // Test initial state
      expect(store.computed.selector.value()).toBe(0);
      expect(store.computed.selector.doubled()).toBe(0);
      expect(store.computed.selector.multiplied()).toBe(0);
      expect(store.computed.selector.label()).toBe('Count: 0 (*2 = 0)');

      // Test actions
      store.actions.selector.increment();
      expect(store.computed.selector.value()).toBe(1);
      expect(store.computed.selector.doubled()).toBe(2);
      expect(store.computed.selector.multiplied()).toBe(2);
      expect(store.computed.selector.label()).toBe('Count: 1 (*2 = 2)');

      // Change multiplier
      store.actions.selector.setMultiplier(3);
      store.actions.selector.increment();
      expect(store.computed.selector.value()).toBe(2);
      expect(store.computed.selector.multiplied()).toBe(6);
      expect(store.computed.selector.label()).toBe('Count: 2 (*3 = 6)');
    });

    it('should work with compose for slice dependencies', () => {
      const createComponent = (createStore: CreateStore) => {
        const createSlice = createStore({
          value: 0,
          min: 0,
          max: 100,
        });

        // Base slices
        const valueQueries = createSlice(({ get }: { get: () => any }) => ({
          current: () => get().value,
          isMin: () => get().value === get().min,
          isMax: () => get().value === get().max,
        }));

        const limitsQueries = createSlice(({ get }: { get: () => any }) => ({
          min: () => get().min,
          max: () => get().max,
          range: () => get().max - get().min,
        }));

        // Compose slices for complex actions
        const actions = createSlice(
          compose(
            { value: valueQueries, limits: limitsQueries },
            ({ set }, { value, limits }) => ({
              increment: () => {
                if (!value.isMax()) {
                  set({ value: Math.min(value.current() + 1, limits.max()) });
                }
              },
              decrement: () => {
                if (!value.isMin()) {
                  set({ value: Math.max(value.current() - 1, limits.min()) });
                }
              },
              setValue: (v: number) => {
                const clamped = Math.max(
                  limits.min(),
                  Math.min(v, limits.max())
                );
                set({ value: clamped });
              },
              setRange: (min: number, max: number) => {
                set({ min, max });
                // Clamp current value to new range
                const current = value.current();
                if (current < min) set({ value: min });
                if (current > max) set({ value: max });
              },
            })
          )
        );

        return { actions, value: valueQueries, limits: limitsQueries };
      };

      const store = createPiniaAdapter(createComponent);

      // Test initial state
      expect(store.value.selector.current()).toBe(0);
      expect(store.value.selector.isMin()).toBe(true);
      expect(store.value.selector.isMax()).toBe(false);
      expect(store.limits.selector.range()).toBe(100);

      // Test bounded increment
      store.actions.selector.increment();
      expect(store.value.selector.current()).toBe(1);

      // Test setValue with clamping
      store.actions.selector.setValue(150);
      expect(store.value.selector.current()).toBe(100); // Clamped to max
      expect(store.value.selector.isMax()).toBe(true);

      store.actions.selector.setValue(-10);
      expect(store.value.selector.current()).toBe(0); // Clamped to min

      // Test range change
      store.actions.selector.setValue(50);
      store.actions.selector.setRange(10, 40);
      expect(store.value.selector.current()).toBe(40); // Clamped to new max
      expect(store.limits.selector.min()).toBe(10);
      expect(store.limits.selector.max()).toBe(40);
      expect(store.limits.selector.range()).toBe(30);
    });

    it('should support enhancer for plugins', () => {
      let enhancerCalled = false;
      let storeIdUsed = '';

      const createComponent = (createStore: CreateStore) => {
        const createSlice = createStore({ value: 0 });

        const counter = createSlice(
          ({ get, set }: { get: () => any; set: (updates: any) => void }) => ({
            value: () => get().value,
            increment: () => set({ value: get().value + 1 }),
          })
        );

        return { counter };
      };

      const store = createPiniaAdapter(
        createComponent,
        (stateCreator, pinia, storeId) => {
          enhancerCalled = true;
          storeIdUsed = storeId;

          // Here we could add plugins, e.g.:
          // pinia.use(myPlugin);

          const useStore = defineStore(storeId, {
            state: stateCreator,
          });

          return useStore(pinia);
        }
      );

      expect(enhancerCalled).toBe(true);
      expect(storeIdUsed).toMatch(/^lattice-/);
      expect(store.counter.selector.value()).toBe(0);

      store.counter.selector.increment();
      expect(store.counter.selector.value()).toBe(1);
    });
  });
}
