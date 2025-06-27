/**
 * @fileoverview Vue composables for Lattice
 *
 * This module provides Vue 3 composables that leverage Lattice's fine-grained
 * reactivity system. These composables work directly with Lattice stores
 * and provide native Vue ref integration.
 *
 * Key features:
 * - Fine-grained reactivity using signal-level subscriptions
 * - Native Vue ref integration (works with computed, watch, etc.)
 * - Dependency injection for clean store management
 * - Full TypeScript inference from store types to Vue refs
 * - Minimal API that covers 90% of use cases
 * - Consistent error handling with development warnings
 */

import {
  ref,
  computed as vueComputed,
  inject,
  provide,
  onUnmounted,
  type ComputedRef,
  type InjectionKey,
} from 'vue';

import type { Signal, Computed } from '@lattice/core';

// Map for injection keys - bounded by string keys used in app
const STORE_INJECTION_KEYS = new Map<string, InjectionKey<unknown>>();

/**
 * Creates or retrieves an injection key for a given store key.
 * Uses Map since we need string keys, but this is bounded by actual usage.
 */
function getOrCreateStoreKey<T>(key: string): InjectionKey<T> {
  if (!STORE_INJECTION_KEYS.has(key)) {
    STORE_INJECTION_KEYS.set(
      key,
      Symbol(`lattice-store-${key}`) as InjectionKey<T>
    );
  }
  return STORE_INJECTION_KEYS.get(key) as InjectionKey<T>;
}

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(
  value: unknown
): value is Signal<unknown> | Computed<unknown> {
  return (
    typeof value === 'function' &&
    value !== null &&
    'subscribe' in value &&
    typeof value.subscribe === 'function'
  );
}

/**
 * Vue hook for using reactive stores with fine-grained reactivity.
 *
 * This is the core utility that bridges Lattice stores to Vue's reactivity system.
 * The returned ref will only update when the store's dependencies change, leveraging
 * Lattice's fine-grained subscription system.
 *
 * @param store - A Lattice store
 * @param selector - Optional function that extracts a value from the store
 * @returns ComputedRef that updates when the store's dependencies change
 *
 * @example
 * ```vue
 * <script setup>
 * import { useStore } from '@lattice/frameworks/vue'
 * import { counterStore } from './stores'
 * 
 * // Use entire store
 * const counter = useStore(counterStore)
 *
 * // Use with selector for fine-grained reactivity
 * const count = useStore(counterStore, s => s.value())
 * const doubled = useStore(counterStore, s => s.doubled())
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
 *   <button @click="counter.value.increment()">Increment</button>
 * </template>
 * ```
 */
export function useStore<T>(
  store: T
): ComputedRef<T>;
export function useStore<T, R>(
  store: T,
  selector: (store: T) => R
): ComputedRef<R>;
export function useStore<T, R = T>(
  store: T,
  selector?: (store: T) => R
): ComputedRef<T | R> {
  // Set up reactive tracking
  const version = ref(0);
  const unsubscribers: (() => void)[] = [];

  // Subscribe to all signals in the store
  for (const key in store) {
    const value = store[key];
    if (isSignal(value)) {
      const unsubscribe = value.subscribe(() => {
        version.value++;
      });
      unsubscribers.push(unsubscribe);
    }
  }

  // Also subscribe to store changes if available
  if (store !== null && 
      typeof store === 'object' && 
      '_subscribe' in store && 
      typeof store._subscribe === 'function') {
    const unsubscribe = store._subscribe(() => {
      version.value++;
    });
    unsubscribers.push(unsubscribe);
  }

  // If selector provided, use it
  if (selector) {
    // Check what the selector returns to handle it appropriately
    const sampleResult = selector(store);
    
    if (isSignal(sampleResult)) {
      // Selector returns a signal - create a wrapper that forces re-render
      const result = vueComputed(() => {
        version.value; // Track version to trigger re-evaluation
        const signal = selector(store) as Signal<unknown>;
        // Return a new wrapper function each time to force Vue to re-render
        return () => signal();
      }) as ComputedRef<R>;

      // Cleanup on unmount
      onUnmounted(() => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      });

      return result;
    } else {
      // Selector returns a regular value
      const result = vueComputed(() => {
        version.value; // Track version to trigger re-evaluation
        return selector(store);
      }) as ComputedRef<R>;

      // Cleanup on unmount
      onUnmounted(() => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      });

      return result;
    }
  }

  // No selector - create a reactive wrapper that re-evaluates
  // This ensures Vue tracks changes when signals are called in templates
  const result = vueComputed(() => {
    version.value; // Track version to trigger re-evaluation
    
    // Create a shallow copy with getters that maintain reactivity
    const reactiveStore = {} as T;
    for (const key in store) {
      const value = store[key];
      if (isSignal(value)) {
        // For signals, create a getter that calls the signal
        // This ensures the value is fresh when accessed in templates
        Object.defineProperty(reactiveStore, key, {
          get() {
            return value;
          },
          enumerable: true
        });
      } else {
        // For non-signals, just copy the value
        reactiveStore[key] = value;
      }
    }
    
    return reactiveStore;
  });

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  return result as ComputedRef<T>;
}

/**
 * Vue hook for using individual signals with Vue's reactivity system.
 *
 * @param signal - A Lattice signal or computed
 * @returns ComputedRef that updates when the signal changes
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSignal } from '@lattice/frameworks/vue'
 * import { counterStore } from './stores'
 * 
 * const count = useSignal(counterStore.value)
 * const doubled = useSignal(counterStore.doubled)
 * </script>
 *
 * <template>
 *   <div>Count: {{ count }}</div>
 *   <div>Doubled: {{ doubled }}</div>
 * </template>
 * ```
 */
export function useSignal<T>(signal: Signal<T> | Computed<T>): ComputedRef<T> {
  const version = ref(0);
  
  const unsubscribe = signal.subscribe(() => {
    version.value++;
  });

  onUnmounted(() => {
    unsubscribe();
  });

  return vueComputed(() => {
    version.value; // Establish Vue dependency
    return signal();
  });
}

/**
 * Provides a Lattice store to the component tree for dependency injection.
 *
 * This enables clean separation of store creation from usage, allowing child
 * components to access stores without prop drilling.
 *
 * @param key - Unique string key for the store
 * @param store - The store to provide
 *
 * @example
 * ```vue
 * <!-- Parent component -->
 * <script setup>
 * import { provideLatticeStore } from '@lattice/frameworks/vue'
 * import { counterStore } from './stores'
 * 
 * provideLatticeStore('counter', counterStore)
 * </script>
 *
 * <template>
 *   <ChildComponent />
 * </template>
 * ```
 */
export function provideLatticeStore<T>(
  key: string,
  store: T
): void {
  const injectionKey = getOrCreateStoreKey<T>(key);
  provide(injectionKey, store);
}

/**
 * Injects a Lattice store from the component tree using dependency injection.
 *
 * This allows child components to access stores provided by parent components
 * without explicit prop passing.
 *
 * @param key - Unique string key for the store
 * @returns The injected store
 * @throws Error if store was not provided
 *
 * @example
 * ```vue
 * <!-- Child component -->
 * <script setup>
 * import { injectLatticeStore, useStore } from '@lattice/frameworks/vue'
 * 
 * const counterStore = injectLatticeStore('counter')
 * const count = useStore(counterStore, s => s.value())
 * </script>
 *
 * <template>
 *   <button @click="counterStore.increment()">{{ count }}</button>
 * </template>
 * ```
 */
export function injectLatticeStore<T>(key: string): T {
  const injectionKey = getOrCreateStoreKey<T>(key);
  const store = inject(injectionKey);

  if (!store) {
    throw new Error(
      `Lattice store with key "${key}" was not found in the component tree. Make sure it's provided by a parent component using provideLatticeStore().`
    );
  }

  return store;
}