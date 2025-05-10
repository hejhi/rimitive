import type { ActionInstance } from './types';
import { markAsLatticeAction } from './identify';
import {
  createInstance,
  createSliceCreator as sharedCreateSliceCreator,
} from '../shared/create';
import { ActionsFactory, RuntimeTools } from '../shared';

/**
 * Creates a slice creator function based on the provided factory
 *
 * @param factory A function that produces an actions object with methods
 * @param _ Unused options parameter, maintained for API consistency
 * @returns An actions object with methods
 */
export function createSliceCreator<T>(
  factory: (tools: ActionsFactory<T>) => T,
  options: RuntimeTools<T>
): T {
  // Create actions tools with proper branding
  const tools = {
    mutate: options.mutate!,
    __actionsFactoryBrand: Symbol('actions'),
  };

  // Pass to shared createSliceCreator
  return sharedCreateSliceCreator(
    factory as (tools: RuntimeTools<T>) => T,
    tools
  );
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
  // Convert the factory to accept the shared Factory type
  const factoryAdapter = (tools: RuntimeTools<T>): T => {
    // Cast the tools to ActionsFactory to ensure type safety
    const actionTools = tools as unknown as ActionsFactory<T>;
    return factory(actionTools);
  };

  return createInstance<T, unknown>(
    factoryAdapter,
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
    const factorySpy = vi.fn((tools: { mutate: any }) => ({
      increment: tools.mutate(mockModel, 'increment'),
      reset: tools.mutate(mockModel, 'reset'),
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
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mutate: expect.any(Function),
      })
    );

    // Verify the returned actions contain the expected methods
    expect(slice).toHaveProperty('increment');
    expect(slice).toHaveProperty('reset');
    // Type assertion to avoid the 'unknown' type warning
    const typedSlice = slice as { increment: Function; reset: Function };
    expect(typeof typedSlice.increment).toBe('function');
    expect(typeof typedSlice.reset).toBe('function');
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
      reset: mutate!(mockModelExtension, 'reset'),
    }));

    // Call the composed actions
    const actionsMethods = extendedActions()({ mutate: realMutate });

    // Verify the composed actions have all methods
    expect(actionsMethods).toHaveProperty('increment');
    expect(actionsMethods).toHaveProperty('reset');

    // Type assertion to avoid the 'unknown' type warning
    const typedMethods = actionsMethods as {
      increment: Function;
      reset: Function;
    };
    expect(typeof typedMethods.increment).toBe('function');
    expect(typeof typedMethods.reset).toBe('function');

    // Call the methods to verify they work
    typedMethods.increment();
    typedMethods.reset();

    // Verify the model methods were called
    expect(mockModelBase.increment).toHaveBeenCalled();
    expect(mockModelExtension.reset).toHaveBeenCalled();
  });
}
