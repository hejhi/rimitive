import type { Instance } from '../types';

/**
 * Branding types for Lattice objects
 */
export type Branded<T, BrandName extends string> = T & {
  readonly __brand: BrandName;
};

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
): value is Instance<any> {
  return (
    typeof value === 'function' &&
    Object.prototype.hasOwnProperty.call(value, marker) &&
    value[marker as keyof typeof value] === true
  );
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

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
  });
}
