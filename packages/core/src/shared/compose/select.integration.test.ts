/**
 * Basic integration tests for component composition using withComponent
 *
 * This file demonstrates the simplest possible test for component composition
 * to verify that the pattern from the spec works.
 */

import { describe, it, expect, vi } from 'vitest';
import { createComponent } from '../../lattice/create';
import { withComponent } from '../../lattice/compose';
import { createModel } from '../../model/create';
import { createActions } from '../../actions/create';
import {
  SELECTORS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  SelectorsFactory,
  ViewFactory,
} from '../types';
import { brandWithSymbol } from '../identify';
import { compose } from './fluent';

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

    // Create selectors factory mock
    const mockSelectors = vi.fn(() => ({ count: 0 }));
    const mockSelectorsFactory = brandWithSymbol(
      () => () => mockSelectors(),
      SELECTORS_FACTORY_BRAND
    ) as unknown as SelectorsFactory<CounterSelectors>;

    // Need a mock model instance (not factory) since we're testing without the actual store creation
    const mockModelInstance: CounterModel = {
      count: 0,
      increment: () => {},
    };

    // Create real actions using the actual createActions function with correct types
    const actionsFactory = createActions<CounterActions, CounterModel>(
      { model: mockModelInstance },
      ({ model }) => ({
        increment: model().increment,
      })
    );

    // Create view factory mock
    const mockView = vi.fn(() => ({ 'data-count': 0 }));
    const mockViewFactory = brandWithSymbol(
      () => () => mockView(),
      VIEW_FACTORY_BRAND
    ) as unknown as ViewFactory<CounterView>;

    // Create a base component with our model, actions, and mocks
    const BaseComponent = createComponent(() => ({
      model: baseModel,
      selectors: mockSelectorsFactory,
      actions: actionsFactory,
      view: {
        counter: mockViewFactory,
      },
    }));

    // Verify the base component was created
    expect(BaseComponent).toBeDefined();

    // Create an enhanced component using withComponent
    const EnhancedComponent = createComponent(
      withComponent(BaseComponent, ({ model, selectors, actions, view }) => {
        // For this test, we just verify we have access to the base component parts
        expect(model).toBe(baseModel);
        expect(selectors).toBe(mockSelectorsFactory);
        expect(actions).toBe(actionsFactory);
        expect(view.counter).toBe(mockViewFactory);

        // Create enhanced model that adds reset functionality
        const enhancedModel = createModel(
          compose(model).with<EnhancedModel>(({ set }) => ({
            reset: () => set({ count: 0 }),
          }))
        );

        // Create a mock enhanced model instance for actions
        const mockEnhancedModelInstance: CounterModel & EnhancedModel = {
          count: 0,
          increment: () => {},
          reset: () => {},
        };

        // Create enhanced actions that include reset using createActions with correct types
        const enhancedActions = createActions<
          EnhancedActions,
          CounterModel & EnhancedModel
        >({ model: mockEnhancedModelInstance }, ({ model }) => {
          // Create our enhanced actions including the original ones
          const baseActions = actions as unknown as CounterActions;
          return {
            increment: baseActions.increment,
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
