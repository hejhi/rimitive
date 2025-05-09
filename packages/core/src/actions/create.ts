import type { ActionsFactory, ActionInstance, Factory, Mutate } from './types';
import { markAsLatticeAction } from './identify';
import {
  createInstance,
  createSliceCreator as sharedCreateSliceCreator,
} from '../shared/create';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces an actions object with methods
 * @param options Object containing tools for the factory (primarily mutate)
 * @returns An actions object with methods
 */
export function createSliceCreator<T>(
  factory: (tools: ActionsFactory<T>) => T,
  options: Factory<T>
): T {
  // Create a basic mutate function
  const mutateFn: Mutate<T> = <M, K extends keyof M>(model: M, key: K) => {
    // Return a function that calls the corresponding method on the model
    return ((...args: any[]) => {
      // In a real implementation, this would call the model's method
      // For testing, we just return a function that forwards arguments
      return (model[key] as any)(...args);
    }) as any;
  };

  // Create actions tools
  const tools: ActionsFactory<T> = {
    mutate: mutateFn,
  };

  // Pass to shared createSliceCreator
  return sharedCreateSliceCreator(factory, tools);
}

/**
 * Marker function for action instances
 *
 * @param instance The instance to mark
 * @returns The marked instance
 */
export function actionsMarker<V>(instance: V): V {
  return markAsLatticeAction(instance);
}

/**
 * Creates a action instance function that serves as a blueprint for a set of actions.
 *
 * @param factory A function that produces an actions object with methods
 * @returns A action instance function that can be composed with other actions
 */
export function createActionInstance<T>(
  factory: (tools: ActionsFactory<T>) => T
): ActionInstance<T> {
  return createInstance<T, unknown>(
    factory,
    actionsMarker,
    'actions',
    createAction
  );
}

/**
 * Creates a factory function for a set of actions.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const counterActions = createAction(({ mutate }) => ({
 *   increment: mutate(counterModel, "increment"),
 *   decrement: mutate(counterModel, "decrement"),
 *   reset: mutate(counterModel, "reset")
 * }));
 *
 * // With composition
 * const extendedActions = counterActions.with(({ mutate }) => ({
 *   incrementTwice: mutate(enhancedModel, "incrementTwice")
 * }));
 *
 * // Finalize for use
 * const finalActions = extendedActions.create();
 * ```
 *
 * @param factory A function that produces an actions object with methods
 * @returns A action instance function that can be used in composition
 */
export function createAction<T>(
  factory: (tools: ActionsFactory<T>) => T
): ActionInstance<T> {
  return createActionInstance<T>(factory);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should create a basic action with methods', () => {
    // Create a mock model with the methods we need
    const mockModel = {
      increment: vi.fn(),
      reset: vi.fn(),
    };

    // Create a spy factory to check it receives the mutate parameter
    const factorySpy = vi.fn(({ mutate }) => ({
      increment: mutate(mockModel, 'increment'),
      reset: mutate(mockModel, 'reset'),
    }));

    const actions = createAction(factorySpy);

    // Action should be a function
    expect(typeof actions).toBe('function');

    // The slice creator should be a function
    const sliceCreator = actions();

    // Create a real mutate function for testing
    const realMutate = <M, K extends keyof M>(model: M, key: K) => {
      return ((...args: any[]) => {
        return (model[key] as any)(...args);
      }) as any;
    };

    // Call the slice creator with our real mutate function
    const slice = sliceCreator({ mutate: realMutate });

    // Check that the factory is called with a mutate function
    expect(factorySpy).toHaveBeenCalledWith({
      mutate: expect.any(Function),
    });

    // Verify the returned actions contain the expected methods
    expect(slice).toHaveProperty('increment');
    expect(slice).toHaveProperty('reset');
    expect(typeof slice.increment).toBe('function');
    expect(typeof slice.reset).toBe('function');
  });

  it('should support methods in action state', () => {
    // Create a mock model with the methods we need
    const mockModel = {
      increment: vi.fn(),
      reset: vi.fn(),
    };

    // Define a real mutate function
    const realMutate = <M, K extends keyof M>(model: M, key: K) => {
      return ((...args: any[]) => {
        return (model[key] as any)(...args);
      }) as any;
    };

    // Define a type for our action state
    type CounterActions = {
      increment: () => void;
      reset: () => void;
    };

    const actions = createAction<CounterActions>(({ mutate }) => ({
      increment: mutate(mockModel, 'increment'),
      reset: mutate(mockModel, 'reset'),
    }));

    const sliceCreator = actions();
    const slice = sliceCreator({ mutate: realMutate }) as CounterActions;

    // Call one of the actions
    slice.increment();

    // Verify the model method was called
    expect(mockModel.increment).toHaveBeenCalled();
  });

  it('should support composition with .with()', () => {
    // Create mock models with the methods we need
    const mockModelBase = {
      increment: vi.fn(),
    };

    const mockModelExtension = {
      reset: vi.fn(),
    };

    // Define a real mutate function
    const realMutate = <M, K extends keyof M>(model: M, key: K) => {
      return ((...args: any[]) => {
        return (model[key] as any)(...args);
      }) as any;
    };

    // Create base actions
    const baseActions = createAction(({ mutate }) => ({
      increment: mutate(mockModelBase, 'increment'),
    }));

    // Extend with additional actions
    const extendedActions = baseActions.with(({ mutate }) => ({
      reset: mutate(mockModelExtension, 'reset'),
    }));

    // Call the composed actions
    const actionsMethods = extendedActions()({ mutate: realMutate });

    // Verify the composed actions have all methods
    expect(actionsMethods).toHaveProperty('increment');
    expect(actionsMethods).toHaveProperty('reset');
    expect(typeof actionsMethods.increment).toBe('function');
    expect(typeof actionsMethods.reset).toBe('function');

    // Call the methods to verify they work
    actionsMethods.increment();
    actionsMethods.reset();

    // Verify the model methods were called
    expect(mockModelBase.increment).toHaveBeenCalled();
    expect(mockModelExtension.reset).toHaveBeenCalled();
  });
}
