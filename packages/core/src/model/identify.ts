import type { ModelInstance } from './types';

/**
 * A symbol used to mark valid Lattice models
 */
export const LATTICE_MODEL_MARKER = Symbol('LATTICE_MODEL');

/**
 * Marks a value as a valid Lattice model
 *
 * @param value The value to mark as a Lattice model
 */
export function markAsLatticeModel<
  T extends ModelInstance<any> & { [LATTICE_MODEL_MARKER]?: boolean },
>(value: T): T & ModelInstance<any> {
  value[LATTICE_MODEL_MARKER] = true;
  return value;
}

/**
 * Checks if a given value is a valid Lattice model
 *
 * @param value The value to check
 * @returns Whether the value is a valid Lattice model
 */
export function isLatticeModel(value: unknown): value is ModelInstance<any> {
  return (
    typeof value === 'function' &&
    LATTICE_MODEL_MARKER in value &&
    value[LATTICE_MODEL_MARKER] === true
  );
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createModel } = await import('./create');

  describe('isLatticeModel', () => {
    it('should correctly identify marked vs unmarked functions', () => {
      // Create a simple function
      const unmarkedFunction = () => ({ count: 1 });

      // Not marked yet
      expect(isLatticeModel(unmarkedFunction)).toBe(false);

      // Mark it manually using the symbol
      unmarkedFunction[LATTICE_MODEL_MARKER] = true;

      // Should now be identified as a Lattice model
      expect(isLatticeModel(unmarkedFunction)).toBe(true);
    });

    it('should handle non-function values correctly', () => {
      // Test with various non-function values
      expect(isLatticeModel(null)).toBe(false);
      expect(isLatticeModel(undefined)).toBe(false);
      expect(isLatticeModel({})).toBe(false);
      expect(isLatticeModel(42)).toBe(false);
      expect(isLatticeModel('string')).toBe(false);

      // Even with the marker, non-functions should not be valid
      const obj = {
        [LATTICE_MODEL_MARKER]: true,
      };

      expect(isLatticeModel(obj)).toBe(false);
    });

    it('should work with the createModel function (integration)', () => {
      const validModel = createModel(() => ({ count: 1 }));
      expect(isLatticeModel(validModel)).toBe(true);
    });
  });

  describe('markAsLatticeModel', () => {
    it('should mark a function as a Lattice model', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isLatticeModel(regularFunction)).toBe(false);

      // @ts-expect-error - marker is not defined on the function
      expect(regularFunction[LATTICE_MODEL_MARKER]).toBeUndefined();

      // After marking
      // @ts-expect-error - this is not an actual model instance
      const markedFunction = markAsLatticeModel(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[LATTICE_MODEL_MARKER]).toBe(true);

      // Should pass the isLatticeModel check
      expect(isLatticeModel(markedFunction)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      // @ts-expect-error - this is not an actual model instance
      const marked1 = markAsLatticeModel(fn);
      const marked2 = markAsLatticeModel(marked1);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isLatticeModel(marked1)).toBe(true);
      expect(isLatticeModel(marked2)).toBe(true);
    });
  });
}
