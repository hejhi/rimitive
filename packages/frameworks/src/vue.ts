/**
 * @fileoverview Vue composables for Lattice behavioral components
 *
 * Provides idiomatic Vue 3 integration for Lattice's signal-based component system.
 * Components are composed from behavioral logic and reactive state.
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

import type { Signal, Computed, ComponentContext, ComponentFactory } from '@lattice/core';

// Map for injection keys - bounded by string keys used in app
const COMPONENT_INJECTION_KEYS = new Map<string, InjectionKey<unknown>>();

/**
 * Creates or retrieves an injection key for a given component key.
 */
function getOrCreateComponentKey<T>(key: string): InjectionKey<T> {
  if (!COMPONENT_INJECTION_KEYS.has(key)) {
    COMPONENT_INJECTION_KEYS.set(
      key,
      Symbol(`lattice-component-${key}`) as InjectionKey<T>
    );
  }
  return COMPONENT_INJECTION_KEYS.get(key) as InjectionKey<T>;
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
 * Vue composable for using Lattice behavioral components.
 *
 * This composable bridges Lattice's signal-based reactivity with Vue's reactivity system.
 * It creates and manages a component instance with automatic subscription to all signals.
 *
 * @param context - A component context created with createComponent
 * @param factory - A component factory function that defines behavior
 * @returns ComputedRef containing the component instance
 *
 * @example
 * ```vue
 * <script setup>
 * import { createComponent } from '@lattice/core';
 * import { useComponent } from '@lattice/frameworks/vue';
 * 
 * // Create component context
 * const dialogContext = createComponent({
 *   isOpen: false,
 *   title: 'Welcome',
 * });
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
 * // Use in Vue component
 * const dialog = useComponent(dialogContext, Dialog);
 * </script>
 *
 * <template>
 *   <button v-bind="dialog.triggerProps()">Open Dialog</button>
 *   <div v-if="dialog.isOpen()" role="dialog">
 *     <h2>{{ dialog.title() }}</h2>
 *     <button @click="dialog.close">Close</button>
 *   </div>
 * </template>
 * ```
 */
export function useComponent<State extends Record<string, any>, Component>(
  context: ComponentContext<State>,
  factory: ComponentFactory<State>
): ComputedRef<Component> {
  // Create version ref to trigger Vue updates
  const version = ref(0);
  const unsubscribers: (() => void)[] = [];
  
  // Create component instance
  const component = factory(context);
  
  // Subscribe to all signals
  const subscribeToValue = (value: any) => {
    if (isSignal(value)) {
      const unsubscribe = value.subscribe(() => {
        version.value++;
      });
      unsubscribers.push(unsubscribe);
    }
  };
  
  // Subscribe to store signals
  Object.values(context.store).forEach(subscribeToValue);
  
  // Subscribe to component signals/computeds
  Object.values(component as any).forEach(subscribeToValue);
  
  // Create reactive computed that tracks version
  const reactiveComponent = vueComputed(() => {
    version.value; // Track version to trigger re-evaluation
    return component;
  });
  
  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });
  
  return reactiveComponent;
}

/**
 * Vue composable for using individual signals.
 *
 * This provides a direct way to use Lattice signals in Vue templates
 * with automatic reactivity.
 *
 * @param signal - A Lattice signal or computed
 * @returns ComputedRef that updates when the signal changes
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSignal } from '@lattice/frameworks/vue';
 * 
 * const count = useSignal(myCountSignal);
 * const doubled = useSignal(myDoubledComputed);
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
 * Provides a Lattice component context for dependency injection.
 *
 * This enables clean separation of component creation from usage, allowing child
 * components to access contexts without prop drilling.
 *
 * @param key - Unique string key for the component
 * @param context - The component context to provide
 *
 * @example
 * ```vue
 * <!-- Parent component -->
 * <script setup>
 * import { createComponent } from '@lattice/core';
 * import { provideComponent } from '@lattice/frameworks/vue';
 * 
 * const dialogContext = createComponent({
 *   isOpen: false,
 *   title: '',
 * });
 * 
 * provideComponent('dialog', dialogContext);
 * </script>
 *
 * <template>
 *   <ChildComponent />
 * </template>
 * ```
 */
export function provideComponent<T>(
  key: string,
  context: T
): void {
  const injectionKey = getOrCreateComponentKey<T>(key);
  provide(injectionKey, context);
}

/**
 * Injects a Lattice component context from the component tree.
 *
 * This allows child components to access contexts provided by parent components
 * without explicit prop passing.
 *
 * @param key - Unique string key for the component
 * @returns The injected component context
 * @throws Error if context was not provided
 *
 * @example
 * ```vue
 * <!-- Child component -->
 * <script setup>
 * import { injectComponent, useComponent } from '@lattice/frameworks/vue';
 * import { Dialog } from './components';
 * 
 * const dialogContext = injectComponent('dialog');
 * const dialog = useComponent(dialogContext, Dialog);
 * </script>
 *
 * <template>
 *   <button @click="dialog.open">Open Dialog</button>
 * </template>
 * ```
 */
export function injectComponent<T>(key: string): T {
  const injectionKey = getOrCreateComponentKey<T>(key);
  const context = inject(injectionKey);

  if (!context) {
    throw new Error(
      `Lattice component context with key "${key}" was not found in the component tree. Make sure it's provided by a parent component using provideComponent().`
    );
  }

  return context;
}

/**
 * Vue composable for creating derived state from signals.
 * 
 * This is useful for creating computed values that depend on multiple signals
 * or for transforming signal values for display.
 *
 * @param compute - A function that computes a value from signals
 * @param signals - Signal dependencies to track
 * @returns ComputedRef with the computed value
 *
 * @example
 * ```vue
 * <script setup>
 * import { useComputed } from '@lattice/frameworks/vue';
 * 
 * const totalPrice = useComputed(
 *   () => priceSignal() * (1 + taxRateSignal()),
 *   [priceSignal, taxRateSignal]
 * );
 * </script>
 *
 * <template>
 *   <div>Total: ${{ totalPrice.toFixed(2) }}</div>
 * </template>
 * ```
 */
export function useComputed<T>(
  compute: () => T,
  signals: (Signal<any> | Computed<any>)[]
): ComputedRef<T> {
  const version = ref(0);
  const unsubscribers: (() => void)[] = [];

  // Subscribe to all provided signals
  signals.forEach(signal => {
    const unsubscribe = signal.subscribe(() => {
      version.value++;
    });
    unsubscribers.push(unsubscribe);
  });

  onUnmounted(() => {
    unsubscribers.forEach(unsub => unsub());
  });

  return vueComputed(() => {
    version.value; // Track version for reactivity
    return compute();
  });
}