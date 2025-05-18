/**
 * Test to validate model composition as specified in docs/spec.md lines 114-121
 */

import { describe, it, expect } from 'vitest';
import { createModel } from './create';
import { compose } from '../shared/compose';

type CounterState = {
  count: number;
  increment: () => void;
  decrement: () => void;
};

type EnhancedCounterState = {
  incrementTwice: () => void;
};

describe('Model Composition', () => {
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
    // ModelInstance is a function that returns a function
    const baseModelState = counterModel()({ get: getState, set: setState });

    // 2. Verify enhancedModel by comparing its type and behavior
    // enhancedModel is also a ModelInstance, so we call it the same way
    const enhancedModelState = enhancedModel()({
      get: getState,
      set: setState,
    });

    // The key issue is here: enhancedModelState should be an object with incrementTwice method
    console.log('Base model state type:', typeof baseModelState);
    console.log('Enhanced model state type:', typeof enhancedModelState);

    // ASSERT

    // The essential test: can we access incrementTwice from enhancedModelState?
    // According to spec (115-120), this should work
    expect(typeof enhancedModelState).toBe('object');
    expect(enhancedModelState).toHaveProperty('incrementTwice');

    // The final verification: does incrementTwice actually work?
    enhancedModelState.incrementTwice();
    expect(state.count).toBe(2);
  });

  // Demonstrate what happens with direct composition (without createModel wrapping)
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
    // In this test, directComposed is the raw composed function, not a ModelInstance
    const modelState = directComposed({ get: getState, set: setState });

    // This should pass - the direct composition works as expected
    expect(typeof modelState).toBe('object');
    expect(modelState).toHaveProperty('incrementTwice');

    (modelState as EnhancedCounterState).incrementTwice();
    expect(state.count).toBe(2);
  });
});
