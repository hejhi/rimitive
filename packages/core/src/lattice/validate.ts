/**
 * Validation utilities for Lattice components
 * 
 * This module provides functions to validate that components have been properly
 * prepared before use in a lattice. It ensures the contract enforcement at runtime.
 */

import { isPrepared } from '../shared/compose/prepare';
import {
  isModelInstance,
  isStateInstance,
  isActionInstance,
  isViewInstance
} from '../shared/identify';
import {
  PREPARED_BRAND,
  LatticeLike,
  PreparedModelInstance,
  PreparedStateInstance,
  PreparedActionsInstance,
  PreparedViewInstance
} from '../shared/types';

/**
 * Component validation error class
 * Provides specific error information for component validation failures
 */
export class ComponentValidationError extends Error {
  readonly componentType: string;
  readonly componentName: string;

  constructor(componentType: string, componentName: string, message: string) {
    super(`${componentType} validation error for "${componentName}": ${message}`);
    this.componentType = componentType;
    this.componentName = componentName;
    this.name = 'ComponentValidationError';
  }
}

/**
 * Validates that a component is properly prepared
 *
 * @param component The component to validate
 * @param componentType The type of component ('model', 'state', 'actions', 'view')
 * @param componentName The name of the component for error messages
 * @returns The component if valid (as the appropriate prepared type)
 * @throws {ComponentValidationError} If the component is not properly prepared
 */
export function validatePreparedComponent<T>(
  component: unknown,
  componentType: 'model' | 'state' | 'actions' | 'view',
  componentName: string
): PreparedModelInstance<T> | PreparedStateInstance<T> | PreparedActionsInstance<T> | PreparedViewInstance<T> {
  // First check if it's a valid component (not null or undefined)
  if (!component) {
    throw new ComponentValidationError(
      componentType,
      componentName,
      'component is null or undefined'
    );
  }

  // Check if prepared
  if (!isPrepared(component)) {
    throw new ComponentValidationError(
      componentType,
      componentName,
      'not prepared'
    );
  }

  // Check component type based on branded symbols
  const typeCheckMap = {
    'model': isModelInstance,
    'state': isStateInstance,
    'actions': isActionInstance,
    'view': isViewInstance
  };

  if (!typeCheckMap[componentType](component)) {
    throw new ComponentValidationError(
      componentType,
      componentName,
      `not a valid ${componentType}`
    );
  }

  // If all checks pass, return the component with the right type
  return component as any;
}

/**
 * Ensures all components in a lattice are properly prepared
 *
 * @param lattice The lattice to validate
 * @throws {ComponentValidationError} If any component is not properly prepared
 */
export function ensureAllPrepared(
  lattice: LatticeLike
): void {
  // Validate required components
  if (!lattice.model) {
    throw new ComponentValidationError('model', 'model', 'component is missing');
  }

  if (!lattice.state) {
    throw new ComponentValidationError('state', 'state', 'component is missing');
  }

  if (!lattice.actions) {
    throw new ComponentValidationError('actions', 'actions', 'component is missing');
  }

  if (!lattice.view) {
    throw new ComponentValidationError('view', 'view', 'component is missing');
  }

  // Validate each component is prepared
  validatePreparedComponent(lattice.model, 'model', 'model');
  validatePreparedComponent(lattice.state, 'state', 'state');
  validatePreparedComponent(lattice.actions, 'actions', 'actions');

  // Validate each view in the view object
  Object.entries(lattice.view).forEach(([viewName, viewComponent]) => {
    validatePreparedComponent(viewComponent, 'view', `view.${viewName}`);
  });
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('Component validation', async () => {
    // Import necessary functions and symbols
    const { brandWithSymbol } = await import('../shared/identify');
    const {
      MODEL_INSTANCE_BRAND,
      STATE_INSTANCE_BRAND,
      ACTIONS_INSTANCE_BRAND,
      VIEW_INSTANCE_BRAND
    } = await import('../shared/types');
    // Mock a prepared component with the PREPARED_BRAND
    const createMockPrepared = (instanceBrand: symbol) => {
      const mock = () => () => ({});
      const branded = brandWithSymbol(mock, instanceBrand);
      return brandWithSymbol(branded, PREPARED_BRAND);
    };

    // Mock an unprepared component (missing PREPARED_BRAND)
    const createMockUnprepared = (instanceBrand: symbol) => {
      const mock = () => () => ({});
      return brandWithSymbol(mock, instanceBrand);
    };

    describe('validatePreparedComponent', () => {
      it('should validate a prepared model', () => {
        const preparedModel = createMockPrepared(MODEL_INSTANCE_BRAND);
        
        // This should not throw
        const result = validatePreparedComponent(preparedModel, 'model', 'testModel');
        
        // Should return the same model
        expect(result).toBe(preparedModel);
      });

      it('should validate a prepared state', () => {
        const preparedState = createMockPrepared(STATE_INSTANCE_BRAND);
        
        // This should not throw
        const result = validatePreparedComponent(preparedState, 'state', 'testState');
        
        // Should return the same state
        expect(result).toBe(preparedState);
      });

      it('should validate a prepared actions', () => {
        const preparedActions = createMockPrepared(ACTIONS_INSTANCE_BRAND);
        
        // This should not throw
        const result = validatePreparedComponent(preparedActions, 'actions', 'testActions');
        
        // Should return the same actions
        expect(result).toBe(preparedActions);
      });

      it('should validate a prepared view', () => {
        const preparedView = createMockPrepared(VIEW_INSTANCE_BRAND);
        
        // This should not throw
        const result = validatePreparedComponent(preparedView, 'view', 'testView');
        
        // Should return the same view
        expect(result).toBe(preparedView);
      });

      it('should throw for unprepared model', () => {
        const unpreparedModel = createMockUnprepared(MODEL_INSTANCE_BRAND);
        
        // Should throw a ComponentValidationError
        expect(() => 
          validatePreparedComponent(unpreparedModel, 'model', 'testModel')
        ).toThrow(ComponentValidationError);
        
        // Error should contain useful information
        try {
          validatePreparedComponent(unpreparedModel, 'model', 'testModel');
        } catch (error) {
          expect(error instanceof ComponentValidationError).toBe(true);
          expect((error as ComponentValidationError).componentType).toBe('model');
          expect((error as ComponentValidationError).componentName).toBe('testModel');
          expect((error as Error).message).toContain('not prepared');
        }
      });

      it('should throw for incorrect component type', () => {
        // Create a state component but validate as a model
        const stateComponent = createMockPrepared(STATE_INSTANCE_BRAND);
        
        expect(() => 
          validatePreparedComponent(stateComponent, 'model', 'mistyped')
        ).toThrow(ComponentValidationError);
        
        try {
          validatePreparedComponent(stateComponent, 'model', 'mistyped');
        } catch (error) {
          expect((error as Error).message).toContain('model');
          expect((error as Error).message).toContain('mistyped');
          expect((error as Error).message).toContain('not a valid model');
        }
      });

      it('should throw for non-component values', () => {
        // Test with various non-component values
        ['string', 42, null, undefined, {}, []].forEach(value => {
          expect(() => 
            validatePreparedComponent(value, 'model', 'invalid')
          ).toThrow(ComponentValidationError);
        });
      });
    });

    describe('ensureAllPrepared', () => {
      it('should validate all components in a lattice', () => {
        const validLattice = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: {
            main: createMockPrepared(VIEW_INSTANCE_BRAND),
            secondary: createMockPrepared(VIEW_INSTANCE_BRAND)
          }
        };

        // Should not throw
        expect(() => ensureAllPrepared(validLattice)).not.toThrow();
      });

      it('should throw for unprepared model', () => {
        const latticeWithUnpreparedModel = {
          model: createMockUnprepared(MODEL_INSTANCE_BRAND),
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: {
            main: createMockPrepared(VIEW_INSTANCE_BRAND)
          }
        };

        expect(() =>
          ensureAllPrepared(latticeWithUnpreparedModel)
        ).toThrow(ComponentValidationError);

        try {
          ensureAllPrepared(latticeWithUnpreparedModel);
        } catch (error) {
          expect((error as ComponentValidationError).componentType).toBe('model');
          expect((error as Error).message).toContain('model');
          expect((error as Error).message).toContain('not prepared');
        }
      });

      it('should throw for unprepared state', () => {
        const latticeWithUnpreparedState = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          state: createMockUnprepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: {
            main: createMockPrepared(VIEW_INSTANCE_BRAND)
          }
        };

        expect(() =>
          ensureAllPrepared(latticeWithUnpreparedState)
        ).toThrow(ComponentValidationError);
      });

      it('should throw for unprepared actions', () => {
        const latticeWithUnpreparedActions = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockUnprepared(ACTIONS_INSTANCE_BRAND),
          view: {
            main: createMockPrepared(VIEW_INSTANCE_BRAND)
          }
        };

        expect(() =>
          ensureAllPrepared(latticeWithUnpreparedActions)
        ).toThrow(ComponentValidationError);
      });

      it('should throw for unprepared view', () => {
        const latticeWithUnpreparedView = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: {
            main: createMockUnprepared(VIEW_INSTANCE_BRAND)
          }
        };

        expect(() =>
          ensureAllPrepared(latticeWithUnpreparedView)
        ).toThrow(ComponentValidationError);

        try {
          ensureAllPrepared(latticeWithUnpreparedView);
        } catch (error) {
          expect((error as ComponentValidationError).componentType).toBe('view');
          expect((error as ComponentValidationError).componentName).toContain('main');
          expect((error as Error).message).toContain('view');
          expect((error as Error).message).toContain('not prepared');
        }
      });

      it('should validate all views in the view object', () => {
        const latticeWithMultipleViews = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: {
            first: createMockPrepared(VIEW_INSTANCE_BRAND),
            second: createMockPrepared(VIEW_INSTANCE_BRAND),
            third: createMockUnprepared(VIEW_INSTANCE_BRAND) // This one is unprepared
          }
        };

        expect(() =>
          ensureAllPrepared(latticeWithMultipleViews)
        ).toThrow(ComponentValidationError);

        try {
          ensureAllPrepared(latticeWithMultipleViews);
        } catch (error) {
          expect((error as ComponentValidationError).componentType).toBe('view');
          expect((error as ComponentValidationError).componentName).toContain('third');
        }
      });

      it('should throw for missing required components', () => {
        // Missing model
        const missingModel = {
          state: createMockPrepared(STATE_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: { main: createMockPrepared(VIEW_INSTANCE_BRAND) }
        } as LatticeLike;

        expect(() =>
          ensureAllPrepared(missingModel)
        ).toThrow(ComponentValidationError);

        // Missing state
        const missingState = {
          model: createMockPrepared(MODEL_INSTANCE_BRAND),
          actions: createMockPrepared(ACTIONS_INSTANCE_BRAND),
          view: { main: createMockPrepared(VIEW_INSTANCE_BRAND) }
        } as LatticeLike;

        expect(() =>
          ensureAllPrepared(missingState)
        ).toThrow(ComponentValidationError);
      });
    });
  });
}