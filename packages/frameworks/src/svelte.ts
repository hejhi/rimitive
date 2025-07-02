/**
 * @fileoverview Svelte integration for Lattice behavioral components
 *
 * Provides idiomatic Svelte integration for Lattice's signal-based component system.
 * Lattice signals naturally align with Svelte's store contract.
 */

import type { Signal, Computed, ComponentContext, ComponentFactory } from '@lattice/core';
import type { Readable } from 'svelte/store';

/**
 * Check if a value is a signal or computed (has subscribe method)
 */
function isSignal(value: unknown): value is Signal<unknown> | Computed<unknown> {
  return typeof value === 'function' && 
         value !== null &&
         'subscribe' in value &&
         typeof value.subscribe === 'function';
}

/**
 * Creates a Svelte store from a Lattice behavioral component.
 * 
 * This function bridges Lattice's signal-based reactivity with Svelte's store system.
 * The returned store updates whenever any signal in the component changes.
 *
 * @param context - A component context created with createComponent
 * @param factory - A component factory function that defines behavior
 * @returns A Svelte-compatible store containing the component instance
 *
 * @example
 * ```svelte
 * <script>
 * import { createComponent } from '@lattice/core';
 * import { component } from '@lattice/frameworks/svelte';
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
 *   })),
 *   
 *   open: () => set(store.isOpen, true),
 *   close: () => set(store.isOpen, false),
 * });
 * 
 * // Create Svelte store
 * const dialog = component(dialogContext, Dialog);
 * </script>
 * 
 * <button {...$dialog.triggerProps()} on:click={$dialog.open}>
 *   Open Dialog
 * </button>
 * 
 * {#if $dialog.isOpen()}
 *   <div role="dialog">
 *     <h2>{$dialog.title()}</h2>
 *     <button on:click={$dialog.close}>Close</button>
 *   </div>
 * {/if}
 * ```
 */
export function component<State, Component>(
  context: ComponentContext<State>,
  factory: ComponentFactory<State>
): Readable<Component> {
  // Create component instance
  const componentInstance = factory(context) as Component;
  
  const subscribers = new Set<(value: Component) => void>();
  let unsubscribers: (() => void)[] = [];
  
  function setupSubscriptions() {
    // Clean up existing subscriptions
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
    
    // Subscribe to all signals in the component
    const subscribeToValue = (value: unknown) => {
      if (isSignal(value)) {
        const unsubscribe = value.subscribe(() => {
          // Notify all subscribers when any signal changes
          subscribers.forEach(fn => fn(componentInstance));
        });
        unsubscribers.push(unsubscribe);
      }
    };
    
    // Subscribe to store signals
    Object.values(context.store).forEach(subscribeToValue);
    
    // Subscribe to component signals/computeds
    Object.values(componentInstance as Record<string, unknown>).forEach(subscribeToValue);
  }
  
  return {
    subscribe(fn: (value: Component) => void) {
      if (subscribers.size === 0) {
        setupSubscriptions();
      }
      
      subscribers.add(fn);
      fn(componentInstance); // Call immediately with current value
      
      return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          // Clean up signal subscriptions when no more subscribers
          unsubscribers.forEach(unsub => unsub());
          unsubscribers = [];
        }
      };
    }
  };
}

/**
 * Creates a Svelte store from a Lattice signal.
 *
 * Since Lattice signals already implement most of Svelte's store contract,
 * this is a thin wrapper that ensures full compatibility.
 *
 * @param signal - A Lattice signal or computed
 * @returns A Svelte-compatible store
 *
 * @example
 * ```svelte
 * <script>
 * import { signal } from '@lattice/frameworks/svelte';
 * 
 * const count = signal(myCountSignal);
 * const doubled = signal(myDoubledComputed);
 * </script>
 * 
 * <div>Count: {$count}</div>
 * <div>Doubled: {$doubled}</div>
 * ```
 */
export function signal<T>(signal: Signal<T> | Computed<T>): Readable<T> {
  return {
    subscribe(run: (value: T) => void) {
      // Initial value
      run(signal());
      
      // Subscribe to changes
      const unsubscribe = signal.subscribe(() => {
        run(signal());
      });
      
      return unsubscribe;
    }
  };
}

/**
 * Creates a derived Svelte store from multiple signals.
 * 
 * This is useful for creating computed values that depend on multiple signals
 * or for transforming signal values for display.
 *
 * @param signals - Array of signals to derive from
 * @param fn - Derivation function
 * @returns A derived Svelte store
 *
 * @example
 * ```svelte
 * <script>
 * import { derived } from '@lattice/frameworks/svelte';
 * 
 * const totalPrice = derived(
 *   [priceSignal, taxRateSignal],
 *   ([price, taxRate]) => price * (1 + taxRate)
 * );
 * </script>
 * 
 * <div>Total: ${$totalPrice.toFixed(2)}</div>
 * ```
 */
export function derived<R>(
  signals: (Signal<unknown> | Computed<unknown>)[],
  fn: (values: unknown[]) => R
): Readable<R> {
  const subscribers = new Set<(value: R) => void>();
  let unsubscribers: (() => void)[] = [];
  
  function getValue(): R {
    const values = signals.map(s => s());
    return fn(values);
  }
  
  function setupSubscriptions() {
    // Clean up existing subscriptions
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
    
    // Subscribe to all signals
    signals.forEach(signal => {
      const unsubscribe = signal.subscribe(() => {
        const newValue = getValue();
        subscribers.forEach(fn => fn(newValue));
      });
      unsubscribers.push(unsubscribe);
    });
  }
  
  return {
    subscribe(fn: (value: R) => void) {
      if (subscribers.size === 0) {
        setupSubscriptions();
      }
      
      subscribers.add(fn);
      fn(getValue()); // Call immediately with current value
      
      return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
          // Clean up when no more subscribers
          unsubscribers.forEach(unsub => unsub());
          unsubscribers = [];
        }
      };
    }
  };
}