/**
 * @fileoverview Vue composables for Lattice
 *
 * This module provides Vue 3 composables that work with any Lattice adapter,
 * enabling reactive component updates based on slice method results.
 *
 * Key features:
 * - Direct slice subscriptions leveraging Lattice's fine-grained reactivity
 * - Convenience composables for common patterns
 * - Full TypeScript support with proper inference
 * - Optimized reactivity using Vue's ref and reactive
 */

import { ref, reactive, toRefs, onUnmounted, type Ref, type ToRefs } from 'vue';

/**
 * A store that can be subscribed to (for backwards compatibility)
 */
export type SubscribableStore = {
  subscribe: (listener: () => void) => () => void;
};

/**
 * Get slice metadata to access its subscription method
 */
function getSliceSubscribe(slice: any): ((listener: () => void) => () => void) | undefined {
  // Try to get metadata from slice
  if (typeof slice?._latticeMetadata?.subscribe === 'function') {
    return slice._latticeMetadata.subscribe;
  }
  
  // Fallback: check if slice itself has subscribe method
  if (typeof slice?.subscribe === 'function') {
    return slice.subscribe;
  }
  
  return undefined;
}

/**
 * Vue composable for subscribing to a single slice.
 *
 * This leverages Lattice's fine-grained reactivity by subscribing directly
 * to the slice's own subscription mechanism.
 *
 * @param slice - A Lattice slice
 * @returns Ref that updates when the slice's dependencies change
 *
 * @example
 * ```vue
 * <script setup>
 * const counterData = useSlice(store.counter);
 * </script>
 *
 * <template>
 *   <div>Count: {{ counterData().value }}</div>
 * </template>
 * ```
 */
export function useSlice<T>(slice: T): Ref<T> {
  const state = ref<T>(slice);
  
  const subscribe = getSliceSubscribe(slice);
  if (subscribe) {
    const unsubscribe = subscribe(() => {
      state.value = slice;
    });
    onUnmounted(unsubscribe);
  }

  return state as Ref<T>;
}

/**
 * Vue composable for subscribing to multiple slices.
 *
 * For complex selectors, falls back to store-level subscription.
 * Prefer useSlice for single slices or useSliceValues for simple multi-slice access.
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
 *   count: slices.counter().value,
 *   user: slices.user().name
 * }));
 * </script>
 *
 * <template>
 *   <div>{{ data.user }}: {{ data.count }}</div>
 * </template>
 * ```
 */
export function useSliceSelector<Component, Selected>(
  store: Component & SubscribableStore,
  selector: (slices: Component) => Selected,
  equalityFn: (a: Selected, b: Selected) => boolean = Object.is
): Ref<Selected> {
  const state = ref<Selected>(selector(store));
  let prevSelected = state.value;

  // Use store-level subscription for complex selectors
  const unsubscribe = store.subscribe(() => {
    try {
      const nextSelected = selector(store);
      
      if (!equalityFn(nextSelected, prevSelected)) {
        prevSelected = nextSelected;
        state.value = nextSelected;
      }
    } catch (error) {
      console.error('Error in useSliceSelector selector:', error);
    }
  });

  onUnmounted(unsubscribe);
  return state as Ref<Selected>;
}

/**
 * Convenience composable for accessing a slice by name from a store.
 *
 * This returns the slice directly since slice objects are stable.
 * For reactive updates, use the returned slice with useSlice.
 *
 * @param store - A Lattice store with slices
 * @param sliceName - The name of the slice to access
 * @returns The slice object
 *
 * @example
 * ```vue
 * <script setup>
 * const counter = useSliceByName(store, 'counter');
 * const counterData = useSlice(counter);
 * </script>
 *
 * <template>
 *   <button @click="counter().increment">
 *     Count: {{ counterData().value }}
 *   </button>
 * </template>
 * ```
 */
export function useSliceByName<Component, K extends keyof Component>(
  store: Component,
  sliceName: K
): Component[K] {
  return store[sliceName];
}

/**
 * Composable for subscribing to multiple slice values.
 *
 * This leverages Lattice's fine-grained reactivity without manual equality checks.
 * Returns refs for destructuring support.
 *
 * @param store - A Lattice store with slices
 * @param selector - Function that selects values from slices
 * @returns Refs of the selected values for destructuring
 *
 * @example
 * ```vue
 * <script setup>
 * const { name, email, isLoggedIn, itemCount } = useSliceValues(store, (slices) => ({
 *   name: slices.user().name,
 *   email: slices.user().email,
 *   isLoggedIn: slices.auth().isAuthenticated,
 *   itemCount: slices.cart().itemCount
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

  // Subscribe to store changes - Lattice handles fine-grained updates
  const unsubscribe = store.subscribe(() => {
    try {
      const nextSelected = selector(store);
      Object.assign(state, nextSelected);
    } catch (error) {
      console.error('Error in useSliceValues selector:', error);
    }
  });

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
 * @returns Object with selected values (as ref) and slices
 *
 * @example
 * ```vue
 * <script setup>
 * const { values, slices } = useLattice(store, (s) => ({
 *   todo: s.todos().getById(props.id),
 *   isEditing: s.ui().isEditing(props.id)
 * }));
 * </script>
 *
 * <template>
 *   <div>
 *     <span>{{ values.todo.text }}</span>
 *     <button @click="() => slices.todos().remove(props.id)">
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
