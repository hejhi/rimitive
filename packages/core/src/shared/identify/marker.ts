import { Branded } from '../types';

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
 * Generic function to check if a given value is a valid Lattice object
 *
 * @param value The value to check
 * @param marker The marker symbol to check for
 * @returns Whether the value is a valid Lattice object
 */
export function isBranded<M extends symbol>(
  value: unknown,
  marker: M
): boolean {
  return (
    (typeof value === 'function' || typeof value === 'object') &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, marker) &&
    Boolean(Reflect.get(value, marker))
  );
}

/**
 * Generic function to brand any value with a specific symbol
 *
 * @param value The value to brand
 * @param symbol The symbol to use for branding
 * @returns The branded value
 */
export function brandWithSymbol<T, M extends symbol>(
  value: T,
  symbol: M
): Branded<T, M> {
  // Check if already branded to make it idempotent
  if (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, symbol) &&
    Boolean(Reflect.get(value, symbol))
  ) {
    return value as Branded<T, M>;
  }

  // We need a single type assertion here to add the symbol property
  Object.defineProperty(value, symbol, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return value as Branded<T, M>;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('marker', () => {
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
      expect(isBranded(unmarkedFunction, TEST_MARKER)).toBe(false);

      // Mark it manually using the symbol
      brandWithSymbol(unmarkedFunction, TEST_MARKER);

      // Should now be identified as a Lattice object
      expect(isBranded(unmarkedFunction, TEST_MARKER)).toBe(true);
    });

    it('should handle non-function/non-object values correctly', () => {
      const TEST_MARKER = createMarker('TEST');

      // Test with various primitive values
      expect(isBranded(null, TEST_MARKER)).toBe(false);
      expect(isBranded(undefined, TEST_MARKER)).toBe(false);
      expect(isBranded(42, TEST_MARKER)).toBe(false);
      expect(isBranded('string', TEST_MARKER)).toBe(false);

      // Empty object without the marker should return false
      expect(isBranded({}, TEST_MARKER)).toBe(false);

      // But object with marker should be valid (our behavior has changed)
      const obj = {} as Record<symbol, boolean>;
      obj[TEST_MARKER] = true;

      expect(isBranded(obj, TEST_MARKER)).toBe(true);
    });

    it('should mark a function as a Lattice object', () => {
      const TEST_MARKER = createMarker('TEST');
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isBranded(regularFunction, TEST_MARKER)).toBe(false);

      // After marking
      const markedFunction = brandWithSymbol(regularFunction, TEST_MARKER);

      // Should be marked with the correct symbol
      expect(Reflect.get(markedFunction, TEST_MARKER)).toBe(true);

      // Should pass the isBranded check
      expect(isBranded(markedFunction, TEST_MARKER)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      const TEST_MARKER = createMarker('TEST');

      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      const marked1 = brandWithSymbol(fn, TEST_MARKER);
      const marked2 = brandWithSymbol(marked1, TEST_MARKER);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isBranded(marked1, TEST_MARKER)).toBe(true);
      expect(isBranded(marked2, TEST_MARKER)).toBe(true);
    });
  });
}
