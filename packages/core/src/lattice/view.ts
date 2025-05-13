/**
 * View composition utilities for Lattice.
 * 
 * This module provides functions for working with views in lattices,
 * enabling easy extraction and composition of views from different sources.
 */

import { Lattice, LatticeLike } from './types';
import { isLattice } from './identify';

/**
 * Extracts a specific view from a lattice by name.
 * 
 * @param lattice The lattice to extract a view from
 * @param viewName The name of the view to extract
 * @returns The specified view
 * @throws If the requested view doesn't exist in the lattice
 */
export function use<
  TModel,
  TState,
  TActions,
  TViews extends Record<string, unknown>,
  K extends keyof TViews
>(
  lattice: Lattice<TModel, TState, TActions, TViews>,
  viewName: K
): TViews[K] {
  // Get the views from the private property
  const views = (lattice as LatticeLike<TModel, TState, TActions, TViews>).__view;
  if (!views[viewName]) {
    throw new Error(`View "${String(viewName)}" does not exist in lattice`);
  }
  return views[viewName];
}

/**
 * Extracts all views from a lattice.
 * 
 * @param lattice The lattice to extract views from
 * @returns An object containing all views from the lattice
 */
export function spreadViews<
  TModel,
  TState,
  TActions,
  TViews extends Record<string, unknown>
>(
  lattice: Lattice<TModel, TState, TActions, TViews>
): TViews {
  // Get all views from the private property
  return (lattice as LatticeLike<TModel, TState, TActions, TViews>).__view;
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  // Mock the isLattice function
  vi.mock('./identify', () => ({
    isLattice: vi.fn(() => true)
  }));
  
  describe('use', () => {
    it('should extract a view from a lattice by name', () => {
      // Create the view object
      const buttonView = { id: 'button-view' };
      const counterView = { id: 'counter-view' };

      // Mock a lattice for testing with private properties
      const mockLattice = {
        __view: {
          button: buttonView,
          counter: counterView
        }
      } as unknown as Lattice<any, any, any, any>;

      const result = use(mockLattice, 'button');
      // Should fail because our stub implementation doesn't extract the view
      expect(result).toBe(buttonView);
    });

    it('should throw if the requested view does not exist', () => {
      // Mock a lattice for testing with private properties
      const mockLattice = {
        __view: {
          button: { id: 'button-view' }
        }
      } as unknown as Lattice<any, any, any, any>;

      // Should fail because our stub implementation doesn't check if the view exists
      expect(() => use(mockLattice, 'nonexistent' as any)).toThrow('View "nonexistent" does not exist in lattice');
    });
  });

  describe('spreadViews', () => {
    it('should extract all views from a lattice', () => {
      // Mock a lattice for testing
      const mockViews = {
        button: { id: 'button-view' },
        counter: { id: 'counter-view' }
      };

      const mockLattice = {
        __view: mockViews
      } as unknown as Lattice<any, any, any, any>;

      const result = spreadViews(mockLattice);
      // Should fail because our stub implementation doesn't extract the views
      expect(result).toEqual(mockViews);
    });
  });
}