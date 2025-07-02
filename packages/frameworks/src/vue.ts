/**
 * @fileoverview Vue 3 Composition API bindings for Lattice behavioral components
 *
 * Provides idiomatic Vue integration for Lattice's signal-based component system.
 * Supports both component-scoped and shared/global behavior patterns with fine-grained reactivity.
 */

import { 
  shallowRef, 
  watchEffect, 
  onScopeDispose,
  computed as vueComputed,
  type ComputedRef,
  type ShallowRef
} from 'vue';
import {
  createComponent,
  type Signal,
  type Computed,
  type ComponentFactory,
} from '@lattice/core';

/**
 * Vue composable for creating component-scoped Lattice behavioral components.
 *
 * This composable creates a new component instance with its own state that is scoped
 * to the Vue component's lifecycle. Perfect for UI components that need
 * isolated state management.
 *
 * @param initialState - The initial state for the component
 * @param factory - A component factory function that defines behavior
 * @returns The component instance with all behaviors and reactive state
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useComponent, toRef } from '@lattice/frameworks/vue';
 *
 * // Define component behavior
 * const Dialog = ({ store, computed, set }) => ({
 *   isOpen: store.isOpen,
 *   title: store.title,
 *
 *   triggerProps: computed(() => ({
 *     'aria-haspopup': 'dialog',
 *     'aria-expanded': store.isOpen(),
 *     onClick: () => set(store.isOpen, true),
 *   })),
 *
 *   open: () => set(store.isOpen, true),
 *   close: () => set(store.isOpen, false),
 * });
 *
 * // Use in Vue component with component-scoped state
 * const dialog = useComponent(
 *   { isOpen: false, title: 'Welcome' },
 *   Dialog
 * );
 * 
 * // Convert signals to Vue refs for template usage
 * const isOpen = toRef(dialog.isOpen);
 * const triggerProps = toRef(dialog.triggerProps);
 * </script>
 *
 * <template>
 *   <button v-bind="triggerProps">Open Dialog</button>
 *   <div v-if="isOpen" role="dialog">
 *     <h2>{{ dialog.title() }}</h2>
 *     <button @click="dialog.close">Close</button>
 *   </div>
 * </template>
 * ```
 */
export function useComponent<State extends Record<string, unknown>, Component = unknown>(
  initialState: State,
  factory: ComponentFactory<State>
): Component {
  // Create component context and instance
  const context = createComponent(initialState);
  const component = factory(context) as Component;
  
  // Cleanup will be handled by Vue's component lifecycle
  return component;
}

/**
 * Converts a Lattice signal to a Vue ref for reactive template usage.
 * Re-renders the component only when this specific signal changes.
 *
 * This is the key to Lattice's fine-grained reactivity in Vue.
 * Only convert the signals you actually use in your template.
 *
 * @param signal - A signal or computed value
 * @returns A Vue ref that tracks the signal value
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { toRef } from '@lattice/frameworks/vue';
 *
 * const props = defineProps<{ userStore: UserStore }>();
 * 
 * // Only re-renders when the name changes
 * const name = toRef(props.userStore.name);
 * </script>
 *
 * <template>
 *   <!-- Does NOT re-render when email changes -->
 *   <h1>Welcome, {{ name }}!</h1>
 * </template>
 * ```
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * // Using with shared/global state
 * const authContext = createComponent({ user: null });
 * const auth = Auth(authContext);
 * 
 * const user = toRef(auth.user);
 * </script>
 *
 * <template>
 *   <div v-if="user">Welcome {{ user.name }}</div>
 *   <Login v-else />
 * </template>
 * ```
 */
export function toRef<T>(signal: Signal<T> | Computed<T>): ComputedRef<T> {
  // Use shallowRef for better performance with objects
  const ref = shallowRef(signal());
  
  // Set up subscription with automatic cleanup
  const unsubscribe = signal.subscribe(() => {
    ref.value = signal();
  });
  
  // Clean up subscription when component is destroyed
  onScopeDispose(unsubscribe);
  
  // Return as a computed ref to maintain readonly behavior and proper typing
  return vueComputed<T>(() => ref.value as T);
}

/**
 * Alternative to toRef that returns a writable ref.
 * Changes to the ref will update the underlying signal.
 *
 * @param signal - A signal (not computed) value
 * @returns A two-way bound Vue ref
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { toWritableRef } from '@lattice/frameworks/vue';
 *
 * const settings = useComponent({ theme: 'light' }, Settings);
 * const theme = toWritableRef(settings.theme, settings.setTheme);
 * </script>
 *
 * <template>
 *   <select v-model="theme">
 *     <option value="light">Light</option>
 *     <option value="dark">Dark</option>
 *   </select>
 * </template>
 * ```
 */
export function toWritableRef<T>(
  signal: Signal<T>,
  setter: (value: T) => void
): ShallowRef<T> {
  const ref = shallowRef<T>(signal());
  
  // Subscribe to signal changes
  const unsubscribe = signal.subscribe(() => {
    ref.value = signal();
  });
  
  // Watch ref changes and update signal
  watchEffect(() => {
    setter(ref.value as T);
  });
  
  onScopeDispose(unsubscribe);
  
  return ref;
}

/**
 * Vue composable for creating derived state from signals.
 *
 * This is a convenience wrapper that creates a Lattice computed and converts it to a Vue ref.
 * For most cases, you can use `toRef` with a Lattice computed directly.
 *
 * @param compute - A function that computes a value from signals
 * @returns A Vue computed ref with the derived value
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useComputed, useComponent } from '@lattice/frameworks/vue';
 *
 * const cart = useComponent({ items: [], taxRate: 0.08 }, CartStore);
 *
 * // Using useComputed (creates a Lattice computed internally)
 * const totalPrice = useComputed(() => {
 *   const items = cart.items();
 *   const taxRate = cart.taxRate();
 *   const subtotal = items.reduce((sum, item) => sum + item.price, 0);
 *   return subtotal * (1 + taxRate);
 * });
 * </script>
 *
 * <template>
 *   <div>Total: ${{ totalPrice.toFixed(2) }}</div>
 * </template>
 * ```
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * // Alternative: Define computed in the component factory
 * const CartWithTotal = ({ store, computed }) => ({
 *   items: store.items,
 *   taxRate: store.taxRate,
 *   total: computed(() => {
 *     const items = store.items();
 *     const taxRate = store.taxRate();
 *     const subtotal = items.reduce((sum, item) => sum + item.price, 0);
 *     return subtotal * (1 + taxRate);
 *   })
 * });
 *
 * const cart = useComponent({ items: [], taxRate: 0.08 }, CartWithTotal);
 * const total = toRef(cart.total); // Convert to Vue ref
 * </script>
 * ```
 */
export function useComputed<T>(compute: () => T): ComputedRef<T> {
  // Create a Lattice computed using a temporary context
  const context = createComponent({});
  const latticeComputed = context.computed(compute);
  
  // Convert to Vue ref
  return toRef(latticeComputed);
}

/**
 * Vue composable that runs a side effect whenever signals change.
 * 
 * This creates a Lattice effect that properly tracks signal dependencies.
 * The effect will re-run whenever any accessed signals change.
 *
 * @param effect - The effect function to run
 * @param options - Optional configuration
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSignalEffect, useComponent } from '@lattice/frameworks/vue';
 *
 * const auth = useComponent({ isAuthenticated: false }, AuthStore);
 * const router = useRouter();
 *
 * useSignalEffect(() => {
 *   if (!auth.isAuthenticated()) {
 *     router.push('/login');
 *   }
 * });
 * </script>
 * ```
 */
export function useSignalEffect(
  effect: () => void,
  options?: { immediate?: boolean }
): void {
  // Create a Lattice context to get the effect function
  const context = createComponent({});
  
  if (options?.immediate === false) {
    // Defer initial execution
    let isFirst = true;
    const stop = context.effect(() => {
      if (isFirst) {
        isFirst = false;
        return;
      }
      effect();
    });
    onScopeDispose(stop);
  } else {
    // Run immediately and on changes
    const stop = context.effect(effect);
    onScopeDispose(stop);
  }
}

/**
 * Type helper for props that accept Lattice components
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import type { LatticeProps } from '@lattice/frameworks/vue';
 * import type { TodoStore } from './stores';
 *
 * defineProps<{
 *   todo: LatticeProps<TodoStore>
 * }>();
 * </script>
 * ```
 */
export type LatticeProps<T> = T;

/**
 * Type helper for emits that work with Lattice events
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import type { LatticeEmits } from '@lattice/frameworks/vue';
 *
 * const emit = defineEmits<{
 *   change: LatticeEmits<[value: string]>
 *   close: LatticeEmits<[]>
 * }>();
 * </script>
 * ```
 */
export type LatticeEmits<T extends unknown[]> = (...args: T) => void;