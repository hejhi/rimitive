/**
 * @fileoverview Pinia adapter for Lattice
 *
 * This adapter provides integration with Pinia, Vue's official state
 * management library, implementing the Lattice adapter specification.
 *
 * Key features:
 * - Full Pinia integration with DevTools support
 * - Seamless Vue 3 reactivity
 * - Plugin ecosystem compatibility
 * - Hot module replacement support
 * - TypeScript support with proper type inference
 */

import { defineStore } from 'pinia';
import type {
  ComponentFactory,
  ComponentSpec,
  SliceFactory,
  AdapterResult,
  ViewTypes,
} from '@lattice/core';
import { isSliceFactory } from '@lattice/core';
import { createRuntime } from '@lattice/runtime';
import { reactive, effectScope, markRaw, watch } from 'vue';

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for Pinia adapter errors with helpful context
 */
export class PiniaAdapterError extends Error {
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
    this.name = 'PiniaAdapterError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PiniaAdapterError);
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
 * Subscription callback type
 */
type SubscribeCallback<T> = (value: T) => void;

/**
 * View subscription function type
 */
type ViewSubscribe<Views> = <Selected>(
  selector: (views: Views) => Selected,
  callback: SubscribeCallback<Selected>
) => () => void;

/**
 * Result of executing a component with the Pinia adapter
 */
export interface PiniaAdapterResult<Model, Actions, Views>
  extends AdapterResult<Model, Actions, Views> {
  /**
   * Subscribe to view changes
   * @example
   * const unsub = store.subscribe(
   *   views => ({ button: views.button(), count: views.counter() }),
   *   state => console.log('Views changed:', state)
   * );
   */
  subscribe: ViewSubscribe<ViewTypes<Model, Views>>;

  /**
   * Actions object with all action methods
   * @example
   * store.actions.increment();
   * store.actions.decrement();
   */
  actions: Actions;

  /**
   * View functions - each returns the view attributes
   * @example
   * const attrs = store.views.display(); // Returns view attributes
   * const buttonAttrs = store.views.button(); // Returns UI attributes
   */
  views: ViewTypes<Model, Views>;
}

// ============================================================================
// Supporting Types and Functions
// ============================================================================

/**
 * Processes views into functions that return view attributes.
 *
 * Views can be:
 * 1. SliceFactory - Static views that are executed to get current state
 * 2. Function returning SliceFactory - Computed views that return slices
 * 3. Function returning other values - Computed views with direct results
 */
function processViews<Model, Views>(
  spec: { views: Views },
  executeSliceFactory: <T>(factory: SliceFactory<Model, T>) => T
): ViewTypes<Model, Views> {
  // Handle empty views
  if (!spec.views || Object.keys(spec.views).length === 0) {
    return {} as ViewTypes<Model, Views>;
  }

  // Transform views into their runtime representations
  const processedEntries = Object.entries(spec.views).map(([key, view]) => {
    if (isSliceFactory(view)) {
      // Case 1: Static view (SliceFactory)
      // Transform to a function that executes the slice factory
      return [key, () => executeSliceFactory(view)];
    }

    if (typeof view === 'function') {
      // Case 2 & 3: Computed view (function)
      // Wrap to handle both slice factory results and direct values
      const wrappedView = (...args: unknown[]) => {
        const result = view(...args);

        // If the function returns a slice factory, execute it
        if (isSliceFactory(result)) return executeSliceFactory(result);

        // Otherwise return the direct value
        return result;
      };

      return [key, wrappedView];
    }

    // Invalid view type - this should never happen with proper TypeScript
    // but we'll throw a descriptive error for runtime safety
    throw new PiniaAdapterError('Invalid view type', {
      operation: 'processViews',
      details: {
        viewKey: String(key),
        viewType: typeof view,
        viewValue: String(view),
        message: 'Views must be either SliceFactory instances or functions',
      },
    });
  });

  return Object.fromEntries(processedEntries);
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Creates a subscription manager using Vue's reactivity system.
 *
 * This is more idiomatic to Vue/Pinia than manual equality checks:
 * - Leverages Vue's built-in reactivity and change detection
 * - Automatically handles deep watching of nested objects
 * - Integrates seamlessly with Pinia's state management
 * - Provides better performance through Vue's optimized watchers
 */
function createSubscriptionManager(scope: ReturnType<typeof effectScope>) {
  const activeWatchers = new Map<symbol, () => void>();

  return {
    add<Selected>(
      selector: () => Selected,
      callback: SubscribeCallback<Selected>
    ): () => void {
      const subscriptionId = Symbol('subscription');

      // Use Vue's watch within the effect scope
      const stopWatcher = scope.run(() =>
        watch(
          selector,
          (newValue) => {
            try {
              callback(newValue);
            } catch (error) {
              // Silently ignore callback errors to prevent breaking other subscriptions
              // Callbacks should handle their own errors
            }
          },
          {
            deep: true, // Use deep watching to catch nested changes
            flush: 'sync', // Sync with Pinia's reactivity
          }
        )
      );

      if (stopWatcher) {
        activeWatchers.set(subscriptionId, stopWatcher);
      }

      // Return unsubscribe function
      return () => {
        const stop = activeWatchers.get(subscriptionId);
        if (stop) {
          stop();
          activeWatchers.delete(subscriptionId);
        }
      };
    },

    clear(): void {
      activeWatchers.forEach((stop) => stop());
      activeWatchers.clear();
    },
  };
}

// ============================================================================
// Store Definition Helpers
// ============================================================================

/**
 * Creates the Pinia store setup function for a Lattice component
 */
function createStoreSetup<Model extends object, Actions, Views>(
  spec: ComponentSpec<Model, Actions, Views>
) {
  return () => {
    // Create scope for cleanup
    const scope = effectScope();

    // Initialize model first to get the initial state
    let initialModel: Model;
    const tempTools = {
      get: (): Model => initialModel!,
      set: (): void => {
        // No-op during initialization
      },
    };

    try {
      initialModel = spec.model(tempTools);
    } catch (error) {
      throw new PiniaAdapterError('Model factory execution failed', {
        operation: 'createStoreSetup.modelFactory',
        cause: error,
      });
    }

    // Create reactive state with the full model
    const state = reactive<Model>(initialModel) as Model;

    // Set up the proper model tools
    const modelTools = {
      get: (): Model => state,
      set: (updates: Partial<Model>) => {
        // Use Vue's reactivity to ensure updates are tracked
        (Object.keys(updates) as Array<keyof Model>).forEach((key) => {
          if (key in state) {
            state[key] = updates[key] as Model[keyof Model];
          }
        });
      },
    };

    // Re-execute the model factory with proper tools
    let model: Model;
    try {
      model = spec.model(modelTools);
      Object.assign(state, model);
    } catch (error) {
      throw new PiniaAdapterError('Model factory re-execution failed', {
        operation: 'createStoreSetup.modelFactory',
        cause: error,
      });
    }

    // Create slice executor helper
    const executeSliceFactory = <T>(factory: SliceFactory<Model, T>): T => {
      try {
        return factory(state);
      } catch (error) {
        throw new PiniaAdapterError('Slice factory execution failed', {
          operation: 'executeSliceFactory',
          details: { sliceFactory: factory.name || 'anonymous' },
          cause: error,
        });
      }
    };

    // Process actions slice
    let actions: Actions;
    try {
      actions = executeSliceFactory<Actions>(spec.actions);
    } catch (error) {
      throw new PiniaAdapterError('Actions slice creation failed', {
        operation: 'createStoreSetup.actions',
        cause: error,
      });
    }

    // Process views
    let views: ViewTypes<Model, Views>;
    try {
      views = processViews<Model, Views>(spec, executeSliceFactory);
    } catch (error) {
      throw new PiniaAdapterError('Views processing failed', {
        operation: 'createStoreSetup.views',
        cause: error,
      });
    }

    // Create subscription manager with reactive state
    const subscriptionManager = createSubscriptionManager(scope);

    // Create the adapter API
    const adapterAPI: PiniaAdapterResult<Model, Actions, Views> = {
      // Clean actions API - just the actions object
      // Mark as raw to prevent Vue reactivity
      actions: markRaw(actions as object) as Actions,

      // Views API - functions that return view attributes
      // Mark as raw to prevent Vue reactivity from breaking functions
      views: markRaw(views as object) as ViewTypes<Model, Views>,

      getState: () => state,

      // View-based subscription API with granular updates
      subscribe: <Selected>(
        selector: (views: ViewTypes<Model, Views>) => Selected,
        callback: SubscribeCallback<Selected>
      ) => {
        const selectorFn = () => selector(views);
        return subscriptionManager.add(selectorFn, callback);
      },

      destroy: () => {
        subscriptionManager.clear();
        scope.stop();
      },
    };

    // Return everything that Pinia needs
    return {
      // Spread the reactive state
      ...state,

      // Add our adapter methods (non-reactive)
      actions: adapterAPI.actions,
      views: adapterAPI.views,
      subscribe: adapterAPI.subscribe,
      destroy: adapterAPI.destroy,
      getState: adapterAPI.getState,
    };
  };
}

// ============================================================================
// Main Adapter Implementation
// ============================================================================

// Note: Pinia internally caches stores by ID, so we don't need our own cache.
// Multiple calls to defineStore with the same ID return the same store definition.

/**
 * Creates a Pinia store from a Lattice component with a unified API
 * that maintains proper abstraction boundaries.
 *
 * The adapter returns a Pinia store that provides:
 * - `actions`: Direct access to all action methods
 * - `views`: Functions that return view attributes
 * - `subscribe`: View-based subscriptions for reactive updates
 *
 * @param componentFactory - The Lattice component factory
 * @param storeId - Unique identifier for the Pinia store
 * @returns A Pinia store with Lattice adapter interface
 *
 * @remarks
 * - Model state is kept private - only accessible through views
 * - Actions are regular functions, not hooks
 * - Views are functions that return current attributes
 * - Subscriptions work at the view level, not model level
 * - Pinia handles store caching internally by store ID
 *
 * @example
 * ```ts
 * import { createPiniaAdapter } from '@lattice/adapter-pinia';
 * import { todoComponent } from './todo-component';
 *
 * // Create a Pinia store from Lattice component
 * const store = createPiniaAdapter(todoComponent, 'todos');
 * const todos = computed(() => store.views.todos());
 * store.actions.addTodo('New todo');
 * ```
 */
export function createPiniaAdapter<Model extends object, Actions, Views>(
  componentFactory: ComponentFactory<Model, Actions, Views>,
  storeId = 'lattice-store'
): PiniaAdapterResult<Model, Actions, Views> {
  // Generate unique store ID if not provided
  const uniqueStoreId = storeId || `lattice-store-${Date.now()}`;

  // Get the component spec
  const spec = componentFactory();

  // Define the Pinia store - Pinia handles caching internally
  const useStore = defineStore(uniqueStoreId, createStoreSetup(spec));

  // Create the adapter result
  const adapterResult = createRuntime(() => {
    // Note: We use 'any' here due to Pinia's complex internal store typing
    // that doesn't expose our custom properties in the type system
    const store = useStore() as any;

    // Create the result with proper typing
    const result: PiniaAdapterResult<Model, Actions, Views> = {
      actions: store.actions,
      views: store.views,
      subscribe: store.subscribe,
      destroy: store.destroy,
      getState: store.getState,
    };

    // Add Pinia-specific properties for test compatibility
    Object.assign(result, {
      $id: store.$id,
      $state: store.$state,
      $subscribe: store.$subscribe,
      $dispose: store.$dispose,
    });

    // Note: Subscriptions are handled via Vue's watch() in the subscription manager,
    // so we don't need to manually trigger updates on Pinia state changes

    return result;
  });

  return adapterResult;
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { createPiniaAdapter as createAdapter }; // Alias for consistency
export { createMinimalPiniaAdapter } from './minimal';

