/**
 * @fileoverview Vue composables for Lattice runtime
 *
 * Provides standardized Vue composables that work with any adapter implementing
 * the subscribe pattern. These composables handle reactive subscriptions,
 * computed views, and side effects with proper cleanup.
 */

import { computed, ComputedRef, shallowRef, onUnmounted } from 'vue';
import type { AdapterResult, ModelTools } from '@lattice/core';

/**
 * Store interface that any adapter must implement to work with these composables
 */
export interface SubscribableStore<Views> {
  views: Views;
  subscribe<Selected>(
    selector: (views: Views) => Selected,
    callback: (result: Selected) => void
  ): () => void;
}

/**
 * Composable for selecting reactive views with automatic subscriptions.
 * Best for static views and simple selectors.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useViews } from '@lattice/runtime/vue';
 * import { todoStore } from './stores';
 *
 * const { todos, filter } = useViews(todoStore, views => ({
 *   todos: views.todoList(),
 *   filter: views.currentFilter()
 * }));
 * </script>
 * ```
 */
export function useViews<Views, Selected>(
  store: SubscribableStore<Views>,
  selector: (views: Views) => Selected
): ComputedRef<Selected> {
  // Use a ref to track updates and trigger recomputation
  const updateTrigger = shallowRef(0);

  // Create computed that depends on updateTrigger
  const result = computed(() => {
    // Access trigger to create dependency
    updateTrigger.value;
    return selector(store.views);
  });

  // Set up subscription for updates
  const unsubscribe = store.subscribe(selector, () => {
    // Increment trigger to force recomputation
    updateTrigger.value++;
  });

  // Clean up on component unmount
  onUnmounted(() => {
    unsubscribe();
  });

  return result;
}

/**
 * Composable for expensive computed views.
 * Only recomputes when the store changes, not on every render.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useComputedView } from '@lattice/runtime/vue';
 * import { analyticsStore } from './stores';
 *
 * const summary = useComputedView(
 *   analyticsStore,
 *   views => views.expensiveSummary()
 * );
 * </script>
 * ```
 */
export function useComputedView<Views, Result>(
  store: SubscribableStore<Views>,
  computation: (views: Views) => Result
): ComputedRef<Result> {
  // Track store version to detect changes
  const storeVersion = shallowRef(0);

  // Create computed that depends on store version
  const computedResult = computed(() => {
    // Access version to create dependency
    storeVersion.value;
    return computation(store.views);
  });

  // Subscribe to any store change
  const unsubscribe = store.subscribe(
    () => ({}), // Subscribe to any change
    () => {
      // Increment version to trigger recomputation
      storeVersion.value++;
    }
  );

  // Clean up on component unmount
  onUnmounted(() => {
    unsubscribe();
  });

  return computedResult;
}

/**
 * Low-level composable for custom subscription patterns and side effects.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSubscribe } from '@lattice/runtime/vue';
 * import { todoStore } from './stores';
 *
 * useSubscribe(
 *   todoStore,
 *   views => views.todoCount(),
 *   (count) => {
 *     document.title = `Todos (${count.value})`;
 *   }
 * );
 * </script>
 * ```
 */
export function useSubscribe<Views, Selected>(
  store: SubscribableStore<Views>,
  selector: (views: Views) => Selected,
  callback: (result: Selected) => void
): void {
  // Call callback with initial value
  const initialValue = selector(store.views);
  callback(initialValue);

  // Set up subscription
  const unsubscribe = store.subscribe(selector, callback);

  // Clean up on component unmount
  onUnmounted(() => {
    unsubscribe();
  });
}

// ============================================================================
// Utility composables for common patterns
// ============================================================================

/**
 * Composable that returns a single view as a computed ref.
 * Shorthand for selecting a single view.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useView } from '@lattice/runtime/vue';
 * import { todoStore } from './stores';
 *
 * const todos = useView(todoStore, 'todoList');
 * </script>
 * ```
 */
export function useView<Views, K extends keyof Views>(
  store: SubscribableStore<Views>,
  viewName: K
): Views[K] extends (...args: never[]) => infer R ? ComputedRef<R> : never {
  return useViews(store, (views) => {
    const view = views[viewName];
    if (typeof view === 'function') {
      return view();
    }
    throw new Error(`View "${String(viewName)}" is not a function`);
  }) as Views[K] extends (...args: never[]) => infer R ? ComputedRef<R> : never;
}

/**
 * Composable for using store actions.
 * Returns the actions object directly (non-reactive).
 *
 * @example
 * ```vue
 * <script setup>
 * import { useActions } from '@lattice/runtime/vue';
 * import { todoStore } from './stores';
 *
 * const { addTodo, removeTodo } = useActions(todoStore);
 * </script>
 * ```
 */
export function useActions<Actions>(store: {
  actions: Actions;
}): Readonly<Actions> {
  // Actions are already bound and don't need reactivity
  return store.actions;
}

/**
 * Composable that combines views and actions for convenience.
 * Useful when you need both in a component.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useStore } from '@lattice/runtime/vue';
 * import { todoStore } from './stores';
 *
 * const { views, actions } = useStore(todoStore);
 * const todos = computed(() => views.todoList());
 *
 * function handleAdd() {
 *   actions.addTodo('New todo');
 * }
 * </script>
 * ```
 */
export function useStore<Model, Actions, Views>(
  store: AdapterResult<Model, Actions, Views>
): {
  views: AdapterResult<Model, Actions, Views>['views'];
  actions: Readonly<Actions>;
  subscribe: typeof store.subscribe;
} {
  return {
    views: store.views,
    actions: store.actions,
    subscribe: store.subscribe,
  };
}

// ============================================================================
// Type helpers
// ============================================================================

/**
 * Extract the Views type from a store
 */
export type ViewsOf<T> = T extends SubscribableStore<infer V> ? V : never;

/**
 * Extract the Actions type from a store
 */
export type ActionsOf<T> = T extends { actions: infer A } ? A : never;

/**
 * Extract the Model type from an adapter result
 */
export type ModelOf<T> = T extends AdapterResult<infer M, any, any> ? M : never;

/**
 * Type guard to check if a value is a Vue adapter result
 */
export function isVueAdapterResult<Model, Actions, Views>(
  value: unknown
): value is AdapterResult<Model, Actions, Views> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'actions' in value &&
    'views' in value &&
    'subscribe' in value &&
    typeof (value as any).subscribe === 'function'
  );
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;
  const { createModel, createSlice } = await import('@lattice/core');
  const { mount } = await import('@vue/test-utils');
  const { defineComponent, h, nextTick } = await import('vue');

  describe('Vue runtime composables', () => {
    const createTestComponentFactory = () => {
      return () => {
        const model = createModel<TestModel>(({ set, get }) => ({
          count: 0,
          name: 'Test',
          items: [],
          increment: () => set({ count: get().count + 1 }),
          setName: (name) => set({ name }),
          addItem: (item) => set({ items: [...get().items, item] }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
          setName: m.setName,
          addItem: m.addItem,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
          name: createSlice(model, (m) => ({ text: m.name })),
          items: createSlice(model, (m) => ({ list: m.items })),
          summary: createSlice(model, (m) => ({
            total: m.count,
            itemCount: m.items.length,
            description: `${m.name}: ${m.count} (${m.items.length} items)`,
          })),
        };

        return { model, actions, views };
      };
    };

    // Define types for the test component
    type TestModel = {
      count: number;
      name: string;
      items: string[];
      increment: () => void;
      setName: (name: string) => void;
      addItem: (item: string) => void;
    };

    type TestActions = {
      increment: () => void;
      setName: (name: string) => void;
      addItem: (item: string) => void;
    };

    type TestViews = {
      count: () => { value: number };
      name: () => { text: string };
      items: () => { list: string[] };
      summary: () => {
        total: number;
        itemCount: number;
        description: string;
      };
    };

    // Create a test adapter that implements the required interface
    const createTestAdapter = (): AdapterResult<
      TestModel,
      TestActions,
      TestViews
    > => {
      const componentFactory = createTestComponentFactory();
      const componentSpec = componentFactory();
      const {
        model: modelFactory,
        actions: actionsSlice,
        views: viewsSpec,
      } = componentSpec;

      // Create a simple state container
      let state: TestModel;
      const subscribers = new Set<() => void>();

      // Initialize the model
      const modelTools: ModelTools<TestModel> = {
        get: () => state,
        set: (updates) => {
          state = { ...state, ...updates };
          subscribers.forEach((sub) => sub());
        },
      };

      state = modelFactory(modelTools);

      // Create properly typed view functions that always read current state
      const viewFunctions: TestViews = {
        count: () => viewsSpec.count(state),
        name: () => viewsSpec.name(state),
        items: () => viewsSpec.items(state),
        summary: () => viewsSpec.summary(state),
      };

      return {
        actions: actionsSlice(state),
        views: viewFunctions,
        subscribe: <Selected>(
          selector: (views: TestViews) => Selected,
          callback: (result: Selected) => void
        ) => {
          // Create subscription handler
          const handler = () => {
            // Re-evaluate selector with fresh views
            const freshViews: TestViews = {
              count: () => viewsSpec.count(state),
              name: () => viewsSpec.name(state),
              items: () => viewsSpec.items(state),
              summary: () => viewsSpec.summary(state),
            };
            const result = selector(freshViews);
            callback(result);
          };

          subscribers.add(handler);

          return () => {
            subscribers.delete(handler);
          };
        },
        // Add missing methods from AdapterResult interface
        destroy: () => {
          subscribers.clear();
        },
        getState: () => state,
      };
    };

    describe('useViews', () => {
      it('should return selected views reactively', async () => {
        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const selected = useViews(store, (views) => ({
              count: views.count(),
              name: views.name(),
            }));
            return { store, selected };
          },
          render() {
            const { count, name } = this.selected;
            return h('div', `${name.text}: ${count.value}`);
          },
        });

        const wrapper = mount(TestComponent);
        expect(wrapper.text()).toBe('Test: 0');

        const { store } = wrapper.vm as any;
        store.actions.increment();
        await nextTick();
        expect(wrapper.text()).toBe('Test: 1');

        store.actions.setName('Updated');
        await nextTick();
        expect(wrapper.text()).toBe('Updated: 1');
      });

      it('should handle complex selectors', async () => {
        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const data = useViews(store, (views) => {
              const summary = views.summary();
              return {
                description: summary.description,
                hasItems: summary.itemCount > 0,
              };
            });
            return { store, data };
          },
          render() {
            return h('div', [
              h('p', this.data.description),
              h('p', this.data.hasItems ? 'Has items' : 'No items'),
            ]);
          },
        });

        const wrapper = mount(TestComponent);
        expect(wrapper.text()).toContain('Test: 0 (0 items)');
        expect(wrapper.text()).toContain('No items');

        const { store } = wrapper.vm as any;
        store.actions.addItem('Item 1');
        await nextTick();
        expect(wrapper.text()).toContain('Test: 0 (1 items)');
        expect(wrapper.text()).toContain('Has items');
      });
    });

    describe('useComputedView', () => {
      it('should compute expensive views efficiently', async () => {
        let computeCount = 0;

        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const summary = useComputedView(store, (views) => {
              computeCount++;
              const s = views.summary();
              // Simulate expensive computation
              return {
                ...s,
                computed: true,
                computeCount,
              };
            });
            return { store, summary };
          },
          render() {
            return h('div', `Computed ${this.summary.computeCount} times`);
          },
        });

        const wrapper = mount(TestComponent);
        const initialCount = computeCount;
        expect(wrapper.text()).toBe(`Computed ${initialCount} times`);

        // Multiple re-renders shouldn't trigger recomputation
        await wrapper.vm.$forceUpdate();
        await wrapper.vm.$forceUpdate();
        expect(computeCount).toBe(initialCount);

        // Store change should trigger recomputation
        const { store } = wrapper.vm as any;
        store.actions.increment();
        await nextTick();
        expect(computeCount).toBe(initialCount + 1);
        expect(wrapper.text()).toBe(`Computed ${initialCount + 1} times`);
      });
    });

    describe('useSubscribe', () => {
      it('should handle side effects', async () => {
        const sideEffect = vi.fn();

        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            useSubscribe(
              store,
              (views) => views.count(),
              (count) => {
                if (count.value > 0) {
                  sideEffect(count.value);
                }
              }
            );
            return { store };
          },
          render() {
            return h('div');
          },
        });

        const wrapper = mount(TestComponent);
        const { store } = wrapper.vm as any;

        expect(sideEffect).not.toHaveBeenCalled();

        store.actions.increment();
        await nextTick();
        expect(sideEffect).toHaveBeenCalledWith(1);

        store.actions.increment();
        await nextTick();
        expect(sideEffect).toHaveBeenCalledWith(2);
      });

      it('should call callback with initial value', () => {
        const callback = vi.fn();

        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            useSubscribe(store, (views) => views.name(), callback);
            return {};
          },
          render() {
            return h('div');
          },
        });

        mount(TestComponent);

        expect(callback).toHaveBeenCalledWith({ text: 'Test' });
      });
    });

    describe('useView', () => {
      it('should return a single view', async () => {
        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const count = useView(store, 'count');
            return { store, count };
          },
          render() {
            return h('div', `Count: ${this.count.value}`);
          },
        });

        const wrapper = mount(TestComponent);
        expect(wrapper.text()).toBe('Count: 0');

        const { store } = wrapper.vm as any;
        store.actions.increment();
        await nextTick();
        expect(wrapper.text()).toBe('Count: 1');
      });
    });

    describe('useActions', () => {
      it('should provide access to actions', async () => {
        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const { increment, setName } = useActions(store);
            const count = useView(store, 'count');
            const name = useView(store, 'name');

            return { increment, setName, count, name };
          },
          render() {
            return h('div', [
              h('p', `${this.name.text}: ${this.count.value}`),
              h('button', { onClick: this.increment }, 'Increment'),
              h(
                'button',
                { onClick: () => this.setName('Clicked') },
                'Set Name'
              ),
            ]);
          },
        });

        const wrapper = mount(TestComponent);
        expect(wrapper.text()).toContain('Test: 0');

        const buttons = wrapper.findAll('button');
        await buttons[0]?.trigger('click');
        await nextTick();
        expect(wrapper.text()).toContain('Test: 1');

        await buttons[1]?.trigger('click');
        await nextTick();
        expect(wrapper.text()).toContain('Clicked: 1');
      });
    });

    describe('useStore', () => {
      it('should provide views and actions together', async () => {
        const TestComponent = defineComponent({
          setup() {
            const store = createTestAdapter();
            const { actions } = useStore(store);

            // Use our reactive composable instead of direct access
            const count = useView(store, 'count');

            return { actions, count };
          },
          render() {
            return h('div', [
              h('p', `Count: ${this.count.value}`),
              h('button', { onClick: this.actions.increment }, 'Increment'),
            ]);
          },
        });

        const wrapper = mount(TestComponent);
        expect(wrapper.text()).toContain('Count: 0');

        await wrapper.find('button').trigger('click');
        await nextTick();
        expect(wrapper.text()).toContain('Count: 1');
      });
    });
  });
}
