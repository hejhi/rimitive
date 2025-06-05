/**
 * @fileoverview Vue 3 state store for Lattice
 *
 * This lightweight store provides integration with Vue 3's Composition API,
 * implementing the Lattice adapter specification with shallow reactivity
 * for optimal performance.
 *
 * Key features:
 * - Full Vue 3 Composition API integration
 * - Shallow reactive state management for performance
 * - Computed views with automatic caching
 * - TypeScript support with proper type inference
 * - Compatible with Vue DevTools
 * - SSR-friendly with proper hydration support
 */

import {
  computed,
  watch,
  shallowRef,
  triggerRef,
  unref,
  effectScope
} from 'vue';
import type {
  ComponentFactory,
  ComponentSpec,
  SliceFactory,
  AdapterResult,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import { createRuntime } from '@lattice/runtime';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Vue adapter errors with helpful context
 */
export class VueAdapterError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    const errorMessage =
      context.cause instanceof Error ? context.cause.message : message;

    super(errorMessage);
    this.name = 'VueAdapterError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VueAdapterError);
    }

    if (context.cause instanceof Error && context.cause.stack) {
      const stackLines = context.cause.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    } else if (this.stack) {
      const stackLines = this.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    }
  }
}

// ============================================================================
// Core Types
// ============================================================================

/**
 * Subscription callback type
 */
type SubscribeCallback<T> = (value: T) => void;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Shallow equality check for comparing values in subscriptions.
 * This is necessary because Vue's computed properties return new object 
 * references even when the underlying values haven't changed.
 * 
 * We use shallow equality because views typically return simple objects
 * like { value: primitive } or arrays of objects.
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  
  if (a == null || b == null) return false;
  
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects (shallow comparison)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is((a as any)[key], (b as any)[key])) return false;
  }
  
  return true;
}



// ============================================================================
// Main Composable Implementation
// ============================================================================

/**
 * Creates a Lattice store using Vue 3's Composition API.
 *
 * This composable creates a reactive store that:
 * - Uses Vue's reactive() for state management
 * - Provides computed views with automatic memoization
 * - Supports fine-grained reactivity with watch()
 * - Integrates with Vue DevTools
 * - Handles proper cleanup with effectScope
 *
 * @param componentOrFactory - The Lattice component spec or factory
 * @returns An adapter result with actions, views, and subscribe
 *
 * @example
 * ```vue
 * <script setup>
 * import { useLattice } from '@lattice/adapter-vue';
 * import { computed } from 'vue';
 * import { todoComponent } from './todo-component';
 *
 * const store = useLattice(todoComponent);
 * const todos = computed(() => store.views.todos());
 * </script>
 *
 * <template>
 *   <div>
 *     <button @click="store.actions.addTodo('New')">Add</button>
 *     <ul>
 *       <li v-for="todo in todos" :key="todo.id">
 *         {{ todo.text }}
 *       </li>
 *     </ul>
 *   </div>
 * </template>
 * ```
 */
export function useLattice<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | ComponentFactory<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): AdapterResult<Model, Actions, Views> {
  return createRuntime(() => {
    // Get the component spec
    const spec =
      typeof componentOrFactory === 'function'
        ? componentOrFactory()
        : componentOrFactory;

    // Create an effect scope for cleanup
    const scope = effectScope();

    // Create the store inside the scope
    const result = scope.run(() => {
      // Create state with shallow reactivity
      const stateRef = shallowRef<Model>();

      // Initialize model with reactive tools
      const modelTools = {
        get: () => stateRef.value!,
        set: (updates: Partial<Model>) => {
          stateRef.value = { ...stateRef.value!, ...updates };
          triggerRef(stateRef);
        },
      };

      try {
        const state = spec.model(modelTools);
        stateRef.value = state;
      } catch (error) {
        throw new VueAdapterError('Model factory execution failed', {
          operation: 'useLattice.modelFactory',
          cause: error,
        });
      }

      // Create slice executor that works with reactive state
      const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
        try {
          return factory(stateRef.value!);
        } catch (error) {
          throw new VueAdapterError('Slice factory execution failed', {
            operation: 'executeSliceFactory',
            details: { sliceFactory: factory.name || 'anonymous' },
            cause: error,
          });
        }
      };

      // Process actions
      let actions: Actions;
      try {
        actions = executeSliceFactory<Actions>(spec.actions);
      } catch (error) {
        throw new VueAdapterError('Actions slice creation failed', {
          operation: 'useLattice.actions',
          cause: error,
        });
      }

      // Process views with Vue computed properties
      const views = {} as ViewTypes<Model, Views>;

      for (const [key, view] of Object.entries(
        spec.views as Record<string, unknown>
      )) {
        if (isSliceFactory(view)) {
          // Static view: create computed property
          const computedView = computed(() => {
            return executeSliceFactory(view);
          });

          views[key as keyof ViewTypes<Model, Views>] = (() => 
            unref(computedView)
          ) as ViewTypes<Model, Views>[keyof ViewTypes<
            Model,
            Views
          >];
        } else if (typeof view === 'function') {
          // Computed view function - may accept parameters
          views[key as keyof ViewTypes<Model, Views>] = ((
            ...args: unknown[]
          ) => {
            // Create a computed for each unique set of args
            const computedView = computed(() => {
              const result = view(...args);

              // If the result is a slice factory, execute it
              if (isSliceFactory(result)) {
                return executeSliceFactory(result);
              }

              // Otherwise return the result as-is
              return result;
            });

            return unref(computedView);
          }) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
        }
      }

      // Create the adapter result
      return {
        actions,
        views,
        getState: () => stateRef.value!,

        subscribe: <Selected>(
          selector: (views: ViewTypes<Model, Views>) => Selected,
          callback: SubscribeCallback<Selected>
        ): (() => void) => {
          // Store the previous value for comparison
          let previousValue = selector(views);
          
          // Watch the state ref for changes
          const stopHandle = watch(
            stateRef,
            () => {
              const newValue = selector(views);
              // Manually compare values to avoid false positives
              // This is necessary because Vue returns new object references
              // even when the underlying values haven't changed
              if (!isEqual(previousValue, newValue)) {
                previousValue = newValue;
                callback(newValue);
              }
            },
            { 
              flush: 'sync', // Ensure synchronous execution
              immediate: false, // Don't run on initial setup
              deep: false // We're using shallow ref, no need for deep watching
            }
          );

          // Return unsubscribe function
          return () => stopHandle();
        },

        destroy: () => {
          // Stop all effects in this scope
          scope.stop();
        },
      };
    });

    if (!result) {
      throw new VueAdapterError('Failed to create Vue adapter', {
        operation: 'useLattice',
      });
    }

    return result;
  });
}

// ============================================================================
// Vue Plugin Support
// ============================================================================

import type { App, InjectionKey } from 'vue';
import { provide, inject } from 'vue';

/**
 * Injection key for providing Lattice stores in Vue
 */
export const LatticeKey: InjectionKey<AdapterResult<any, any, any>> =
  Symbol('lattice');

/**
 * Vue plugin for global Lattice store installation
 */
export const LatticePlugin = {
  install<Model, Actions, Views>(
    app: App,
    options: {
      component:
        | ComponentSpec<Model, Actions, Views>
        | ComponentFactory<Model, Actions, Views>;
      key?: InjectionKey<AdapterResult<Model, Actions, Views>>;
    }
  ) {
    const store = createVueAdapter(options.component);
    app.provide(options.key || LatticeKey, store);
  },
};

/**
 * Composable to inject a Lattice store
 *
 * @example
 * ```vue
 * <script setup>
 * import { useLatticeStore } from '@lattice/adapter-vue';
 * 
 * const store = useLatticeStore();
 * const todos = computed(() => store.views.todos());
 * </script>
 * ```
 */
export function useLatticeStore<
  Model = unknown,
  Actions = unknown,
  Views = unknown
>(
  key: InjectionKey<AdapterResult<Model, Actions, Views>> = LatticeKey as any
): AdapterResult<Model, Actions, Views> {
  const store = inject(key);
  if (!store) {
    throw new Error(
      'No Lattice store found. Make sure to provide a store using provide() or install the LatticePlugin.'
    );
  }
  return store;
}

/**
 * Provide a Lattice store to child components
 *
 * @example
 * ```vue
 * <script setup>
 * import { provideLattice } from '@lattice/adapter-vue';
 * import { todoComponent } from './todo-component';
 * 
 * const store = provideLattice(todoComponent);
 * </script>
 * ```
 */
export function provideLattice<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | ComponentFactory<Model, Actions, Views>,
  key: InjectionKey<AdapterResult<Model, Actions, Views>> = LatticeKey as any
): AdapterResult<Model, Actions, Views> {
  const store = useLattice(componentOrFactory);
  provide(key, store);
  return store;
}

// ============================================================================
// Global Store Creation (Non-Composable)
// ============================================================================

/**
 * Creates a global Vue-based Lattice store outside of components.
 * Useful for stores that need to be created at the module level.
 *
 * @param componentOrFactory - The Lattice component spec or factory
 * @returns An adapter result with actions, views, and subscribe
 *
 * @example
 * ```ts
 * // stores/todo.ts
 * import { createVueAdapter } from '@lattice/adapter-vue';
 * import { todoComponent } from '../components/todo';
 *
 * export const todoStore = createVueAdapter(todoComponent);
 *
 * // In component
 * import { todoStore } from './stores/todo';
 *
 * const todos = computed(() => todoStore.views.todos());
 * ```
 */
export function createVueAdapter<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | ComponentFactory<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): AdapterResult<Model, Actions, Views> {
  // Create adapter outside of component context
  // This allows for module-level stores
  return useLattice(componentOrFactory);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { useLattice as createVueComposable }; // Alias for consistency


// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { mount } = await import('@vue/test-utils');
  const { createComponent, createModel, createSlice } = await import(
    '@lattice/core'
  );
  const { defineComponent, h, nextTick } = await import('vue');

  describe('useLattice', () => {
    it('should create a store with actions and views', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const TestComponent = defineComponent({
        setup() {
          const store = useLattice(counter);
          return { store };
        },
        render() {
          return h('div');
        },
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      expect(store.actions).toBeDefined();
      expect(store.views).toBeDefined();
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.actions.increment).toBe('function');
      expect(typeof store.views.count).toBe('function');
    });

    it('should update state reactively', async () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const TestComponent = defineComponent({
        setup() {
          const store = useLattice(counter);
          return { store };
        },
        render() {
          return h('div', {}, this.store.views.count().value);
        },
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      expect(wrapper.text()).toBe('0');

      store.actions.increment();
      await nextTick();

      expect(wrapper.text()).toBe('1');

      store.actions.increment();
      await nextTick();

      expect(wrapper.text()).toBe('2');
    });

    it('should support subscriptions', async () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const updates: Array<{ value: number }> = [];

      const TestComponent = defineComponent({
        setup() {
          const store = useLattice(counter);
          
          const unsubscribe = store.subscribe(
            (views) => views.count(),
            (count) => updates.push(count)
          );

          // Cleanup on unmount
          onUnmounted(() => unsubscribe());

          return { store };
        },
        render() {
          return h('div');
        },
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      store.actions.increment();
      await nextTick();

      store.actions.increment();
      await nextTick();

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ value: 1 });
      expect(updates[1]).toEqual({ value: 2 });

      wrapper.unmount();
    });

    it('should handle computed views', async () => {
      const todoApp = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [],
          filter: 'all',
          addTodo: (text) => {
            const { todos } = get();
            set({
              todos: [...todos, { id: Date.now(), text, done: false }],
            });
          },
          setFilter: (filter) => set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          addTodo: m.addTodo,
          setFilter: m.setFilter,
        }));

        const todosView = createSlice(model, (m) => {
          const todos =
            m.filter === 'all'
              ? m.todos
              : m.filter === 'active'
              ? m.todos.filter((t) => !t.done)
              : m.todos.filter((t) => t.done);

          return {
            todos,
            count: todos.length,
            filter: m.filter,
          };
        });

        return {
          model,
          actions,
          views: { todos: todosView },
        };
      });

      const TestComponent = defineComponent({
        setup() {
          const store = useLattice(todoApp);
          return { store };
        },
        render() {
          const view = this.store.views.todos();
          return h('div', {}, `${view.count} todos`);
        },
      });

      const wrapper = mount(TestComponent);
      const { store } = wrapper.vm as any;

      expect(wrapper.text()).toBe('0 todos');

      store.actions.addTodo('Test todo');
      await nextTick();

      expect(wrapper.text()).toBe('1 todos');
    });

    it('should work with provide/inject', async () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const ParentComponent = defineComponent({
        setup() {
          const store = provideLattice(counter);
          return { store };
        },
        render() {
          return h('div', {}, [
            h(ChildComponent),
            h('span', {}, (this.store.views as any).count().value),
          ]);
        },
      });

      const ChildComponent = defineComponent({
        setup() {
          const store = useLatticeStore();
          return { store };
        },
        render() {
          return h(
            'button',
            {
              onClick: () => (this.store.actions as any).increment(),
            },
            'Increment'
          );
        },
      });

      const wrapper = mount(ParentComponent);

      expect(wrapper.find('span').text()).toBe('0');

      await wrapper.find('button').trigger('click');
      await nextTick();

      expect(wrapper.find('span').text()).toBe('1');
    });
  });

  // Import onUnmounted for tests
  const { onUnmounted } = await import('vue');
}