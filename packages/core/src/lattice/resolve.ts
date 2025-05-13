/**
 * Component resolution utilities for Lattice.
 *
 * This module provides utilities for resolving components when either a prepared
 * component or a lattice is provided, extracting the appropriate component if needed.
 * These utilities are used by the enhanced createLattice API to support pass-through
 * composition.
 */

import { isLattice } from './identify';
import { Lattice, LatticeLike } from './types';

/**
 * Extracts a specific component from a lattice if a lattice is provided,
 * otherwise returns the component directly.
 *
 * @param componentOrLattice Either a prepared component or a lattice
 * @param componentType The type of component to extract ('model', 'state', or 'actions')
 * @returns The resolved component
 */
export function resolveComponent<T>(
  componentOrLattice: T | Lattice<any, any, any, any>,
  componentType: 'model' | 'state' | 'actions'
): T {
  if (isLattice(componentOrLattice)) {
    // Map the public component type to the private property name
    const privateKey = `__${componentType}` as const;
    // Extract the requested component from the lattice
    return (componentOrLattice as LatticeLike<any, any, any, any>)[privateKey] as T;
  }
  return componentOrLattice as T;
}

/**
 * Extracts a specific view from a lattice if a lattice is provided,
 * otherwise returns the view directly.
 *
 * @param viewOrLattice Either a prepared view or a lattice
 * @param viewName The name of the view to extract (required if passing a lattice)
 * @returns The resolved view
 */
export function resolveView<T>(
  viewOrLattice: T | Lattice<any, any, any, Record<string, any>>,
  viewName?: string
): T {
  if (isLattice(viewOrLattice)) {
    if (!viewName) {
      throw new Error('View name must be provided when resolving a view from a lattice');
    }
    // Extract the specific view from the lattice using the private property
    const views = (viewOrLattice as LatticeLike<any, any, any, Record<string, any>>).__view;
    const view = views[viewName];
    if (!view) {
      throw new Error(`View "${viewName}" not found in lattice`);
    }
    return view as T;
  }
  return viewOrLattice as T;
}

/**
 * Extracts all views from a lattice if a lattice is provided,
 * otherwise returns the views object directly.
 *
 * @param viewsOrLattice Either a prepared views object or a lattice
 * @returns The resolved views object
 */
export function resolveViews<T extends Record<string, any>>(
  viewsOrLattice: T | Lattice<any, any, any, any>
): T {
  if (isLattice(viewsOrLattice)) {
    // Extract all views from the lattice using the private property
    return (viewsOrLattice as LatticeLike<any, any, any, any>).__view as T;
  }
  return viewsOrLattice as T;
}

// In-source tests
if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  // We need to mock the isLattice function
  vi.mock('./identify', () => ({
    isLattice: vi.fn((obj) => obj && obj.__isLatticeMock === true)
  }));

  describe('resolveComponent', () => {
    // Create the component objects
    const modelObj = { id: 'model-from-lattice' };
    const stateObj = { id: 'state-from-lattice' };
    const actionsObj = { id: 'actions-from-lattice' };
    const viewTestObj = { id: 'view-from-lattice' };

    // Mock a lattice for testing with private properties
    const mockLattice = {
      __isLatticeMock: true,
      __model: modelObj,
      __state: stateObj,
      __actions: actionsObj,
      __view: {
        test: viewTestObj
      }
    };

    it('should return the component directly if not a lattice', () => {
      const component = { id: 'direct-component' };
      const result = resolveComponent(component, 'model');
      expect(result).toBe(component);
    });

    it('should extract model from lattice', () => {
      const result = resolveComponent(mockLattice, 'model');
      // This should fail because our implementation doesn't check isLattice yet
      expect(result).not.toBe(mockLattice);
      expect(result).toBe(mockLattice.__model);
    });

    it('should extract state from lattice', () => {
      const result = resolveComponent(mockLattice, 'state');
      expect(result).toBe(mockLattice.__state);
    });

    it('should extract actions from lattice', () => {
      const result = resolveComponent(mockLattice, 'actions');
      expect(result).toBe(mockLattice.__actions);
    });
  });

  describe('resolveView', () => {
    // Create the view objects
    const testViewObj = { id: 'view-from-lattice' };
    const otherViewObj = { id: 'other-view-from-lattice' };

    // Mock a lattice for testing with private properties
    const mockLattice = {
      __isLatticeMock: true,
      __model: { id: 'model-from-lattice' },
      __state: { id: 'state-from-lattice' },
      __actions: { id: 'actions-from-lattice' },
      __view: {
        test: testViewObj,
        other: otherViewObj
      }
    };

    it('should return the view directly if not a lattice', () => {
      const view = { id: 'direct-view' };
      const result = resolveView(view, 'test');
      expect(result).toBe(view);
    });

    it('should extract specific view from lattice', () => {
      const result = resolveView(mockLattice, 'test');
      expect(result).toBe(mockLattice.__view.test);
    });

    it('should throw if no view name is provided when resolving from lattice', () => {
      // This should fail because our implementation doesn't check for missing view name
      expect(() => resolveView(mockLattice)).toThrow('View name must be provided');
    });

    it('should throw if the requested view does not exist in the lattice', () => {
      // This should fail because our implementation doesn't check for nonexistent views
      expect(() => resolveView(mockLattice, 'nonexistent')).toThrow('View "nonexistent" not found');
    });
  });

  describe('resolveViews', () => {
    // Create the views object
    const viewsObj = {
      test: { id: 'view-from-lattice' },
      other: { id: 'other-view-from-lattice' }
    };

    // Mock a lattice for testing with private properties
    const mockLattice = {
      __isLatticeMock: true,
      __model: { id: 'model-from-lattice' },
      __state: { id: 'state-from-lattice' },
      __actions: { id: 'actions-from-lattice' },
      __view: viewsObj
    };

    it('should return the views object directly if not a lattice', () => {
      const views = {
        test: { id: 'direct-view' },
        other: { id: 'other-direct-view' }
      };
      const result = resolveViews(views);
      expect(result).toBe(views);
    });

    it('should extract all views from lattice', () => {
      const result = resolveViews(mockLattice);
      expect(result).toBe(mockLattice.__view);
    });
  });
}