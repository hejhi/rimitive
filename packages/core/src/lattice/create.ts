/**
 * Lattice creation and composition utilities.
 *
 * This module provides the core function for creating lattices from prepared components,
 * enabling the composition of models, actions, states, and views into a cohesive structure
 * that serves as both a declarative contract and the actual API for components.
 */

import { Lattice, LatticeLike } from './types';
import { markAsLattice } from './identify';
import { validatePreparedComponent, ensureAllPrepared } from './validate';

/**
 * Creates a new lattice with the given components.
 *
 * A lattice is a branded object that brings together prepared model, state, actions, and view components
 * into a cohesive structure that serves as both the declaration and implementation of a component's API.
 * All components must be prepared with the `prepare()` function before being passed to this function.
 *
 * @param components The prepared components to include in the lattice
 * @returns A branded lattice object
 * @throws {ComponentValidationError} If any component is not properly prepared
 */
export function createLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  components: {
    model: any; // Use `any` in tests to allow mocks
    state: any;
    actions: any;
    view: {
      [K in keyof TViews]: any;
    };
  }
): Lattice<TModel, TState, TActions, TViews> {

  // Validate required components
  if (!components.model) {
    throw new Error('Model is required');
  }

  if (!components.state) {
    throw new Error('State is required');
  }

  if (!components.actions) {
    throw new Error('Actions is required');
  }

  if (!components.view) {
    throw new Error('View is required');
  }

  // Validate all components are properly prepared
  ensureAllPrepared(components as LatticeLike);

  // Validate each component individually
  validatePreparedComponent(components.model, 'model', 'model');
  validatePreparedComponent(components.state, 'state', 'state');
  validatePreparedComponent(components.actions, 'actions', 'actions');

  // Validate each view in the view object
  Object.entries(components.view).forEach(([viewName, viewComponent]) => {
    validatePreparedComponent(
      viewComponent,
      'view',
      `view.${viewName}`
    );
  });

  // Create the lattice structure
  const lattice: LatticeLike<TModel, TState, TActions, TViews> = {
    model: components.model,
    state: components.state,
    actions: components.actions,
    view: { ...components.view },
  };

  // Brand the lattice with the lattice symbol
  const brandedLattice = markAsLattice(lattice);

  // Now freeze to make it immutable
  Object.freeze(brandedLattice);
  Object.freeze(brandedLattice.view);

  return brandedLattice;
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe('createLattice', () => {
    it('should throw for invalid inputs', () => {
      // Missing model
      expect(() =>
        createLattice({
          model: undefined as any,
          state: {},
          actions: {},
          view: {},
        })
      ).toThrow('Model is required');

      // Missing state
      expect(() =>
        createLattice({
          model: {},
          state: undefined as any,
          actions: {},
          view: {},
        })
      ).toThrow('State is required');

      // Missing actions
      expect(() =>
        createLattice({
          model: {},
          state: {},
          actions: undefined as any,
          view: {},
        })
      ).toThrow('Actions is required');

      // Missing view
      expect(() =>
        createLattice({
          model: {},
          state: {},
          actions: {},
          view: undefined as any,
        })
      ).toThrow('View is required');
    });
  });
}
