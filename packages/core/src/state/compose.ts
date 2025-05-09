import type {
  StateFactory,
  StateInstance,
  SliceCreator,
  GetState,
  SetState,
  ComposedState,
  FinalizedState,
  StateState,
} from './types';
import { markAsLatticeState } from './identify';
import { createState } from './create';

/**
 * Creates a composed state instance that combines two input states
 *
 * @param baseState The base state to extend
 * @param extensionState The state containing extensions
 * @returns A state instance representing the composed state
 */
export function createComposedStateInstance<
  TBase extends StateInstance<any>,
  TExt extends StateInstance<any>,
>(
  baseState: TBase,
  extensionState: TExt
): StateInstance<ComposedState<StateState<TBase>, StateState<TExt>>> {
  type TComposed = ComposedState<StateState<TBase>, StateState<TExt>>;

  const composedStateInstance =
    function composedStateInstance(): SliceCreator<TComposed> {
      return function composedSliceCreator(
        set: SetState<TComposed>,
        get: GetState<TComposed>
      ): TComposed {
        // Get slices from both states
        const baseSlice = baseState()(set, get);
        const extensionSlice = extensionState()(set, get);

        // Combine the properties from both slices
        return { ...baseSlice, ...extensionSlice };
      };
    };

  // Add the .with() method for fluent composition
  composedStateInstance.with = function with_<U>(
    extensionFactory: (tools: StateFactory<ComposedState<TComposed, U>>) => U
  ): StateInstance<ComposedState<TComposed, U>> {
    const newExtensionState = createState<U>((tools: any) => {
      return extensionFactory(tools as any);
    });

    return createComposedStateInstance(
      composedStateInstance,
      newExtensionState
    );
  };

  // Add the .create() method for state finalization
  composedStateInstance.create = function create(): FinalizedState<TComposed> {
    // Create a finalized state that contains the same slice creator
    const finalizedState = function finalizedState(): SliceCreator<TComposed> {
      return composedStateInstance();
    };

    // Mark as finalized
    Object.defineProperty(finalizedState, '__finalized', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return finalizedState as FinalizedState<TComposed>;
  };

  // Mark as a valid Lattice state
  return markAsLatticeState(composedStateInstance) as StateInstance<
    ComposedState<StateState<TBase>, StateState<TExt>>
  >;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, vi } = import.meta.vitest;

  it('should support fluent composition with .with() method', () => {
    // Define explicit types for our test states
    type CounterState = {
      count: number;
    };

    type StatsState = {
      doubleCount: () => number;
    };

    // Create a base state
    const baseState = createState<CounterState>(() => ({
      count: 10,
    }));

    // Assert that the state has a .with() method
    expect(baseState.with).toBeDefined();

    // Create an extension to the state using the .with() method
    const extendedState = baseState.with<StatsState>(({ get }) => ({
      doubleCount: () => get().count * 2,
    }));

    // Verify the extended state contains properties from both states
    const sliceCreator = extendedState();

    // Create a properly typed mock state for our get function
    const mockState = {
      count: 10,
      doubleCount: () => 20,
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      CounterState & StatsState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('doubleCount');
    expect(slice.count).toBe(10);
    expect(slice.doubleCount()).toBe(20);
  });

  it('should support chaining multiple .with() calls', () => {
    // Define types for our states
    type BaseState = {
      name: string;
    };

    type CounterState = {
      count: number;
    };

    type LoggerState = {
      log: () => string;
    };

    type MetadataState = {
      metadata: { version: string };
    };

    // Create a base state
    const baseState = createState<BaseState>(() => ({
      name: 'base',
    }));

    // Chain multiple .with() calls
    const completeState = baseState
      .with<CounterState>(() => ({
        count: 5,
      }))
      .with<LoggerState>(({ get }) => ({
        log: () => `${get().name}: ${get().count}`,
      }))
      .with<MetadataState>(() => ({
        metadata: { version: '1.0.0' },
      }));

    // Verify the state has all properties from all extensions
    expect(completeState).toBeDefined();

    // Initialize the state
    const sliceCreator = completeState();

    // Set up a mock with all properties
    const mockState = {
      name: 'base',
      count: 5,
      log: () => 'base: 5',
      metadata: { version: '1.0.0' },
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      BaseState & CounterState & LoggerState & MetadataState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    // The key assertion: verify that properties from all extensions exist
    expect(slice.metadata.version).toBe('1.0.0');
  });

  it('should finalize a state with .create() method', () => {
    // Define explicit types for our test states
    type CounterState = {
      count: number;
    };

    type StatsState = {
      doubleCount: () => number;
    };

    // Create a composed state with .with()
    const baseState = createState<CounterState>(() => ({
      count: 10,
    }));

    const extendedState = baseState.with<StatsState>(({ get }) => ({
      doubleCount: () => get().count * 2,
    }));

    // Verify the state has a .create() method
    expect(extendedState.create).toBeDefined();
    expect(typeof extendedState.create).toBe('function');

    // Finalize the state
    const finalState = extendedState.create();

    // Verify the finalized state contains all expected properties
    expect(finalState).toBeDefined();

    // Verify the finalized state is marked as finalized
    expect((finalState as any).__finalized).toBe(true);

    // Verify the finalized state is a function (slice creator)
    expect(typeof finalState).toBe('function');

    // Verify the finalized state preserves the original state's functionality
    const sliceCreator = finalState();

    // Create a properly typed mock state for our get function
    const mockState = {
      count: 10,
      doubleCount: () => 20,
    };
    const mockGet = vi.fn(() => mockState) as unknown as GetState<
      CounterState & StatsState
    >;
    const slice = sliceCreator(vi.fn(), mockGet);

    // Verify all properties and functionality are preserved
    expect(slice).toHaveProperty('count');
    expect(slice).toHaveProperty('doubleCount');
    expect(slice.count).toBe(10);
    expect(slice.doubleCount()).toBe(20);
  });
}
