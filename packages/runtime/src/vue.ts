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

import { ref, reactive, toRefs, onUnmounted, type Ref, type ToRefs } from 'vue';
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
export function useSliceSelector<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
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
export function useSlice<Component, K extends keyof Component>(
  store: Component & SubscribableStore,
  sliceName: K
): Component[K] {
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
export function useSliceValues<
  Component,
  Selected extends Record<string, unknown>,
>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected
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
export function useLattice<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  equalityFn?: (a: Selected, b: Selected) => boolean
): {
  values: Ref<Selected>;
  slices: Component;
} {
  const values = useSliceSelector(store, selector, equalityFn);
  return { values, slices: store };
}
