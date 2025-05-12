import { LatticeLike, PartialLattice } from '../types';

/**
 * Extracts a component from a lattice for composition.
 * This function allows safely extracting a model, state, actions, or view from a lattice
 * to use in composition with the `composeWith` function.
 */

// Production overloads for LatticeLike

// Overload for 'model' component
export function use<L extends LatticeLike>(
  lattice: L,
  componentName: 'model'
): L['model'];

// Overload for 'state' component
export function use<L extends LatticeLike>(
  lattice: L,
  componentName: 'state'
): L['state'];

// Overload for 'actions' component
export function use<L extends LatticeLike>(
  lattice: L,
  componentName: 'actions'
): L['actions'];

// Overload for 'view' component (requires viewName)
export function use<L extends LatticeLike, V extends keyof L['view']>(
  lattice: L,
  componentName: 'view',
  viewName: V
): L['view'][V];

// Testing overloads for PartialLattice (for tests and more flexible usage)

// Generic partial lattice component access
export function use(lattice: PartialLattice, componentName: string): unknown;

// View component access with viewName
export function use(
  lattice: PartialLattice,
  componentName: 'view',
  viewName: string
): unknown;

// Handle error cases for testing (non-object lattices)
export function use(
  lattice: null | undefined | string | number | boolean,
  componentName: string
): never;

/**
 * Implementation of the use function
 *
 * @param lattice The lattice containing the component
 * @param componentName The name of the component to extract ('model', 'state', 'actions', or 'view')
 * @param viewName Optional name of a specific view if componentName is 'view'
 * @returns The extracted component, ready for composition
 */
export function use(
  lattice:
    | LatticeLike
    | PartialLattice
    | null
    | undefined
    | string
    | number
    | boolean,
  componentName: string,
  viewName?: string
): unknown {
  // Check if the lattice is valid
  if (!lattice || typeof lattice !== 'object') {
    throw new Error('Invalid lattice: Must be a valid lattice object');
  }

  // Handle view components (which are nested)
  if (componentName === 'view') {
    // Require viewName when accessing views
    if (!viewName) {
      throw new Error(
        'A viewName is required when extracting a view component'
      );
    }

    // Check if the view namespace exists
    if (!lattice.view || typeof lattice.view !== 'object') {
      throw new Error('Lattice does not contain any views');
    }

    // Check if the specific view exists
    if (!(viewName in lattice.view)) {
      throw new Error(`View '${viewName}' not found in lattice`);
    }

    return lattice.view[viewName];
  }

  // Handle standard components (model, state, actions)
  if (componentName in lattice) {
    return lattice[componentName as keyof LatticeLike];
  }

  throw new Error(`Component '${componentName}' not found in lattice`);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('use function', () => {
    it('should extract standard components from a lattice', () => {
      // Mock lattice with standard components
      const mockModel = () => ({});
      const mockState = () => ({});
      const mockActions = () => ({});

      const mockLattice = {
        model: mockModel,
        state: mockState,
        actions: mockActions,
      };

      // Test extraction of each component
      expect(use(mockLattice, 'model')).toBe(mockModel);
      expect(use(mockLattice, 'state')).toBe(mockState);
      expect(use(mockLattice, 'actions')).toBe(mockActions);
    });

    it('should extract view components from a lattice using the viewName parameter', () => {
      // Mock view components
      const mockCounterView = () => ({});
      const mockButtonView = () => ({});

      // Mock lattice with view components
      const mockLattice = {
        view: {
          counter: mockCounterView,
          button: mockButtonView,
        },
      };

      // Test extraction of view components
      expect(use(mockLattice, 'view', 'counter')).toBe(mockCounterView);
      expect(use(mockLattice, 'view', 'button')).toBe(mockButtonView);
    });

    it('should throw when trying to extract a view without a viewName', () => {
      const mockLattice = {
        view: {
          counter: () => ({}),
        },
      };

      expect(() => use(mockLattice, 'view')).toThrow('A viewName is required');
    });

    it('should throw an error for invalid lattices', () => {
      expect(() => use(null, 'model')).toThrow('Invalid lattice');
      expect(() => use(undefined, 'model')).toThrow('Invalid lattice');
      expect(() => use('not a lattice', 'model')).toThrow('Invalid lattice');
    });

    it('should throw an error for non-existent components', () => {
      const mockLattice = { model: () => ({}) };
      expect(() => use(mockLattice, 'nonExistent')).toThrow(
        "Component 'nonExistent' not found"
      );
    });

    it('should throw an error for non-existent views', () => {
      const mockLattice = {
        view: {
          counter: () => ({}),
        },
      };
      expect(() => use(mockLattice, 'view', 'nonExistent')).toThrow(
        "View 'nonExistent' not found"
      );
    });
  });
}
