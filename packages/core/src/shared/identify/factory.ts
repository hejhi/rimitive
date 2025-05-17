import {
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  COMPONENT_FACTORY_BRAND,
  LATTICE_BRAND,
  Lattice,
  ComponentFactory,
} from '../types';
import { brandWithSymbol } from './marker';

/**
 * Type guard to check if an object is a ModelFactory
 *
 * @param value The value to check
 * @returns Whether the value is a ModelFactory
 */
export function isModelFactory(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, MODEL_FACTORY_BRAND) &&
    Boolean(Reflect.get(value, MODEL_FACTORY_BRAND))
  );
}

/**
 * Type guard to check if an object is a SelectorsFactory
 *
 * @param value The value to check
 * @returns Whether the value is a SelectorsFactory
 */
export function isSelectorsFactory(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, SELECTORS_FACTORY_BRAND) &&
    Boolean(Reflect.get(value, SELECTORS_FACTORY_BRAND))
  );
}

/**
 * Type guard to check if an object is an ActionsFactory
 *
 * @param value The value to check
 * @returns Whether the value is an ActionsFactory
 */
export function isActionsFactory(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, ACTIONS_FACTORY_BRAND) &&
    Boolean(Reflect.get(value, ACTIONS_FACTORY_BRAND))
  );
}

/**
 * Type guard to check if an object is a ViewFactory
 *
 * @param value The value to check
 * @returns Whether the value is a ViewFactory
 */
export function isViewFactory(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, VIEW_FACTORY_BRAND) &&
    Boolean(Reflect.get(value, VIEW_FACTORY_BRAND))
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

  describe('factory', () => {
    it('should correctly identify a ModelFactory', () => {
      const mockModelFactory = brandWithSymbol(
        {
          get: () => ({}),
          set: () => {},
        },
        MODEL_FACTORY_BRAND
      );

      expect(isModelFactory(mockModelFactory)).toBe(true);
      expect(isModelFactory({})).toBe(false);
      expect(isModelFactory({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify a SelectorsFactory', () => {
      const mockSelectorsFactory = brandWithSymbol(
        {
          get: () => ({}),
        },
        SELECTORS_FACTORY_BRAND
      );

      expect(isSelectorsFactory(mockSelectorsFactory)).toBe(true);
      expect(isSelectorsFactory({})).toBe(false);
      expect(isSelectorsFactory({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify an ActionsFactory', () => {
      const mockActionsFactory = brandWithSymbol(
        {
          mutate: () => () => {},
        },
        ACTIONS_FACTORY_BRAND
      );

      expect(isActionsFactory(mockActionsFactory)).toBe(true);
      expect(isActionsFactory({})).toBe(false);
      expect(isActionsFactory({ [Symbol('wrong')]: true })).toBe(false);
    });

    it('should correctly identify a ViewFactory', () => {
      const mockViewFactory = brandWithSymbol(
        {
          dispatch: () => {},
        },
        VIEW_FACTORY_BRAND
      );

      expect(isViewFactory(mockViewFactory)).toBe(true);
      expect(isViewFactory({})).toBe(false);
      expect(isViewFactory({ [Symbol('wrong')]: true })).toBe(false);
    });

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
