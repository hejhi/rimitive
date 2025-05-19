import { describe, it, expect } from 'vitest';
import { createModel } from '../model/create';
import { createSelectors } from '../selectors/create';
import { createActions } from '../actions/create';

// Import the from function we've now implemented
import { from } from './from';

describe('from() fluent API', () => {
  describe('from(model)', () => {
    it('should allow creating actions with type-safe model access', () => {
      // Define a model with specific methods
      type TestModel = {
        count: number;
        increment: () => void;
        reset: () => void;
      };

      // Create a real model
      const model = createModel<TestModel>(({ set }) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        reset: () => set({ count: 0 }),
      }));

      // Define the expected return type for better type checking
      type TestActions = {
        increment: () => void;
        reset: () => void;
      };

      // This should preserve the model's type through the chain
      const actions = from(model).createActions<TestActions>(({ model }) => ({
        // model() should have proper typing with all methods
        increment: model().increment,
        reset: model().reset,
      }));

      // Verify that actions were created with correct structure
      expect(actions).toBeDefined();
      expect(typeof actions).toBe('function');
    });

    it('should allow creating selectors with type-safe model access', () => {
      // Define a model with specific properties
      type TestModel = {
        count: number;
        name: string;
        isActive: boolean;
      };

      // Create a real model
      const model = createModel<TestModel>(() => ({
        count: 42,
        name: 'test',
        isActive: true,
      }));

      // Define the expected return type for better type checking
      type TestSelectors = {
        count: number;
        doubled: number;
        isActive: boolean;
      };

      // This should preserve the model's type through the chain
      const selectors = from(model).createSelectors<TestSelectors>(({ model }) => ({
        // model() should have proper typing with all properties
        count: model().count,
        doubled: model().count * 2,
        isActive: model().isActive,
      }));

      // Verify that selectors were created with correct structure
      expect(selectors).toBeDefined();
      expect(typeof selectors).toBe('function');
    });
  });

  describe('from(selectors)', () => {
    it('should allow creating views with type-safe selector and action access', () => {
      // Define model type with methods
      type TestModel = {
        count: number;
        increment: () => void;
        reset: () => void;
      };

      // Create a real model
      const model = createModel<TestModel>(({ set }) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
        reset: () => set({ count: 0 }),
      }));
      
      // Create real selectors
      const selectors = createSelectors<{ count: number; isPositive: boolean }, typeof model>(
        { model },
        ({ model }) => ({
          count: model().count,
          isPositive: model().count > 0
        })
      );
      
      // Create real actions
      const actions = createActions<{ increment: () => void; reset: () => void }, typeof model>(
        { model },
        ({ model }) => ({
          increment: model().increment,
          reset: model().reset
        })
      );

      // Define the expected return types for better type checking
      type ViewProps = {
        'data-count': number;
        'aria-positive': boolean;
        onClick: () => void;
        onReset: () => void;
      };

      // This should preserve selectors & actions types through the chain
      const view = from(selectors)
        .withActions(actions)
        .createView<ViewProps>(({ selectors, actions }) => ({
          // Explicitly type the selectors and actions for better inference
          'data-count': selectors().count,
          'aria-positive': selectors().isPositive,
          onClick: actions().increment,
          onReset: actions().reset,
        }));

      // Verify that view was created with correct structure
      expect(view).toBeDefined();
      expect(typeof view).toBe('function');
    });
  });

  // Add more test cases as needed for other overloads
});