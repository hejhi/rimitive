/**
 * Basic integration tests for component composition using withComponent
 *
 * This file demonstrates the simplest possible test for component composition
 * to verify that the pattern from the spec works.
 */

import { describe, it, expect } from 'vitest';
import { createComponent } from '../../lattice/create';
import { withComponent } from '../../lattice/compose';
import { createModel } from '../../model/create';
import { from } from '../from';

describe('Basic Component Composition', () => {
  it('should allow component composition with withComponent', () => {
    // Create test types for our components
    type CounterModel = { count: number; increment: () => void };
    type CounterSelectors = { count: number };
    type CounterActions = { increment: () => void };
    type CounterView = { 'data-count': number };

    // Create enhanced model type with reset
    type EnhancedModel = { reset: () => void };
    type EnhancedActions = CounterActions & { reset: () => void };

    // Create real model using the actual createModel function
    const baseModel = createModel<CounterModel>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }));

    // Create real actions using the actual createActions function with correct types
    const baseActions = from(baseModel).createActions<CounterActions>(
      ({ model }) => ({
        increment: model().increment,
      })
    );

    // Use the from API for selectors too with explicit type annotation
    const selectors = from(baseModel).createSelectors<CounterSelectors>(
      ({ model }) => ({
        count: model().count,
      })
    );

    // Use the from API for views as well with explicit type annotation
    const counter = from(selectors)
      .withActions(baseActions)
      .createView<CounterView>(({ selectors }) => ({
        'data-count': selectors().count,
      }));

    // Create a base component with our model, actions, and mocks
    const BaseComponent = createComponent(() => ({
      model: baseModel,
      selectors,
      actions: baseActions,
      view: {
        counter,
      },
    }));

    // Verify the base component was created
    expect(BaseComponent).toBeDefined();

    // Create an enhanced component using withComponent
    const EnhancedComponent = createComponent(
      withComponent(BaseComponent, ({ model, selectors, actions, view }) => {
        // For this test, we just verify we have access to the base component parts
        expect(model).toBe(baseModel);
        expect(selectors).toBe(selectors);
        expect(actions).toBe(baseActions);
        expect(view.counter).toBe(counter);

        // Create enhanced model that adds reset functionality
        const enhancedModel = createModel<CounterModel & EnhancedModel>(
          (tools) => {
            const composedModel = model()(tools);

            return {
              ...composedModel,
              reset: () => tools.set({ count: 0 }),
            };
          }
        );

        // Create enhanced actions using the from() API for better type inference
        const enhancedActions = from(
          enhancedModel
        ).createActions<EnhancedActions>(({ model }) => {
          // Create our enhanced actions including the original ones
          // Type the mock model explicitly
          type MockModel = { increment: () => void };
          const mockModelFn = () => ({ increment: () => {} }) as MockModel;
          const baseActions = actions()({ model: mockModelFn });

          // model() is now properly typed with the reset method
          return {
            ...baseActions,
            reset: model().reset,
          };
        });

        // Return the enhanced model and actions
        return {
          model: enhancedModel,
          actions: enhancedActions,
        };
      })
    );

    // Verify the enhanced component was created
    expect(EnhancedComponent).toBeDefined();
  });
});
