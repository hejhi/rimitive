/**
 * @fileoverview Solid-native Lattice implementation
 *
 * Provides Lattice's component patterns using Solid's native reactivity primitives.
 * This eliminates the double-reactivity overhead and provides seamless Solid integration.
 */

import {
  createSignal,
  createMemo,
  createEffect,
  batch,
  createRoot,
  type Accessor,
  type Setter,
} from 'solid-js';
import type {
  ComponentContext,
  ComponentFactory,
  SetState,
  Signal,
  SignalState,
  Computed,
} from '@lattice/core';

// Internal type to track setter
interface SignalWithSetter<T> extends Signal<T> {
  _setter: Setter<T>;
}

/**
 * Wraps a Solid signal to match Lattice's Signal interface
 */
function wrapSolidSignal<T>(accessor: Accessor<T>, setter: Setter<T>): Signal<T> {
  const signal = Object.assign(accessor, {
    subscribe: (listener: () => void) => {
      let dispose: (() => void) | undefined;
      
      createRoot((rootDispose) => {
        let isFirst = true;
        createEffect(() => {
          accessor(); // Track the signal
          if (!isFirst) {
            listener();
          }
          isFirst = false;
        });
        dispose = rootDispose;
      });
      
      return dispose || (() => {});
    },
    _setter: setter,
  }) as SignalWithSetter<T>;
  
  return signal;
}

/**
 * Wraps a Solid memo to match Lattice's Computed interface
 */
function wrapSolidMemo<T>(accessor: Accessor<T>): Computed<T> {
  return Object.assign(accessor, {
    subscribe: (listener: () => void) => {
      let dispose: (() => void) | undefined;
      
      createRoot((rootDispose) => {
        let isFirst = true;
        createEffect(() => {
          accessor(); // Track the memo
          if (!isFirst) {
            listener();
          }
          isFirst = false;
        });
        dispose = rootDispose;
      });
      
      return dispose || (() => {});
    },
  }) as Computed<T>;
}

/**
 * Creates a Solid-native component context that matches Lattice's interface
 */
function createSolidContext<State extends object>(
  initialState: State
): ComponentContext<State> {
  // Create signals for state
  const stateSignals = {} as SignalState<State>;
  const setters = {} as Record<keyof State, Setter<State[keyof State]>>;
  
  // Initialize signals for all state keys
  (Object.keys(initialState) as (keyof State)[]).forEach((key) => {
    const [accessor, setter] = createSignal(initialState[key]);
    stateSignals[key] = wrapSolidSignal(accessor, setter);
    setters[key] = setter;
  });
  
  // Create set function that matches Lattice's API
  const set: SetState = ((
    target: Signal<unknown> | SignalState<State>,
    updates?: unknown
  ) => {
    // Batch update on the store
    if (target === stateSignals) {
      batch(() => {
        // Get current state
        const currentState = {} as State;
        (Object.keys(stateSignals) as (keyof State)[]).forEach((key) => {
          currentState[key] = stateSignals[key]();
        });
        
        // Calculate new state
        const newState =
          typeof updates === 'function'
            ? (updates as (prev: State) => Partial<State>)(currentState)
            : updates as Partial<State>;
        
        // Update each changed signal
        (Object.entries(newState) as [keyof State, State[keyof State]][]).forEach(
          ([key, value]) => {
            if (key in setters && !Object.is(stateSignals[key](), value)) {
              setters[key](() => value);
            }
          }
        );
      });
      return;
    }
    
    // Single signal update
    const signal = target as SignalWithSetter<unknown>;
    const setter = signal._setter;
    
    if (!setter) {
      throw new Error('Cannot set a computed or read-only signal');
    }
    
    if (typeof updates === 'function') {
      setter((prev) => {
        if (prev === undefined) return prev;
        return (updates as (prev: unknown) => unknown)(prev);
      });
    } else if (typeof updates === 'object' && updates !== null && !Array.isArray(updates)) {
      // Partial update for objects
      setter((prev) => {
        if (prev === undefined || typeof prev !== 'object' || prev === null) return prev;
        return { ...prev, ...updates };
      });
    } else {
      // Direct value set
      setter(() => updates);
    }
  }) as SetState;
  
  // Create context with Solid primitives
  const context: ComponentContext<State> = {
    store: stateSignals,
    signal: <T>(initialValue: T) => {
      const [accessor, setter] = createSignal(initialValue);
      return wrapSolidSignal(accessor, setter);
    },
    computed: <T>(computeFn: () => T) => {
      const memo = createMemo(computeFn);
      return wrapSolidMemo(memo);
    },
    effect: (effectFn: () => void | (() => void)) => {
      let cleanup: void | (() => void);
      let dispose: (() => void) | undefined;
      
      createRoot((rootDispose) => {
        createEffect(() => {
          if (cleanup) cleanup();
          cleanup = effectFn();
        });
        dispose = rootDispose;
      });
      
      return () => {
        if (cleanup) cleanup();
        if (dispose) dispose();
      };
    },
    set,
  };
  
  return context;
}

/**
 * Solid hook for creating component-scoped Lattice behavioral components.
 * Uses Solid's reactivity primitives natively.
 *
 * @param initialState - The initial state for the component
 * @param factory - A component factory function that defines behavior
 * @returns The component instance with all behaviors and reactive state
 *
 * @example
 * ```tsx
 * import { useComponent } from '@lattice/frameworks/solid';
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
 * // Use in Solid component
 * function MyDialog() {
 *   const dialog = useComponent(
 *     { isOpen: false, title: 'Welcome' },
 *     Dialog
 *   );
 *
 *   return (
 *     <>
 *       <button {...dialog.triggerProps()}>Open Dialog</button>
 *       {dialog.isOpen() && (
 *         <div role="dialog">
 *           <h2>{dialog.title()}</h2>
 *           <button onClick={dialog.close}>Close</button>
 *         </div>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useComponent<State extends Record<string, unknown>, Component>(
  initialState: State,
  factory: ComponentFactory<State>
): Component {
  const context = createSolidContext(initialState);
  return factory(context) as Component;
}

/**
 * Creates a Lattice component with Solid primitives.
 * Useful for global stores or dynamic component creation.
 *
 * @param initialState - The initial state
 * @param factory - The component factory
 * @returns The component instance
 *
 * @example
 * ```tsx
 * // Global auth store
 * export const auth = createLatticeComponent(
 *   { user: null, token: null },
 *   AuthFactory
 * );
 *
 * // Use in any component
 * function NavBar() {
 *   return (
 *     <nav>
 *       {auth.user() ? (
 *         <UserMenu user={auth.user()} onLogout={auth.logout} />
 *       ) : (
 *         <LoginButton onClick={auth.login} />
 *       )}
 *     </nav>
 *   );
 * }
 * ```
 */
export function createLatticeComponent<State extends Record<string, unknown>, Component>(
  initialState: State,
  factory: ComponentFactory<State>
): Component {
  const context = createSolidContext(initialState);
  return factory(context) as Component;
}

/**
 * Creates a reactive binding for use with form inputs.
 * Returns props for two-way data binding.
 *
 * @param signal - A Lattice signal
 * @param setter - The setter function (can be derived from set)
 * @returns An object with value and onInput props
 *
 * @example
 * ```tsx
 * function Form() {
 *   const form = useComponent(
 *     { name: '', email: '' },
 *     ({ store, set }) => ({
 *       name: store.name,
 *       email: store.email,
 *       setName: (v: string) => set(store.name, v),
 *       setEmail: (v: string) => set(store.email, v),
 *     })
 *   );
 *
 *   return (
 *     <form>
 *       <input
 *         type="text"
 *         {...model(form.name, form.setName)}
 *       />
 *       <input
 *         type="email"
 *         {...model(form.email, form.setEmail)}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export function model<T>(
  signal: Signal<T> | Computed<T>,
  setter: (value: T) => void
): {
  value: T;
  onInput: (e: InputEvent & { currentTarget: HTMLInputElement }) => void;
} {
  return {
    get value() {
      return signal();
    },
    onInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
      setter(e.currentTarget.value as T);
    },
  };
}

/**
 * Type helper for props that accept Lattice components
 *
 * @example
 * ```tsx
 * import type { LatticeProps } from '@lattice/frameworks/solid';
 * import type { TodoStore } from './stores';
 *
 * type TodoItemProps = {
 *   todo: LatticeProps<TodoStore>;
 *   onComplete?: () => void;
 * };
 * ```
 */
export type LatticeProps<T> = T;

/**
 * Re-export Solid's context API for convenience
 */
export { createContext, useContext } from 'solid-js';

/**
 * Re-export common Solid utilities that work well with Lattice
 */
export { batch, onCleanup, onMount } from 'solid-js';