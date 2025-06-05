/**
 * @fileoverview Pure React adapter for Lattice
 *
 * This adapter provides integration using only React's built-in hooks,
 * implementing the Lattice adapter specification without external dependencies.
 * It creates reactive stores using useState and useRef, with proper lifecycle
 * management tied to React components.
 *
 * Key features:
 * - Zero external dependencies - pure React implementation
 * - Automatic cleanup on component unmount (listeners cleared)
 * - Full support for compose() and slice composition
 * - Type-safe component execution
 * - Compatible with React's concurrent features via useSyncExternalStore
 * - Fine-grained updates: subscribers only re-run when their selected values change
 * - React 18 automatic batching with startTransition for optimal performance
 */

import React, { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import type {
  ComponentFactory,
  ComponentSpec,
  SliceFactory,
  AdapterResult,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import { createRuntime } from '@lattice/runtime';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for React adapter errors with helpful context
 */
export class ReactAdapterError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    const errorMessage =
      context.cause instanceof Error ? context.cause.message : message;

    super(errorMessage);
    this.name = 'ReactAdapterError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReactAdapterError);
    }

    if (context.cause instanceof Error && context.cause.stack) {
      const stackLines = context.cause.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    } else if (this.stack) {
      const stackLines = this.stack.split('\n');
      stackLines[0] = `${this.name}: ${errorMessage} [${context.operation}]`;
      this.stack = stackLines.join('\n');
    }
  }
}

// ============================================================================
// Core Types
// ============================================================================

/**
 * Internal store interface for managing subscriptions
 */
interface ReactStore<Model> {
  state: Model;
  listeners: Set<() => void>;
  // Using unknown for type-safe internal storage of heterogeneous listeners
  selectiveListeners: Set<SelectiveListener<unknown>>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Model;
}

/**
 * Enhanced listener that tracks selector results for fine-grained updates
 */
interface SelectiveListener<T> {
  selector: () => T;
  callback: (value: T) => void;
  previousValue?: T;
}

/**
 * Subscription callback type
 */
type SubscribeCallback<T> = (value: T) => void;

// ============================================================================
// Main Hook Implementation
// ============================================================================

/**
 * Creates a Lattice store using only React hooks.
 *
 * This hook creates a component-scoped store that:
 * - Lives within React's lifecycle (created on mount, destroyed on unmount)
 * - Provides a subscribable store interface compatible with useViews/useComputedView
 * - Uses React state for reactivity
 * - Maintains compatibility with all Lattice patterns
 *
 * @param componentOrFactory - The Lattice component spec or factory
 * @returns An adapter result with actions, views, and subscribe
 *
 * @example
 * ```tsx
 * function TodoApp() {
 *   const store = useLattice(todoComponent);
 *   const todos = useViews(store, v => v.todos());
 *
 *   return (
 *     <div>
 *       <button onClick={() => store.actions.addTodo('New')}>Add</button>
 *       {todos.map(todo => <div key={todo.id}>{todo.text}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLattice<Model, Actions, Views>(
  componentOrFactory:
    | ComponentSpec<Model, Actions, Views>
    | ComponentFactory<Model, Actions, Views>
    | (() => ComponentSpec<Model, Actions, Views>)
): AdapterResult<Model, Actions, Views> {
  // Get the component spec once
  const spec = useMemo(
    () =>
      typeof componentOrFactory === 'function'
        ? componentOrFactory()
        : componentOrFactory,
    [] // componentOrFactory should be stable
  );

  // Create a stable store instance
  const storeRef = useRef<ReactStore<Model>>();

  // Initialize the store once
  if (!storeRef.current) {
    const listeners = new Set<() => void>();
    const selectiveListeners = new Set<SelectiveListener<unknown>>();
    let currentState: Model;

    // Initialize with temporary model tools
    const tempTools = {
      get: (): Model => currentState!,
      set: () => {}, // No-op during initialization
    };

    try {
      currentState = spec.model(tempTools);
    } catch (error) {
      throw new ReactAdapterError('Model factory execution failed', {
        operation: 'useLattice.modelFactory',
        cause: error,
      });
    }

    storeRef.current = {
      state: currentState,
      listeners,
      selectiveListeners,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot() {
        return this.state;
      },
    };
  }

  // Use React state to trigger re-renders
  const [, forceUpdate] = useState({});

  // Create model tools that update both the store and React state
  const modelTools = useMemo(
    () => ({
      get: () => storeRef.current!.state,
      set: (updates: Partial<Model>) => {
        const store = storeRef.current!;
        const previousState = store.state;
        store.state = { ...store.state, ...updates };

        // Check which keys changed for fine-grained updates
        const changedKeys = Object.keys(updates) as (keyof Model)[];
        const hasChanges = changedKeys.some(
          key => !Object.is(previousState[key], store.state[key])
        );

        if (hasChanges) {
          // Use React 18's automatic batching for better performance
          // startTransition ensures updates are batched and non-blocking
          startTransition(() => {
            // Trigger React re-render
            forceUpdate({});
          });

          // Notify external subscribers (outside of transition for immediate updates)
          store.listeners.forEach((listener) => listener());

          // Fine-grained updates: check selective listeners
          store.selectiveListeners.forEach((listener) => {
            try {
              const currentValue = listener.selector();
              if (!Object.is(listener.previousValue, currentValue)) {
                listener.previousValue = currentValue;
                listener.callback(currentValue);
              }
            } catch (error) {
              // Silently ignore selector errors to prevent breaking other listeners
              // Selectors should handle their own errors
            }
          });
        }
      },
    }),
    []
  );

  // Re-initialize model with proper tools
  useMemo(() => {
    try {
      const model = spec.model(modelTools);
      storeRef.current!.state = model;
    } catch (error) {
      throw new ReactAdapterError('Model initialization failed', {
        operation: 'useLattice.modelInit',
        cause: error,
      });
    }
  }, [spec, modelTools]);

  // Create the adapter
  const adapter = useMemo(() => {
    return createRuntime(() => {
      const store = storeRef.current!;

      // Create slice executor that always uses current state
      const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
        try {
          return factory(store.state);
        } catch (error) {
          throw new ReactAdapterError('Slice factory execution failed', {
            operation: 'executeSliceFactory',
            details: { sliceFactory: factory.name || 'anonymous' },
            cause: error,
          });
        }
      };

      // Process actions
      let actions: Actions;
      try {
        actions = executeSliceFactory<Actions>(spec.actions);
      } catch (error) {
        throw new ReactAdapterError('Actions slice creation failed', {
          operation: 'useLattice.actions',
          cause: error,
        });
      }

      // Process views - create functions that always use current state
      const views = {} as ViewTypes<Model, Views>;

      for (const [key, view] of Object.entries(
        spec.views as Record<string, unknown>
      )) {
        if (isSliceFactory(view)) {
          // Static view: slice factory
          views[key as keyof ViewTypes<Model, Views>] = (() => 
            executeSliceFactory(view)
          ) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
        } else if (typeof view === 'function') {
          // Computed view - may accept parameters
          views[key as keyof ViewTypes<Model, Views>] = ((
            ...args: unknown[]
          ) => {
            // Call the view function with any provided args
            const result = view(...args);

            // If the result is a slice factory, execute it
            if (isSliceFactory(result)) {
              return executeSliceFactory(result);
            }

            // Otherwise return the result as-is
            return result;
          }) as ViewTypes<Model, Views>[keyof ViewTypes<Model, Views>];
        }
      }

      // Create the adapter result
      return {
        actions,
        views,
        getState: () => store.state,

        subscribe: <Selected>(
          selector: (views: ViewTypes<Model, Views>) => Selected,
          callback: SubscribeCallback<Selected>
        ) => {
          // Initialize with current value to avoid initial trigger
          const initialValue = selector(views);
          
          // Create a selective listener for fine-grained updates
          const selectiveListener: SelectiveListener<Selected> = {
            selector: () => selector(views),
            callback,
            previousValue: initialValue
          };

          // Add to selective listeners
          store.selectiveListeners.add(selectiveListener as SelectiveListener<unknown>);

          // Return unsubscribe function
          return () => {
            store.selectiveListeners.delete(selectiveListener as SelectiveListener<unknown>);
          };
        },

        destroy: () => {
          // Clear all listeners
          store.listeners.clear();
          store.selectiveListeners.clear();
        },
      };
    });
  }, [spec]); // Only recreate if spec changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all listeners to prevent memory leaks
      if (storeRef.current) {
        storeRef.current.listeners.clear();
        storeRef.current.selectiveListeners.clear();
      }
    };
  }, []);

  return adapter;
}

// ============================================================================
// React Context Support
// ============================================================================

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Context for providing Lattice stores to child components
 */
const LatticeContext = createContext<AdapterResult<unknown, unknown, unknown> | null>(null);

/**
 * Props for the Lattice provider component
 */
export interface LatticeProviderProps<Model = unknown, Actions = unknown, Views = unknown> {
  store: AdapterResult<Model, Actions, Views>;
  children: ReactNode;
}

/**
 * Provider component that provides a Lattice store to child components
 *
 * @example
 * ```tsx
 * // With React adapter
 * function App() {
 *   const store = useLattice(todoComponent);
 *   return (
 *     <LatticeProvider store={store}>
 *       <TodoList />
 *       <AddTodoForm />
 *     </LatticeProvider>
 *   );
 * }
 * 
 * // With any adapter
 * function App() {
 *   return (
 *     <LatticeProvider store={createZustandAdapter(todoComponent)}>
 *       <TodoList />
 *       <AddTodoForm />
 *     </LatticeProvider>
 *   );
 * }
 * ```
 */
export function LatticeProvider<Model, Actions, Views>({
  store,
  children,
}: LatticeProviderProps<Model, Actions, Views>) {
  return React.createElement(
    LatticeContext.Provider,
    { value: store },
    children
  );
}

/**
 * Hook to access the Lattice store from context
 *
 * @example
 * ```tsx
 * function TodoList() {
 *   const store = useLatticeStore<TodoModel, TodoActions, TodoViews>();
 *   const todos = useViews(store, v => v.todos());
 *   // ...
 * }
 * ```
 */
export function useLatticeStore<Model, Actions, Views>(): AdapterResult<
  Model,
  Actions,
  Views
> {
  const store = useContext(LatticeContext);
  if (!store) {
    throw new Error('useLatticeStore must be used within a LatticeProvider');
  }
  return store as AdapterResult<Model, Actions, Views>;
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { useLattice as createReactAdapter }; // Alias for consistency with other adapters

// ============================================================================
// In-source tests
// ============================================================================

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { renderHook, act } = await import('@testing-library/react');
  const { createComponent, createModel, createSlice } = await import(
    '@lattice/core'
  );

  describe('useLattice', () => {
    it('should create a store with actions and views', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      expect(result.current.actions).toBeDefined();
      expect(result.current.views).toBeDefined();
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.actions.increment).toBe('function');
      expect(typeof result.current.views.count).toBe('function');
    });

    it('should update state when actions are called', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      expect(result.current.views.count().value).toBe(0);

      act(() => {
        result.current.actions.increment();
      });

      expect(result.current.views.count().value).toBe(1);

      act(() => {
        result.current.actions.increment();
      });

      expect(result.current.views.count().value).toBe(2);
    });

    it('should support subscriptions', () => {
      const counter = createComponent(() => {
        const model = createModel<{
          count: number;
          increment: () => void;
        }>(({ set, get }) => ({
          count: 0,
          increment: () => set({ count: get().count + 1 }),
        }));

        const actions = createSlice(model, (m) => ({
          increment: m.increment,
        }));

        const views = {
          count: createSlice(model, (m) => ({ value: m.count })),
        };

        return { model, actions, views };
      });

      const { result } = renderHook(() => useLattice(counter));

      const updates: Array<{ value: number }> = [];
      const unsubscribe = result.current.subscribe(
        (views) => views.count(),
        (count) => updates.push(count)
      );

      act(() => {
        result.current.actions.increment();
      });

      act(() => {
        result.current.actions.increment();
      });

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ value: 1 });
      expect(updates[1]).toEqual({ value: 2 });

      unsubscribe();
    });

    it('should handle complex models', () => {
      const todoApp = createComponent(() => {
        const model = createModel<{
          todos: Array<{ id: number; text: string; done: boolean }>;
          filter: 'all' | 'active' | 'completed';
          addTodo: (text: string) => void;
          toggleTodo: (id: number) => void;
          setFilter: (filter: 'all' | 'active' | 'completed') => void;
        }>(({ set, get }) => ({
          todos: [],
          filter: 'all',
          addTodo: (text) => {
            const { todos } = get();
            set({
              todos: [...todos, { id: Date.now(), text, done: false }],
            });
          },
          toggleTodo: (id) => {
            const { todos } = get();
            set({
              todos: todos.map((todo) =>
                todo.id === id ? { ...todo, done: !todo.done } : todo
              ),
            });
          },
          setFilter: (filter) => set({ filter }),
        }));

        const actions = createSlice(model, (m) => ({
          addTodo: m.addTodo,
          toggleTodo: m.toggleTodo,
          setFilter: m.setFilter,
        }));

        const todosView = createSlice(model, (m) => {
          const todos =
            m.filter === 'all'
              ? m.todos
              : m.filter === 'active'
                ? m.todos.filter((t) => !t.done)
                : m.todos.filter((t) => t.done);

          return {
            todos,
            count: todos.length,
            filter: m.filter,
          };
        });

        return {
          model,
          actions,
          views: { todos: todosView },
        };
      });

      const { result } = renderHook(() => useLattice(todoApp));

      // Initial state
      expect(result.current.views.todos().count).toBe(0);
      expect(result.current.views.todos().filter).toBe('all');

      // Add todo
      act(() => {
        result.current.actions.addTodo('Test todo');
      });

      expect(result.current.views.todos().count).toBe(1);
      const firstTodo = result.current.views.todos().todos[0];
      expect(firstTodo?.text).toBe('Test todo');

      // Toggle todo
      const todoId = firstTodo?.id;
      if (todoId) {
        act(() => {
          result.current.actions.toggleTodo(todoId);
        });

        expect(result.current.views.todos().todos[0]?.done).toBe(true);
      }

      // Filter
      act(() => {
        result.current.actions.setFilter('active');
      });

      expect(result.current.views.todos().count).toBe(0);
      expect(result.current.views.todos().filter).toBe('active');
    });
  });
}
