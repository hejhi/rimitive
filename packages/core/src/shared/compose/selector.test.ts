import { describe, it, expect, vi } from 'vitest';
import { createModel } from '../../model/create';
import { createSelectors } from '../../selectors/create';
import { createActions } from '../../actions/create';
import { createView } from '../../view/create';

/**
 * Tests for the new selector pattern implemented across all factory types.
 * This pattern allows filtering properties during composition by providing
 * a selector function directly to the factory.
 */
describe('Selector Pattern', () => {
  describe('Model Selector Pattern', () => {
    it('should allow filtering model properties with a selector', () => {
      // Create a base model with multiple properties
      const baseModel = createModel<{
        count: number;
        name: string;
        reset: () => void;
        increment: () => void;
      }>(({ set }) => ({
        count: 0,
        name: 'counter',
        reset: () => set({ count: 0 }),
        increment: () => set((state) => ({ count: state.count + 1 })),
      }));

      // Use the selector pattern to filter properties
      // Explicitly exclude the reset method
      const filteredModel = baseModel<{
        count: number;
        name: string;
        increment: () => void;
      }>(({ reset, ...rest }) => rest);

      // Setup mocks for testing
      const mockSet = vi.fn();
      const mockGet = vi.fn();
      
      // Create a slice with the filtered model
      const slice = filteredModel({ set: mockSet, get: mockGet });
      
      // Verify the selected properties are present
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('name');
      expect(slice).toHaveProperty('increment');
      
      // Verify the excluded property is not present
      expect(slice).not.toHaveProperty('reset');
    });
  });

  describe('Selectors Selector Pattern', () => {
    it('should allow filtering selector properties with a selector', () => {
      // Create a mock model
      const mockModel = {
        count: 42,
        name: 'test',
        isActive: true,
      };
      
      // Create base selectors
      const baseSelectors = createSelectors(
        { model: mockModel },
        ({ model }) => ({
          count: model().count,
          doubled: model().count * 2,
          name: model().name,
          isActive: model().isActive,
        })
      );
      
      // Use the selector pattern to filter selectors
      const filteredSelectors = baseSelectors<{
        count: number;
        doubled: number;
      }>(({ name, isActive, ...rest }) => rest);
      
      // Initialize the filtered selectors
      const mockGet = vi.fn();
      const slice = filteredSelectors({ get: mockGet });
      
      // Verify the selected properties are present
      expect(slice).toHaveProperty('count');
      expect(slice).toHaveProperty('doubled');
      
      // Verify the excluded properties are not present
      expect(slice).not.toHaveProperty('name');
      expect(slice).not.toHaveProperty('isActive');
      
      // Verify values are preserved
      expect(slice.count).toBe(42);
      expect(slice.doubled).toBe(84);
    });
  });

  describe('Actions Selector Pattern', () => {
    it('should allow filtering action methods with a selector', () => {
      // Create a mock model with methods
      const mockModel = {
        increment: vi.fn(),
        decrement: vi.fn(),
        reset: vi.fn(),
        update: vi.fn(),
      };
      
      // Create base actions
      const baseActions = createActions(
        { model: mockModel },
        ({ model }) => ({
          increment: model().increment,
          decrement: model().decrement,
          reset: model().reset,
          update: model().update,
        })
      );
      
      // Use the selector pattern to filter actions
      const filteredActions = baseActions<{
        increment: typeof mockModel.increment;
        reset: typeof mockModel.reset;
      }>(({ decrement, update, ...rest }) => rest);
      
      // Initialize the filtered actions
      const modelFn = vi.fn().mockImplementation(() => mockModel);
      const slice = filteredActions({ model: modelFn });
      
      // Verify the selected methods are present
      expect(slice).toHaveProperty('increment');
      expect(slice).toHaveProperty('reset');
      
      // Verify the excluded methods are not present
      expect(slice).not.toHaveProperty('decrement');
      expect(slice).not.toHaveProperty('update');
      
      // Verify the methods work as expected
      slice.increment();
      expect(mockModel.increment).toHaveBeenCalled();
      
      slice.reset();
      expect(mockModel.reset).toHaveBeenCalled();
    });
  });

  describe('View Selector Pattern', () => {
    it('should allow filtering view attributes with a selector', () => {
      // Create mock selectors and actions
      const mockSelectors = {
        count: 42,
        doubled: 84,
        isPositive: true,
      };
      
      const mockActions = {
        increment: vi.fn(),
        reset: vi.fn(),
      };
      
      // Create base view
      const baseView = createView(
        { selectors: mockSelectors, actions: mockActions },
        ({ selectors, actions }) => ({
          'data-count': selectors().count,
          'data-doubled': selectors().doubled,
          'aria-positive': selectors().isPositive,
          onClick: actions().increment,
          onReset: actions().reset,
        })
      );
      
      // Use the selector pattern to filter view attributes
      const filteredView = baseView<{
        'data-count': number;
        'aria-positive': boolean;
        onClick: typeof mockActions.increment;
      }>(({ 'data-doubled': _, onReset, ...rest }) => rest);
      
      // Initialize the filtered view
      const mockGet = vi.fn();
      const slice = filteredView({ get: mockGet });
      
      // Verify the selected attributes are present
      expect(slice).toHaveProperty('data-count');
      expect(slice).toHaveProperty('aria-positive');
      expect(slice).toHaveProperty('onClick');
      
      // Verify the excluded attributes are not present
      expect(slice).not.toHaveProperty('data-doubled');
      expect(slice).not.toHaveProperty('onReset');
      
      // Verify values are preserved
      expect(slice['data-count']).toBe(42);
      expect(slice['aria-positive']).toBe(true);
      expect(slice.onClick).toBe(mockActions.increment);
    });
  });

  describe('Compose with Selector Pattern', () => {
    it.todo('should demonstrate how the selector pattern can be used in composition');
    
    it.todo('should support basic selector-based filtering');
  });
});