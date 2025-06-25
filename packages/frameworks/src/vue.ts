/**
 * @fileoverview Vue composables for Lattice - New slice-based API
 *
 * This module provides Vue 3 composables that leverage Lattice's fine-grained
 * reactivity system. Unlike the old store-based approach, these composables
 * work directly with slice handles and provide native Vue ref integration.
 *
 * Key features:
 * - Fine-grained reactivity using slice-level subscriptions
 * - Native Vue ref integration (works with computed, watch, etc.)
 * - Dependency injection for clean slice management
 * - Full TypeScript inference from slice types to Vue refs
 * - Minimal API that covers 90% of use cases
 * - Consistent error handling with development warnings
 */

import {
  ref,
  computed,
  inject,
  provide,
  onUnmounted,
  type ComputedRef,
  type InjectionKey,
} from 'vue';

import type { SliceHandle, Signal, Computed } from '@lattice/core';

// Map for injection keys - bounded by string keys used in app
const SLICE_INJECTION_KEYS = new Map<string, InjectionKey<any>>();

/**
 * Creates or retrieves an injection key for a given slice key.
 * Uses Map since we need string keys, but this is bounded by actual usage.
 */
function getOrCreateSliceKey<T>(key: string): InjectionKey<SliceHandle<T>> {
  if (!SLICE_INJECTION_KEYS.has(key)) {
    SLICE_INJECTION_KEYS.set(
      key,
      Symbol(`lattice-slice-${key}`) as InjectionKey<SliceHandle<T>>
    );
  }
  return SLICE_INJECTION_KEYS.get(key) as InjectionKey<SliceHandle<T>>;
}

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(
  value: unknown
): value is Signal<unknown> | Computed<unknown> {
  return (
    typeof value === 'function' &&
    typeof (value as any).subscribe === 'function'
  );
}

/**
 * Vue hook for using reactive slices with fine-grained reactivity.
 *
 * This is the core utility that bridges Lattice slices to Vue's reactivity system.
 * The returned ref will only update when the slice's dependencies change, leveraging
 * Lattice's fine-grained subscription system.
 *
 * @param slice - A Lattice slice handle
 * @param selector - Optional function that extracts a value from the slice's computed properties
 * @returns ComputedRef that updates when the slice's dependencies change
 *
 * @example
 * ```vue
 * <script setup>
 * // Use entire slice
 * const counter = useSlice(counterSlice)
 *
 * // Use with selector for fine-grained reactivity
 * const count = useSlice(counterSlice, c => c.value())
 * const doubled = useSlice(counterSlice, c => c.doubled())
 *
 * // Use with any Vue API
 * const tripled = computed(() => count.value * 3)
 * watch(count, (newVal) => console.log('Count changed:', newVal))
 * </script>
 *
 * <template>
 *   <div>Count: {{ count }}</div>
 *   <div>Doubled: {{ doubled }}</div>
 *   <div>Tripled: {{ tripled }}</div>
 * </template>
 * ```
 */
export function useSlice<Computed>(
  slice: SliceHandle<Computed>
): ComputedRef<Computed>;
export function useSlice<Computed, T>(
  slice: SliceHandle<Computed>,
  selector: (computed: Computed) => T
): ComputedRef<T>;
export function useSlice<Computed, T = Computed>(
  slice: SliceHandle<Computed>,
  selector?: (computed: Computed) => T
): ComputedRef<T> {
  const actualSelector =
    selector || ((computed: Computed) => computed as unknown as T);

  // Get slice object and set up subscriptions - like React approach
  const sliceObject = slice();
  const version = ref(0);

  const unsubscribers: (() => void)[] = [];

  // Subscribe to all signals directly
  for (const key in sliceObject) {
    const value = sliceObject[key as keyof Computed];
    if (isSignal(value)) {
      const unsubscribe = value.subscribe(() => {
        version.value++;
      });
      unsubscribers.push(unsubscribe);
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  // Computed depends on version, fresh evaluation each time
  return computed(() => {
    version.value; // Establish Vue dependency
    const freshSlice = slice();
    const result = actualSelector(freshSlice);
    return result;
  }) as ComputedRef<T>;
}

/**
 * Creates a reactive object from a Lattice slice selector with fine-grained reactivity.
 *
 * This is useful when you want to extract multiple values from a single slice.
 * The returned ref contains an object with the selected properties, and only
 * updates when the slice's dependencies change.
 *
 * @param slice - A Lattice slice handle
 * @param selector - Function that extracts an object from the slice's computed properties
 * @returns ComputedRef containing the selected object
 *
 * @example
 * ```vue
 * <script setup>
 * const counter = useLatticeReactive(counterSlice, c => ({
 *   value: c.value(),
 *   doubled: c.doubled(),
 *   isEven: c.value() % 2 === 0
 * }))
 *
 * // Access properties directly
 * const tripled = computed(() => counter.value.value * 3)
 * </script>
 *
 * <template>
 *   <div>Count: {{ counter.value }}</div>
 *   <div>Doubled: {{ counter.doubled }}</div>
 *   <div>Is Even: {{ counter.isEven }}</div>
 * </template>
 * ```
 */
export function useLatticeReactive<Computed, T extends Record<string, unknown>>(
  slice: SliceHandle<Computed>,
  selector: (computed: Computed) => T
): ComputedRef<T> {
  // Get slice object and set up subscriptions - like React approach
  const sliceObject = slice();
  const version = ref(0);

  const unsubscribers: (() => void)[] = [];

  // Subscribe to all signals directly
  for (const key in sliceObject) {
    const value = sliceObject[key as keyof Computed];
    if (isSignal(value)) {
      const unsubscribe = value.subscribe(() => {
        version.value++;
      });
      unsubscribers.push(unsubscribe);
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  // Computed depends on version, fresh evaluation each time
  return computed(() => {
    version.value; // Establish Vue dependency
    return selector(slice()); // Fresh slice evaluation
  }) as ComputedRef<T>;
}

/**
 * Provides a Lattice slice to the component tree for dependency injection.
 *
 * This enables clean separation of slice creation from usage, allowing child
 * components to access slices without prop drilling.
 *
 * @param key - Unique string key for the slice
 * @param slice - The slice handle to provide
 *
 * @example
 * ```vue
 * <!-- Parent component -->
 * <script setup>
 * const counterSlice = createSlice(...)
 * provideLatticeSlice('counter', counterSlice)
 * </script>
 *
 * <template>
 *   <ChildComponent />
 * </template>
 * ```
 */
export function provideLatticeSlice<T>(
  key: string,
  slice: SliceHandle<T>
): void {
  const injectionKey = getOrCreateSliceKey<T>(key);
  provide(injectionKey, slice);
}

/**
 * Injects a Lattice slice from the component tree using dependency injection.
 *
 * This allows child components to access slices provided by parent components
 * without explicit prop passing.
 *
 * @param key - Unique string key for the slice
 * @returns The injected slice handle
 * @throws Error if slice was not provided
 *
 * @example
 * ```vue
 * <!-- Child component -->
 * <script setup>
 * const counterSlice = injectLatticeSlice('counter')
 * const count = useLatticeRef(counterSlice, c => c.value())
 *
 * const increment = () => counterSlice().increment()
 * </script>
 *
 * <template>
 *   <button @click="increment">{{ count }}</button>
 * </template>
 * ```
 */
export function injectLatticeSlice<T>(key: string): SliceHandle<T> {
  const injectionKey = getOrCreateSliceKey<T>(key);
  const slice = inject(injectionKey);

  if (!slice) {
    throw new Error(
      `Lattice slice with key "${key}" was not found in the component tree. Make sure it's provided by a parent component using provideLatticeSlice().`
    );
  }

  return slice;
}
