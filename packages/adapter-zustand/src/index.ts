/**
 * @fileoverview Zustand adapter for Lattice
 *
 * This adapter provides integration with Zustand for state management.
 * Following the minimal adapter pattern, it only provides store primitives.
 * All component execution is handled by the Lattice runtime.
 */

import { createStore as zustandCreateStore, StoreApi } from 'zustand/vanilla';
import type { StoreAdapter, ComponentFactory } from '@lattice/core';
import { createLatticeStore } from '@lattice/core';

/**
 * Creates a Zustand adapter for a Lattice component.
 *
 * This is the primary way to use Lattice with Zustand. It combines
 * a component specification with Zustand's state management.
 *
 * @param componentFactory - The Lattice component spec factory
 * @returns A Lattice store backed by Zustand
 * 
 * @example
 * ```typescript
 * const counter = () => ({
 *   model: createModel(...),
 *   actions: createSlice(...),
 *   views: { ... }
 * });
 * 
 * const store = createZustandAdapter(counter);
 * store.actions.increment();
 * const view = store.views.display();
 * ```
 */
export function createZustandAdapter<Model, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>
) {
  // Create a minimal Zustand adapter
  const adapter = createMinimalZustandAdapter<Model>();
  
  // Use the runtime to create the store
  return createLatticeStore(componentFactory, adapter);
}

/**
 * Creates a minimal Zustand adapter
 * 
 * This creates a new Zustand store with minimal wrapping.
 * Used internally by createZustandAdapter.
 * 
 * @param initialState - Optional initial state
 * @returns A minimal store adapter
 */
export function createMinimalZustandAdapter<Model>(
  initialState?: Partial<Model>
): StoreAdapter<Model> {
  // Create the Zustand store with a simple state container
  const store = zustandCreateStore<Model>(() => ({
    ...initialState
  } as Model));
  
  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener)
  };
}

/**
 * Wraps an existing Zustand store as a minimal adapter
 * 
 * This allows you to use an existing Zustand store with Lattice.
 * 
 * @param store - An existing Zustand store
 * @returns A minimal store adapter
 * 
 * @example
 * ```typescript
 * const zustandStore = createStore<Model>(...);
 * const adapter = wrapZustandStore(zustandStore);
 * const store = createLatticeStore(component, adapter);
 * ```
 */
export function wrapZustandStore<Model>(
  store: StoreApi<Model>
): StoreAdapter<Model> {
  return {
    getState: () => store.getState(),
    setState: (updates) => store.setState(updates, false),
    subscribe: (listener) => store.subscribe(listener)
  };
}

// Re-export types for convenience
export type { StoreAdapter } from '@lattice/core';

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { createModel, createSlice, resolve } = await import('@lattice/core');

  describe('createZustandAdapter - minimal implementation', () => {
    it('should work with the minimal adapter pattern', () => {
      const counter = () => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m().increment,
        }));

        // Create a base slice for views
        const counterSlice = createSlice(model, (m) => ({
          count: () => m().count,
        }));

        // Views use resolve
        const resolveViews = resolve({ counter: counterSlice });
        const views = {
          display: resolveViews(({ counter }) => () => ({
            value: counter.count(),
            label: `Count: ${counter.count()}`
          })),
        };

        return { model, actions, views };
      };

      const store = createZustandAdapter(counter);

      // Test initial state
      const view = store.views.display();
      expect(view.value).toBe(0);
      expect(view.label).toBe('Count: 0');

      // Test actions
      store.actions.increment();

      // Test updated view
      const updatedView = store.views.display();
      expect(updatedView.value).toBe(1);
      expect(updatedView.label).toBe('Count: 1');
    });

    it('should support subscriptions', () => {
      const component = () => {
        const model = createModel<{
          value: number;
          setValue: (v: number) => void;
        }>(({ set }) => ({
          value: 0,
          setValue: (v: number) => set({ value: v }),
        }));

        const actions = createSlice(model, (m) => ({
          setValue: m().setValue,
        }));

        const valueSlice = createSlice(model, (m) => ({
          get: () => m().value,
        }));

        const resolveViews = resolve({ value: valueSlice });
        const views = {
          current: resolveViews(({ value }) => () => ({ value: value.get() })),
        };

        return { model, actions, views };
      };

      const store = createZustandAdapter(component);

      // Track subscription calls
      let callCount = 0;
      const unsubscribe = store.subscribe(() => {
        callCount++;
      });

      // Initial state
      expect(store.views.current().value).toBe(0);
      expect(callCount).toBe(0);

      // Update state
      store.actions.setValue(42);
      expect(store.views.current().value).toBe(42);
      expect(callCount).toBe(1);

      // Unsubscribe
      unsubscribe();
      store.actions.setValue(100);
      expect(callCount).toBe(1); // No more calls
    });
  });
}