/**
 * @fileoverview Vue composables for Lattice
 *
 * This module provides Vue 3 composables that work with any Lattice adapter,
 * enabling reactive component updates based on slice method results.
 *
 * Key features:
 * - Slice-based subscriptions with useSliceSelector
 * - Convenience composables for common patterns
 * - Full TypeScript support with proper inference
 * - Optimized reactivity using Vue's ref and reactive
 */

import {
  ref,
  reactive,
  toRefs,
  onUnmounted,
  type Ref,
  type ToRefs,
} from 'vue';
import {
  subscribeToSlices,
  shallowEqual,
  type SubscribableStore,
} from '@lattice/core';

/**
 * Vue composable for subscribing to specific slice method results.
 *
 * This composable will trigger reactive updates only when the selected values
 * change according to the equality function.
 *
 * @param store - A Lattice store with slices and subscribe method
 * @param selector - Function that selects values from slices
 * @param equalityFn - Optional custom equality function (defaults to Object.is)
 * @returns Ref containing the selected values
 *
 * @example
 * ```vue
 * <script setup>
 * const data = useSliceSelector(store, (slices) => ({
 *   count: slices.counter.value(),
 *   isEven: slices.counter.isEven()
 * }));
 * </script>
 *
 * <template>
 *   <div>Count: {{ data.count }} (even: {{ data.isEven }})</div>
 * </template>
 * ```
 */
export function useSliceSelector<App, Selected>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean
): Ref<Selected> {
  // Initialize reactive state with current selector result
  const state = ref<Selected>(selector(store));

  // Subscribe to changes
  const unsubscribe = subscribeToSlices(
    store,
    selector,
    (newState) => {
      state.value = newState;
    },
    {
      equalityFn,
      fireImmediately: true,
    }
  );

  // Clean up subscription when component unmounts
  onUnmounted(unsubscribe);

  // Return the ref (users should not mutate directly)
  return state as Ref<Selected>;
}

/**
 * Convenience composable for accessing a single slice.
 *
 * This is a simpler alternative to useSliceSelector when you just need
 * to access all methods from a single slice.
 *
 * @param store - A Lattice store with slices
 * @param sliceName - The name of the slice to access
 * @returns The slice object
 *
 * @example
 * ```vue
 * <script setup>
 * const counter = useSlice(store, 'counter');
 * </script>
 *
 * <template>
 *   <button @click="counter.increment">
 *     Count: {{ counter.value() }}
 *   </button>
 * </template>
 * ```
 */
export function useSlice<App, K extends keyof App>(
  store: App & SubscribableStore,
  sliceName: K
): App[K] {
  // For a single slice, we can just return it directly since
  // slice objects themselves are stable
  return store[sliceName];
}

/**
 * Composable for subscribing to multiple slice values with shallow equality.
 *
 * This is optimized for selecting multiple primitive values from different
 * slices. It uses shallow equality by default to prevent unnecessary
 * updates when selecting objects. Returns refs for destructuring support.
 *
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @returns Refs of the selected values for destructuring
 *
 * @example
 * ```vue
 * <script setup>
 * const { name, email, isLoggedIn, itemCount } = useSliceValues(store, (slices) => ({
 *   name: slices.user.name(),
 *   email: slices.user.email(),
 *   isLoggedIn: slices.auth.isAuthenticated(),
 *   itemCount: slices.cart.itemCount()
 * }));
 * </script>
 *
 * <template>
 *   <div>Welcome {{ name }}!</div>
 * </template>
 * ```
 */
export function useSliceValues<App, Selected extends Record<string, unknown>>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected
): ToRefs<Selected> {
  // Use reactive for object state
  const state = reactive(selector(store)) as Selected;

  // Subscribe with shallow equality by default
  const unsubscribe = subscribeToSlices(
    store,
    selector,
    (newState) => {
      Object.assign(state, newState);
    },
    {
      equalityFn: shallowEqual,
      fireImmediately: true,
    }
  );

  // Clean up subscription
  onUnmounted(unsubscribe);

  // Return refs for destructuring support
  return toRefs(state) as ToRefs<Selected>;
}

/**
 * Composable that provides both slice values and the full store for actions.
 *
 * This is useful when you need to both read values and call actions
 * in the same component.
 *
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @param equalityFn - Optional custom equality function
 * @returns Object with selected values (as ref) and slices
 *
 * @example
 * ```vue
 * <script setup>
 * const { values, slices } = useLattice(store, (s) => ({
 *   todo: s.todos.getById(props.id),
 *   isEditing: s.ui.isEditing(props.id)
 * }));
 * </script>
 *
 * <template>
 *   <div>
 *     <span>{{ values.todo.text }}</span>
 *     <button @click="() => slices.todos.remove(props.id)">
 *       Delete
 *     </button>
 *   </div>
 * </template>
 * ```
 */
export function useLattice<App, Selected>(
  store: App & SubscribableStore,
  selector: (slices: App) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean
): {
  values: Ref<Selected>;
  slices: App;
} {
  const values = useSliceSelector(store, selector, equalityFn);
  return { values, slices: store };
}

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;
  const { mount } = await import('@vue/test-utils');
  const { defineComponent, nextTick } = await import('vue');
  const { createStore } = await import('@lattice/core');

  describe('Vue composables', () => {
    // Create a test store
    const createTestStore = () => {
      const createSlice = createStore({
        count: 0,
        name: 'test',
        items: [] as string[],
      });

      const listeners = new Set<() => void>();

      const counter = createSlice(({ get, set }) => ({
        value: () => get().count,
        increment: () => {
          set({ count: get().count + 1 });
          listeners.forEach((l) => l());
        },
        isEven: () => get().count % 2 === 0,
      }));

      const user = createSlice(({ get, set }) => ({
        name: () => get().name,
        setName: (name: string) => {
          set({ name });
          listeners.forEach((l) => l());
        },
      }));

      const items = createSlice(({ get, set }) => ({
        all: () => get().items,
        add: (item: string) => {
          set({ items: [...get().items, item] });
          listeners.forEach((l) => l());
        },
      }));

      return {
        counter,
        user,
        items,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    };

    describe('useSliceSelector', () => {
      it('should return selected values and update on changes', async () => {
        const store = createTestStore();

        const TestComponent = defineComponent({
          setup() {
            const data = useSliceSelector(store, (s) => ({
              count: s.counter.value(),
              isEven: s.counter.isEven(),
            }));

            return { data };
          },
          template: '<div>{{ data }}</div>',
        });

        const wrapper = mount(TestComponent);

        expect(wrapper.vm.data).toEqual({ count: 0, isEven: true });

        // Update store
        store.counter.increment();
        await nextTick();

        expect(wrapper.vm.data).toEqual({ count: 1, isEven: false });
      });

      it('should not update for unrelated changes', async () => {
        const store = createTestStore();
        let renderCount = 0;

        const TestComponent = defineComponent({
          setup() {
            renderCount++;
            const count = useSliceSelector(store, (s) => s.counter.value());
            return { count };
          },
          template: '<div>{{ count }}</div>',
        });

        const wrapper = mount(TestComponent);
        const initialRenderCount = renderCount;

        expect(wrapper.vm.count).toBe(0);

        // Change unrelated state
        store.user.setName('alice');
        await nextTick();

        // Should not trigger re-render
        expect(renderCount).toBe(initialRenderCount);
        expect(wrapper.vm.count).toBe(0);

        // Change selected state
        store.counter.increment();
        await nextTick();

        expect(wrapper.vm.count).toBe(1);
      });

      it('should clean up subscription on unmount', () => {
        const store = createTestStore();
        let unsubscribeCalled = false;
        const originalSubscribe = store.subscribe;

        // Mock subscribe to track unsubscribe calls
        store.subscribe = vi.fn((listener) => {
          const unsubscribe = originalSubscribe(listener);
          return () => {
            unsubscribeCalled = true;
            return unsubscribe();
          };
        });

        const TestComponent = defineComponent({
          setup() {
            const count = useSliceSelector(store, (s) => s.counter.value());
            return { count };
          },
          template: '<div>{{ count }}</div>',
        });

        const wrapper = mount(TestComponent);
        expect(store.subscribe).toHaveBeenCalledTimes(1);
        expect(unsubscribeCalled).toBe(false);

        // Unmount should call unsubscribe
        wrapper.unmount();
        expect(unsubscribeCalled).toBe(true);
      });
    });

    describe('useSliceValues', () => {
      it('should use shallow equality by default and support destructuring', async () => {
        const store = createTestStore();

        const TestComponent = defineComponent({
          setup() {
            const { count, name } = useSliceValues(store, (s) => ({
              count: s.counter.value(),
              name: s.user.name(),
            }));

            return { count, name };
          },
          template: '<div>Count: {{ count }}, Name: {{ name }}</div>',
        });

        const wrapper = mount(TestComponent);

        expect(wrapper.vm.count).toBe(0);
        expect(wrapper.vm.name).toBe('test');

        // Update values
        store.counter.increment();
        await nextTick();

        expect(wrapper.vm.count).toBe(1);
        expect(wrapper.vm.name).toBe('test');

        store.user.setName('alice');
        await nextTick();

        expect(wrapper.vm.count).toBe(1);
        expect(wrapper.vm.name).toBe('alice');
      });

      it('should handle multiple updates correctly', async () => {
        const store = createTestStore();

        const TestComponent = defineComponent({
          setup() {
            const values = useSliceValues(store, (s) => ({
              count: s.counter.value(),
              name: s.user.name(),
            }));

            return values;
          },
          template: '<div>{{ count }} {{ name }}</div>',
        });

        const wrapper = mount(TestComponent);

        // Multiple updates
        store.counter.increment();
        store.counter.increment();
        store.user.setName('bob');
        store.counter.increment();
        await nextTick();

        expect(wrapper.vm.count).toBe(3);
        expect(wrapper.vm.name).toBe('bob');
      });
    });

    describe('useSlice', () => {
      it('should return a single slice directly', () => {
        const store = createTestStore();

        const TestComponent = defineComponent({
          setup() {
            const counter = useSlice(store, 'counter');
            return { counter };
          },
          template: '<div>{{ counter.value() }}</div>',
        });

        const wrapper = mount(TestComponent);

        expect(wrapper.vm.counter).toBe(store.counter);
        expect(wrapper.vm.counter.value()).toBe(0);

        // Can call methods on the slice
        wrapper.vm.counter.increment();
        expect(wrapper.vm.counter.value()).toBe(1);
      });
    });

    describe('useLattice', () => {
      it('should provide both values and slices', async () => {
        const store = createTestStore();

        const TestComponent = defineComponent({
          setup() {
            const { values, slices } = useLattice(store, (s) => ({
              count: s.counter.value(),
            }));

            return { values, slices };
          },
          template: '<div>{{ values.count }}</div>',
        });

        const wrapper = mount(TestComponent);

        expect(wrapper.vm.values.count).toBe(0);
        expect(wrapper.vm.slices).toBe(store);

        // Can use slices to trigger actions
        wrapper.vm.slices.counter.increment();
        await nextTick();

        expect(wrapper.vm.values.count).toBe(1);
      });

      it('should support custom equality function', async () => {
        const store = createTestStore();
        const customEqual = vi.fn(
          (a: number, b: number) => Math.abs(a - b) < 3
        );

        const TestComponent = defineComponent({
          setup() {
            const { values } = useLattice(
              store,
              (s) => s.counter.value(),
              customEqual
            );

            return { values };
          },
          template: '<div>{{ values }}</div>',
        });

        const wrapper = mount(TestComponent);

        // Initial value - values is a ref containing the primitive
        expect(wrapper.vm.values).toBe(0);

        // Small changes should not trigger updates
        store.counter.increment(); // 1
        store.counter.increment(); // 2
        await nextTick();

        // Custom equality function should have been called
        expect(customEqual).toHaveBeenCalled();

        // Should still be 0 due to custom equality (diff < 3)
        expect(wrapper.vm.values).toBe(0);

        // This change triggers update (diff = 3, which is NOT < 3)
        store.counter.increment(); // 3
        await nextTick();

        // Should update to 3
        expect(wrapper.vm.values).toBe(3);

        // Small change from 3 should not trigger update
        store.counter.increment(); // 4
        store.counter.increment(); // 5
        await nextTick();

        // Should still be 3 (diff < 3)
        expect(wrapper.vm.values).toBe(3);
      });
    });
  });
}
