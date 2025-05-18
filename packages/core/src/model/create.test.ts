/**
 * Test to validate model composition as specified in docs/spec.md lines 114-121
 * and to verify the updated terminology and branding works correctly
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from './create';
import { compose } from '../shared/compose';
import { isModelFactory } from '../shared/identify';
import { MODEL_FACTORY_BRAND, MODEL_TOOLS_BRAND } from '../shared/types';

type CounterState = {
  count: number;
  increment: () => void;
  decrement: () => void;
};

type EnhancedCounterState = {
  incrementTwice: () => void;
};

type DoubledCounterState = {
  doubled: () => number;
};

describe('Model Composition', () => {
  // Test the updated terminology and brand symbols
  it('should properly brand model factories with MODEL_FACTORY_BRAND', () => {
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // Verify the model is branded as a factory
    expect(isModelFactory(counterModel)).toBe(true);
    
    // Verify the model function has the correct symbol
    expect(Reflect.has(counterModel, MODEL_FACTORY_BRAND)).toBe(true);
    expect(Reflect.get(counterModel, MODEL_FACTORY_BRAND)).toBe(true);
    
    // Tools provided to the slice factory should be branded with MODEL_TOOLS_BRAND
    const factorySpy = vi.fn(() => ({ count: 0 }));
    const spyModel = createModel(factorySpy);
    
    // Invoke the model factory to get the tools
    const getState = vi.fn(() => ({ count: 0 }));
    const setState = vi.fn();
    spyModel()({ get: getState, set: setState });
    
    // Verify the spy was called
    expect(factorySpy).toHaveBeenCalled();
    
    // Check that the factory was called with a tools object
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        // This is a better approach than accessing mock.calls directly
        [MODEL_TOOLS_BRAND]: true
      })
    );
  });

  it('should support composition with method access exactly as shown in spec lines 114-121', () => {
    // SETUP - this comes directly from spec lines 107-111
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // ACT - this comes directly from spec lines 114-121
    const enhancedModel = createModel(
      compose(counterModel).with<EnhancedCounterState>(({ get }) => ({
        incrementTwice: () => {
          get().increment();
          get().increment();
        },
      }))
    );

    // The enhancedModel should be a properly branded model factory
    expect(isModelFactory(enhancedModel)).toBe(true);

    // Create a simple shared state to track changes
    let state: CounterState & EnhancedCounterState = {
      count: 0,
      increment: function () {
        state.count += 1;
      },
      decrement: function () {
        state.count -= 1;
      },
      incrementTwice: () => {
        state.count += 1;
        state.count += 1;
      },
    };

    // Simple get/set implementation for testing
    const getState = () => state;
    const setState = (
      updater:
        | ((
            state: CounterState & EnhancedCounterState
          ) => Partial<CounterState>)
        | Partial<CounterState>
    ) => {
      if (typeof updater === 'function') {
        state = { ...state, ...updater(state) };
      } else {
        state = { ...state, ...updater };
      }
    };

    // COMPARISON - Compare the behavior of direct and composed models

    // Call the model with the correct invocation pattern: model()({ tools })
    // ModelFactory is a function that returns a function
    counterModel()({ get: getState, set: setState });

    // 2. Verify enhancedModel by comparing its type and behavior
    // enhancedModel is also a ModelFactory, so we call it the same way
    const enhancedModelState = enhancedModel()({
      get: getState,
      set: setState,
    });

    // ASSERT

    // The essential test: can we access incrementTwice from enhancedModelState?
    // According to spec (115-120), this should work
    expect(typeof enhancedModelState).toBe('object');
    expect(enhancedModelState).toHaveProperty('incrementTwice');

    // The final verification: does incrementTwice actually work?
    enhancedModelState.incrementTwice();
    expect(state.count).toBe(2);
  });

  // Test direct composition (without createModel wrapping)
  it('should work when using direct composition without createModel wrapping', () => {
    // Same base model
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // Direct composition without createModel wrapping
    const directComposed = compose(counterModel).with<EnhancedCounterState>(
      ({ get }) => ({
        incrementTwice: () => {
          get().increment();
          get().increment();
        },
      })
    );

    // directComposed should be a plain function, not a branded factory
    expect(isModelFactory(directComposed)).toBe(false);

    // Same state tracking
    let state: CounterState & EnhancedCounterState = {
      count: 0,
      increment: function () {
        state.count += 1;
      },
      decrement: function () {
        state.count -= 1;
      },
      incrementTwice: () => {
        state.count += 1;
        state.count += 1;
      },
    };

    const getState = () => state;
    const setState = (
      updater:
        | ((
            state: CounterState & EnhancedCounterState
          ) => Partial<CounterState>)
        | Partial<CounterState>
    ) => {
      if (typeof updater === 'function') {
        state = { ...state, ...updater(state) };
      } else {
        state = { ...state, ...updater };
      }
    };

    // Direct composition without createModel wrapping
    // In this test, directComposed is the raw composed function, not a ModelFactory
    const modelState = directComposed({ get: getState, set: setState });

    // This should pass - the direct composition works as expected
    expect(typeof modelState).toBe('object');
    expect(modelState).toHaveProperty('incrementTwice');

    (modelState as EnhancedCounterState).incrementTwice();
    expect(state.count).toBe(2);
  });

  // Test nested composition patterns with consistent terminology
  it('should support deeper nested composition with consistent factory branding', () => {
    // Create base counter model
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // First level of composition - add doubled method
    const doubledModel = createModel(
      compose(counterModel).with<DoubledCounterState>(({ get }) => ({
        doubled: () => get().count * 2,
      }))
    );

    // Second level of composition - add incrementTwice method
    const enhancedModel = createModel(
      compose(doubledModel).with<EnhancedCounterState>(({ get }) => ({
        incrementTwice: () => {
          get().increment();
          get().increment();
        },
      }))
    );
    
    // All models should be branded factories
    expect(isModelFactory(counterModel)).toBe(true);
    expect(isModelFactory(doubledModel)).toBe(true);
    expect(isModelFactory(enhancedModel)).toBe(true);
    
    // Setup state for testing
    let state: CounterState & DoubledCounterState & EnhancedCounterState = {
      count: 0,
      increment: function () {
        state.count += 1;
      },
      decrement: function () {
        state.count -= 1;
      },
      doubled: function () {
        return state.count * 2;
      },
      incrementTwice: function () {
        state.increment();
        state.increment();
      }
    };
    
    const getState = () => state;
    const setState = vi.fn((updater: any) => {
      if (typeof updater === 'function') {
        state = { ...state, ...updater(state) };
      } else {
        state = { ...state, ...updater };
      }
    });
    
    // Create the final composed state
    const finalState = enhancedModel()({ get: getState, set: setState });
    
    // Verify all methods are available
    expect(finalState).toHaveProperty('count');
    expect(finalState).toHaveProperty('increment');
    expect(finalState).toHaveProperty('decrement');
    expect(finalState).toHaveProperty('doubled');
    expect(finalState).toHaveProperty('incrementTwice');
    
    // Test functionality
    expect(finalState.count).toBe(0);
    finalState.increment();
    expect(state.count).toBe(1);
    expect(finalState.doubled()).toBe(2);
    finalState.incrementTwice();
    expect(state.count).toBe(3);
  });
  
  // Test the createModel wrapper on a plain composition function
  it('should properly brand composition output when wrapped with createModel', () => {
    // Create base counter model
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));
    
    // Create composition without wrapping it (should be unbranded)
    const rawComposition = compose(counterModel).with<DoubledCounterState>(({ get }) => ({
      doubled: () => get().count * 2,
    }));
    
    // Verify raw composition is not branded
    expect(isModelFactory(rawComposition)).toBe(false);
    
    // Now wrap the composition with createModel (should become branded)
    const wrappedModel = createModel(rawComposition);
    
    // Verify wrapped composition is branded
    expect(isModelFactory(wrappedModel)).toBe(true);
    expect(Reflect.has(wrappedModel, MODEL_FACTORY_BRAND)).toBe(true);
  });
});