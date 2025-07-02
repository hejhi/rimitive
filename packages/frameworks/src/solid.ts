/**
 * @fileoverview Solid.js bindings for Lattice behavioral components
 *
 * Provides idiomatic Solid integration for Lattice's signal-based component system.
 * Leverages Solid's fine-grained reactivity to create seamless integration.
 */

import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  type Accessor,
  type Setter,
} from 'solid-js';
import {
  createComponent,
  type Signal,
  type Computed,
  type ComponentContext,
} from '@lattice/core';

/**
 * Solid hook for creating component-scoped Lattice behavioral components.
 *
 * This hook creates a new component instance with its own state that is scoped
 * to the Solid component's lifecycle. Perfect for UI components that need
 * isolated state management.
 *
 * @param initialState - The initial state for the component
 * @param factory - A component factory function that defines behavior
 * @returns The component instance with all behaviors and reactive state
 *
 * @example
 * ```tsx
 * import { useComponent } from '@lattice/frameworks/solid';
 * import { createSignal } from 'solid-js';
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
 * // Use in Solid component with component-scoped state
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
  factory: (context: ComponentContext<State>) => Component
): Component {
  const context = createComponent(initialState);
  return factory(context);
}

/**
 * Creates a Solid signal that syncs with a Lattice signal.
 * Returns a tuple of [accessor, setter] matching Solid's createSignal pattern.
 *
 * @param signal - A Lattice signal
 * @param setter - Optional setter function for two-way binding
 * @returns A Solid signal tuple [accessor, setter]
 *
 * @example
 * ```tsx
 * import { createSyncedSignal } from '@lattice/frameworks/solid';
 *
 * function Counter() {
 *   const counter = useComponent({ count: 0 }, CounterFactory);
 *   const [count, setCount] = createSyncedSignal(
 *     counter.count,
 *     counter.setCount
 *   );
 *
 *   // Can use either Solid or Lattice APIs
 *   return (
 *     <div>
 *       <span>{count()}</span>
 *       <button onClick={() => setCount(c => c + 1)}>+</button>
 *       <button onClick={counter.increment}>+</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function createSyncedSignal<T>(
  signal: Signal<T> | Computed<T>,
  setter?: (value: T | ((prev: T) => T)) => void
): [Accessor<T>, Setter<T>] {
  // Create a Solid signal initialized with Lattice signal value
  const [value, setValue] = createSignal<T>(signal());
  
  // Sync Lattice changes to Solid
  const unsubscribe = signal.subscribe(() => {
    setValue(() => signal());
  });
  
  onCleanup(() => unsubscribe());
  
  // Create setter that updates both if provided
  const syncedSetter: Setter<T> = setter
    ? ((v: T | ((prev: T) => T)) => {
        const newValue = typeof v === 'function' 
          ? (v as (prev: T) => T)(signal())
          : v;
        setter(newValue);
        setValue(() => newValue);
      }) as Setter<T>
    : setValue;
  
  return [value, syncedSetter];
}

/**
 * Creates a derived value using Solid's reactivity with Lattice signals.
 * Unlike React's useComputed, this leverages Solid's createMemo directly.
 *
 * @param compute - A function that computes a value from signals
 * @returns A Solid accessor for the computed value
 *
 * @example
 * ```tsx
 * function Cart({ cartStore }) {
 *   const totalPrice = createComputed(() => {
 *     const items = cartStore.items();
 *     const taxRate = cartStore.taxRate();
 *     const subtotal = items.reduce((sum, item) => sum + item.price, 0);
 *     return subtotal * (1 + taxRate);
 *   });
 *
 *   return <div>Total: ${totalPrice().toFixed(2)}</div>;
 * }
 * ```
 */
export function createComputed<T>(compute: () => T): Accessor<T> {
  return createMemo(compute);
}

/**
 * Creates an effect that runs when Lattice signals change.
 * Wraps Solid's createEffect for consistency.
 *
 * @param effect - The effect function to run
 *
 * @example
 * ```tsx
 * function AuthGuard() {
 *   const auth = useAuth();
 *   const navigate = useNavigate();
 *
 *   createLatticeEffect(() => {
 *     if (!auth.isAuthenticated()) {
 *       navigate('/login');
 *     }
 *   });
 *
 *   return <Outlet />;
 * }
 * ```
 */
export function createLatticeEffect(effect: () => void): void {
  createEffect(effect);
}

/**
 * Utility for creating a Lattice component outside of a Solid component.
 * Useful for global stores or when you need to create components dynamically.
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
 *   const [user] = createSyncedSignal(auth.user);
 *   
 *   return (
 *     <nav>
 *       {user() ? (
 *         <UserMenu user={user()} onLogout={auth.logout} />
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
  factory: (context: ComponentContext<State>) => Component
): Component {
  const context = createComponent(initialState);
  return factory(context);
}

/**
 * Creates a reactive binding for use with Solid's model directives.
 * Perfect for form inputs and two-way data binding.
 *
 * @param signal - A Lattice signal
 * @param setter - The setter function
 * @returns An object with getter/setter for Solid's model binding
 *
 * @example
 * ```tsx
 * function Form() {
 *   const form = useComponent(
 *     { name: '', email: '' },
 *     FormFactory
 *   );
 *
 *   return (
 *     <form>
 *       <input
 *         type="text"
 *         value={form.name()}
 *         onInput={(e) => form.setName(e.currentTarget.value)}
 *       />
 *       <!-- Or with model binding -->
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
 * Creates a store that can be used with Solid's context API
 *
 * @example
 * ```tsx
 * // Create context
 * const ThemeContext = createContext<ThemeStore>();
 *
 * // Create provider
 * export function ThemeProvider(props) {
 *   const theme = useComponent(
 *     { mode: 'light', primary: '#007bff' },
 *     ThemeFactory
 *   );
 *
 *   return (
 *     <ThemeContext.Provider value={theme}>
 *       {props.children}
 *     </ThemeContext.Provider>
 *   );
 * }
 *
 * // Use in components
 * function ThemedButton() {
 *   const theme = useContext(ThemeContext);
 *   
 *   return (
 *     <button
 *       style={{
 *         background: theme.primary(),
 *         color: theme.mode() === 'dark' ? 'white' : 'black'
 *       }}
 *     >
 *       Click me
 *     </button>
 *   );
 * }
 * ```
 */
export { createContext, useContext } from 'solid-js';