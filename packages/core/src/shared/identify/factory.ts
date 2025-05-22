import {
  MODEL_TOOLS_BRAND,
  SELECTORS_TOOLS_BRAND,
  ACTIONS_TOOLS_BRAND,
  VIEW_TOOLS_BRAND,
  COMPONENT_FACTORY_BRAND,
  LATTICE_BRAND,
  Lattice,
  ComponentFactory,
} from '../types';
import { brandWithSymbol } from './marker';

/**
 * Type guard to check if an object is a Model Tools object
 *
 * @param value The value to check
 * @returns Whether the value is a Model Tools object
 */
export function isModelTools(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, MODEL_TOOLS_BRAND) &&
    Boolean(Reflect.get(value, MODEL_TOOLS_BRAND))
  );
}

/**
 * Type guard to check if an object is a Selectors Tools object
 *
 * @param value The value to check
 * @returns Whether the value is a Selectors Tools object
 */
export function isSelectorsTools(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, SELECTORS_TOOLS_BRAND) &&
    Boolean(Reflect.get(value, SELECTORS_TOOLS_BRAND))
  );
}

/**
 * Type guard to check if an object is an Actions Tools object
 *
 * @param value The value to check
 * @returns Whether the value is an Actions Tools object
 */
export function isActionsTools(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, ACTIONS_TOOLS_BRAND) &&
    Boolean(Reflect.get(value, ACTIONS_TOOLS_BRAND))
  );
}

/**
 * Type guard to check if an object is a View Tools object
 *
 * @param value The value to check
 * @returns Whether the value is a View Tools object
 */
export function isViewTools(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, VIEW_TOOLS_BRAND) &&
    Boolean(Reflect.get(value, VIEW_TOOLS_BRAND))
  );
}

/**
 * Type guard to check if a value is a lattice instance
 *
 * @param value The value to check
 * @returns Whether the value is a lattice instance
 */
export function isLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(value: unknown): value is Lattice<TModel, TState, TActions, TViews> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, LATTICE_BRAND) &&
    Boolean(Reflect.get(value, LATTICE_BRAND))
  );
}

/**
 * Marks a value as a lattice
 *
 * @param value The value to mark
 * @returns The lattice-branded value
 */
export function markAsLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(value: any): Lattice<TModel, TState, TActions, TViews> {
  return brandWithSymbol(value, LATTICE_BRAND) as Lattice<
    TModel,
    TState,
    TActions,
    TViews
  >;
}

/**
 * Type guard to check if a value is a component factory
 *
 * @param value The value to check
 * @returns Whether the value is a component factory
 */
export function isComponentFactory<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  value: unknown
): value is ComponentFactory<TModel, TSelectors, TActions, TViews> {
  return (
    value !== null &&
    typeof value === 'function' &&
    Object.prototype.hasOwnProperty.call(value, COMPONENT_FACTORY_BRAND) &&
    Boolean(Reflect.get(value, COMPONENT_FACTORY_BRAND))
  );
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('tools identification', () => {
    it('should correctly identify a ModelTools object', () => {
      const mockModelTools = brandWithSymbol(
        {
          get: () => ({}),
          set: () => {},
        },
        MODEL_TOOLS_BRAND
      );

      expect(isModelTools(mockModelTools)).toBe(true);
      expect(isModelTools({})).toBe(false);
      expect(isModelTools({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify a SelectorsTools object', () => {
      const mockSelectorsTools = brandWithSymbol(
        {
          get: () => ({}),
        },
        SELECTORS_TOOLS_BRAND
      );

      expect(isSelectorsTools(mockSelectorsTools)).toBe(true);
      expect(isSelectorsTools({})).toBe(false);
      expect(isSelectorsTools({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify an ActionsTools object', () => {
      const mockActionsTools = brandWithSymbol(
        {
          mutate: () => () => {},
        },
        ACTIONS_TOOLS_BRAND
      );

      expect(isActionsTools(mockActionsTools)).toBe(true);
      expect(isActionsTools({})).toBe(false);
      expect(isActionsTools({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify a ViewTools object', () => {
      const mockViewTools = brandWithSymbol(
        {
          dispatch: () => {},
        },
        VIEW_TOOLS_BRAND
      );

      expect(isViewTools(mockViewTools)).toBe(true);
      expect(isViewTools({})).toBe(false);
      expect(isViewTools({ [Symbol('wrong')]: true })).toBe(false);
    });
  });

  describe('lattice', () => {
    it('should correctly identify a Lattice', () => {
      // Create a mock lattice-like object
      const mockLattice = {
        getModel: vi.fn(),
        getState: vi.fn(),
        getActions: vi.fn(),
        getView: vi.fn(),
        getAllViews: vi.fn(),
      };

      // Not a lattice before branding
      expect(isLattice(mockLattice)).toBe(false);

      // Mark it as a lattice
      const branded = markAsLattice(mockLattice);

      // Should be identified as a lattice
      expect(isLattice(branded)).toBe(true);

      // Should be the same object reference
      expect(branded).toBe(mockLattice);
    });

    it('should handle non-lattice values correctly', () => {
      expect(isLattice(null)).toBe(false);
      expect(isLattice(undefined)).toBe(false);
      expect(isLattice(42)).toBe(false);
      expect(isLattice('string')).toBe(false);
      expect(isLattice({})).toBe(false);
      expect(isLattice(() => {})).toBe(false);
    });

    it('should correctly identify a ComponentFactory', () => {
      const mockComponentFactory = brandWithSymbol(
        () => ({}),
        COMPONENT_FACTORY_BRAND
      );

      expect(isComponentFactory(mockComponentFactory)).toBe(true);
      expect(isComponentFactory({})).toBe(false);
      expect(isComponentFactory(() => {})).toBe(false);
      expect(isComponentFactory({ [Symbol('wrong')]: true })).toBe(false);
    });
  });
}
