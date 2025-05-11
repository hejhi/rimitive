import type {
  BaseInstance,
  ModelFactory,
  StateFactory,
  ActionsFactory,
  ViewFactory,
  ModelInstance,
  StateInstance,
  ActionInstance,
  ViewInstance,
  SymbolBranded,
} from '../types';
import {
  MODEL_FACTORY_BRAND,
  STATE_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  MODEL_INSTANCE_BRAND,
  STATE_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
} from '../types';

/**
 * Generic function to create a marker for Lattice objects
 *
 * @param markerName The name of the marker to create
 * @returns A symbol that can be used to mark objects
 */
export function createMarker(markerName: string): symbol {
  return Symbol(markerName);
}

/**
 * Generic function to mark a value as a valid Lattice object
 *
 * @param value The value to mark
 * @param marker The marker symbol to use
 * @returns The marked value
 */
export function markAsLatticeObject<T, M extends symbol>(
  value: T,
  marker: M
): T & Record<M, boolean> {
  (value as Record<M, boolean>)[marker] = true;
  return value as T & Record<M, boolean>;
}

/**
 * Generic function to check if a given value is a valid Lattice object
 *
 * @param value The value to check
 * @param marker The marker symbol to check for
 * @returns Whether the value is a valid Lattice object
 */
export function isLatticeObject(
  value: unknown,
  marker: symbol
): value is BaseInstance<any> {
  return (
    typeof value === 'function' &&
    Object.prototype.hasOwnProperty.call(value, marker) &&
    value[marker as keyof typeof value] === true
  );
}

/**
 * Type guard to check if an object is a ModelFactory
 *
 * @param value The value to check
 * @returns Whether the value is a ModelFactory
 */
export function isModelFactory<T>(value: unknown): value is ModelFactory<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, MODEL_FACTORY_BRAND) &&
    value[MODEL_FACTORY_BRAND as keyof typeof value] === true
  );
}

/**
 * Type guard to check if an object is a StateFactory
 *
 * @param value The value to check
 * @returns Whether the value is a StateFactory
 */
export function isStateFactory<T>(value: unknown): value is StateFactory<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, STATE_FACTORY_BRAND) &&
    value[STATE_FACTORY_BRAND as keyof typeof value] === true
  );
}

/**
 * Type guard to check if an object is an ActionsFactory
 *
 * @param value The value to check
 * @returns Whether the value is an ActionsFactory
 */
export function isActionsFactory<T>(
  value: unknown
): value is ActionsFactory<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, ACTIONS_FACTORY_BRAND) &&
    value[ACTIONS_FACTORY_BRAND as keyof typeof value] === true
  );
}

/**
 * Type guard to check if an object is a ViewFactory
 *
 * @param value The value to check
 * @returns Whether the value is a ViewFactory
 */
export function isViewFactory<T>(value: unknown): value is ViewFactory<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, VIEW_FACTORY_BRAND) &&
    value[VIEW_FACTORY_BRAND as keyof typeof value] === true
  );
}

/**
 * Type guard to check if a value is a model instance
 *
 * @param value The value to check
 * @returns Whether the value is a model instance
 */
export function isModelInstance(value: unknown): value is ModelInstance<any> {
  return isLatticeObject(value, MODEL_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is a state instance
 *
 * @param value The value to check
 * @returns Whether the value is a state instance
 */
export function isStateInstance(value: unknown): value is StateInstance<any> {
  return isLatticeObject(value, STATE_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is an action instance
 *
 * @param value The value to check
 * @returns Whether the value is an action instance
 */
export function isActionInstance(value: unknown): value is ActionInstance<any> {
  return isLatticeObject(value, ACTIONS_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is a view instance
 *
 * @param value The value to check
 * @returns Whether the value is a view instance
 */
export function isViewInstance(value: unknown): value is ViewInstance<any> {
  return isLatticeObject(value, VIEW_INSTANCE_BRAND);
}

/**
 * Generic function to brand any value with a specific symbol
 *
 * @param value The value to brand
 * @param symbol The symbol to use for branding
 * @returns The branded value
 */
export function brandWithSymbol<T, S extends symbol>(
  value: T,
  symbol: S
): SymbolBranded<T, S> {
  return markAsLatticeObject(value, symbol) as SymbolBranded<T, S>;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  // Using the brand symbols imported at the top of the file

  describe('identify module', () => {
    it('should create unique markers', () => {
      const marker1 = createMarker('TEST1');
      const marker2 = createMarker('TEST2');

      expect(marker1).not.toBe(marker2);
      expect(typeof marker1).toBe('symbol');
      expect(marker1.description).toBe('TEST1');
      expect(marker2.description).toBe('TEST2');
    });

    it('should correctly identify marked vs unmarked functions', () => {
      const TEST_MARKER = createMarker('TEST');

      // Create a simple function
      const unmarkedFunction = () => ({ count: 1 });

      // Not marked yet
      expect(isLatticeObject(unmarkedFunction, TEST_MARKER)).toBe(false);

      // Mark it manually using the symbol
      (unmarkedFunction as any)[TEST_MARKER] = true;

      // Should now be identified as a Lattice object
      expect(isLatticeObject(unmarkedFunction, TEST_MARKER)).toBe(true);
    });

    it('should handle non-function values correctly', () => {
      const TEST_MARKER = createMarker('TEST');

      // Test with various non-function values
      expect(isLatticeObject(null, TEST_MARKER)).toBe(false);
      expect(isLatticeObject(undefined, TEST_MARKER)).toBe(false);
      expect(isLatticeObject({}, TEST_MARKER)).toBe(false);
      expect(isLatticeObject(42, TEST_MARKER)).toBe(false);
      expect(isLatticeObject('string', TEST_MARKER)).toBe(false);

      // Even with the marker, non-functions should not be valid
      const obj = {
        [TEST_MARKER]: true,
      };

      expect(isLatticeObject(obj, TEST_MARKER)).toBe(false);
    });

    it('should mark a function as a Lattice object', () => {
      const TEST_MARKER = createMarker('TEST');
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isLatticeObject(regularFunction, TEST_MARKER)).toBe(false);

      // After marking
      const markedFunction = markAsLatticeObject(
        regularFunction as any,
        TEST_MARKER
      );

      // Should be marked with the correct symbol
      expect((markedFunction as any)[TEST_MARKER]).toBe(true);

      // Should pass the isLatticeObject check
      expect(isLatticeObject(markedFunction, TEST_MARKER)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      const TEST_MARKER = createMarker('TEST');

      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      const marked1 = markAsLatticeObject(fn as any, TEST_MARKER);
      const marked2 = markAsLatticeObject(marked1, TEST_MARKER);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isLatticeObject(marked1, TEST_MARKER)).toBe(true);
      expect(isLatticeObject(marked2, TEST_MARKER)).toBe(true);
    });

    describe('Factory type guards', () => {
      it('should correctly identify a ModelFactory', () => {
        const mockModelFactory = brandWithSymbol({
          get: () => ({}),
          set: () => {},
        }, MODEL_FACTORY_BRAND);

        expect(isModelFactory(mockModelFactory)).toBe(true);
        expect(isModelFactory({})).toBe(false);
        expect(isModelFactory({ [Symbol('wrong')]: true })).toBe(false);
      });

      it('should correctly identify a StateFactory', () => {
        const mockStateFactory = brandWithSymbol({
          get: () => ({}),
          derive: () => {},
        }, STATE_FACTORY_BRAND);

        expect(isStateFactory(mockStateFactory)).toBe(true);
        expect(isStateFactory({})).toBe(false);
        expect(isStateFactory({ [Symbol('wrong')]: true })).toBe(false);
      });

      it('should correctly identify an ActionsFactory', () => {
        const mockActionsFactory = brandWithSymbol({
          mutate: () => () => {},
        }, ACTIONS_FACTORY_BRAND);

        expect(isActionsFactory(mockActionsFactory)).toBe(true);
        expect(isActionsFactory({})).toBe(false);
        expect(isActionsFactory({ [Symbol('wrong')]: true })).toBe(false);
      });

      it('should correctly identify a ViewFactory', () => {
        const mockViewFactory = brandWithSymbol({
          derive: () => {},
          dispatch: () => {},
        }, VIEW_FACTORY_BRAND);

        expect(isViewFactory(mockViewFactory)).toBe(true);
        expect(isViewFactory({})).toBe(false);
        expect(isViewFactory({ [Symbol('wrong')]: true })).toBe(false);
      });
    });
  });
}
