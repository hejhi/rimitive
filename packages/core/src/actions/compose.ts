import type { ActionInstance, ComposedState, ActionState } from './types';
import { createAction, actionsMarker } from './create';
import { createComposedInstance } from '../shared/compose';
import { isFinalized } from '../shared/instance';
import { Instance } from '../shared';

/**
 * Creates a composed action instance that combines two input actions
 *
 * @param baseAction The base action to extend
 * @param extensionAction The action containing extensions
 * @returns A action instance representing the composed action
 */
export function createComposedActionInstance<
  TBase extends ActionInstance<any>,
  TExt extends ActionInstance<any>,
>(
  baseAction: TBase,
  extensionAction: TExt
): ActionInstance<ComposedState<ActionState<TBase>, ActionState<TExt>>> {
  // Cast the shared composed instance to the specific ActionInstance type
  return createComposedInstance(
    baseAction as unknown as Instance<any, unknown>,
    extensionAction as unknown as Instance<any, unknown>,
    createAction,
    actionsMarker
  ) as ActionInstance<ComposedState<ActionState<TBase>, ActionState<TExt>>>;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should support fluent composition with .with() method', () => {
    // Define explicit types for our test actions
    type CounterActions = {
      increment: () => void;
    };

    type ResetActions = {
      reset: () => void;
    };

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

    // Create a base action
    const baseAction = createAction<CounterActions>(({ mutate }) => ({
      increment: mutate(mockModelBase, 'increment'),
    }));

    // Assert that the action has a .with() method
    expect(baseAction.with).toBeDefined();

    // Create an extension to the action using the .with() method
    const extendedAction = baseAction.with<ResetActions>(({ mutate }) => ({
      reset: mutate!(mockModelExtension, 'reset'),
    }));

    // Verify the extended action contains properties from both actions
    const sliceCreator = extendedAction();

    // Create slice with our real mutate function
    const slice = sliceCreator({ mutate: realMutate });

    expect(slice).toHaveProperty('increment');
    expect(slice).toHaveProperty('reset');
    expect(typeof slice.increment).toBe('function');
    expect(typeof slice.reset).toBe('function');

    // Call the actions to verify they work
    slice.increment();
    slice.reset();

    // Verify the model methods were called
    expect(mockModelBase.increment).toHaveBeenCalled();
    expect(mockModelExtension.reset).toHaveBeenCalled();
  });

  it('should support chaining multiple .with() calls', () => {
    // Define types for our actions
    type CounterActions = {
      increment: () => void;
    };

    type ResetActions = {
      reset: () => void;
    };

    type DoubleActions = {
      incrementTwice: () => void;
    };

    type LogActions = {
      logAction: () => void;
    };

    // Create mock models with the methods we need
    const mockModel1 = {
      increment: vi.fn(),
    };

    const mockModel2 = {
      reset: vi.fn(),
    };

    const mockModel3 = {
      incrementTwice: vi.fn(),
    };

    const mockModel4 = {
      logAction: vi.fn(),
    };

    // Define a real mutate function
    const realMutate = <M, K extends keyof M>(model: M, key: K) => {
      return ((...args: any[]) => {
        return (model[key] as any)(...args);
      }) as any;
    };

    // Create a base action
    const baseAction = createAction<CounterActions>(({ mutate }) => ({
      increment: mutate(mockModel1, 'increment'),
    }));

    // Chain multiple .with() calls
    const completeAction = baseAction
      .with<ResetActions>(({ mutate }) => ({
        reset: mutate!(mockModel2, 'reset'),
      }))
      .with<DoubleActions>(({ mutate }) => ({
        incrementTwice: mutate!(mockModel3, 'incrementTwice'),
      }))
      .with<LogActions>(({ mutate }) => ({
        logAction: mutate!(mockModel4, 'logAction'),
      }));

    // Verify the action has all properties from all extensions
    expect(completeAction).toBeDefined();

    // Initialize the action
    const sliceCreator = completeAction();

    // Create slice with our real mutate function
    const slice = sliceCreator({ mutate: realMutate });

    // The key assertion: verify that properties from all extensions exist
    expect(slice).toHaveProperty('increment');
    expect(slice).toHaveProperty('reset');
    expect(slice).toHaveProperty('incrementTwice');
    expect(slice).toHaveProperty('logAction');
    expect(typeof slice.increment).toBe('function');
    expect(typeof slice.reset).toBe('function');
    expect(typeof slice.incrementTwice).toBe('function');
    expect(typeof slice.logAction).toBe('function');

    // Call the actions to verify they work
    slice.increment();
    slice.reset();
    slice.incrementTwice();
    slice.logAction();

    // Verify the model methods were called
    expect(mockModel1.increment).toHaveBeenCalled();
    expect(mockModel2.reset).toHaveBeenCalled();
    expect(mockModel3.incrementTwice).toHaveBeenCalled();
    expect(mockModel4.logAction).toHaveBeenCalled();
  });

  it('should finalize a action with .create() method', () => {
    // Define explicit types for our test actions
    type IncrementActions = {
      increment: () => void;
    };

    type ResetActions = {
      reset: () => void;
    };

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

    // Create a composed action with .with()
    const baseAction = createAction<IncrementActions>(({ mutate }) => ({
      increment: mutate(mockModelBase, 'increment'),
    }));

    const extendedAction = baseAction.with<ResetActions>(({ mutate }) => ({
      reset: mutate!(mockModelExtension, 'reset'),
    }));

    // Verify the action has a .create() method
    expect(extendedAction.create).toBeDefined();
    expect(typeof extendedAction.create).toBe('function');

    // Finalize the action
    const finalAction = extendedAction.create();

    // Verify the finalized action contains all expected properties
    expect(finalAction).toBeDefined();

    // Verify the finalized action is marked as finalized
    expect(isFinalized(finalAction)).toBe(true);

    // Verify the finalized action is a function (slice creator)
    expect(typeof finalAction).toBe('function');

    // Verify the finalized action preserves the original action's functionality
    const sliceCreator = finalAction();

    // Create slice with our real mutate function
    const slice = sliceCreator({ mutate: realMutate });

    // Verify all properties and functionality are preserved
    expect(slice).toHaveProperty('increment');
    expect(slice).toHaveProperty('reset');
    expect(typeof slice.increment).toBe('function');
    expect(typeof slice.reset).toBe('function');

    // Call the actions to verify they work
    slice.increment();
    slice.reset();

    // Verify the model methods were called
    expect(mockModelBase.increment).toHaveBeenCalled();
    expect(mockModelExtension.reset).toHaveBeenCalled();
  });
}
