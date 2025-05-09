import type { ActionInstance } from './types';
import {
  createMarker,
  markAsLatticeObject,
  isLatticeObject,
  Branded,
} from '../shared/identify';

/**
 * Branded type for Lattice actions
 */
export type LatticeAction<T> = Branded<T, 'LatticeAction'>;

/**
 * A symbol used to mark valid Lattice actions
 */
export const LATTICE_ACTION_MARKER = createMarker('LATTICE_ACTION');

/**
 * Marks a value as a valid Lattice action
 *
 * @param value The value to mark as a Lattice action
 */
export function markAsLatticeAction<T>(
  value: T
): T & Record<typeof LATTICE_ACTION_MARKER, boolean> {
  return markAsLatticeObject(value, LATTICE_ACTION_MARKER);
}

/**
 * Checks if a given value is a valid Lattice action
 *
 * @param value The value to check
 * @returns Whether the value is a valid Lattice action
 */
export function isLatticeAction(value: unknown): value is ActionInstance<any> {
  return isLatticeObject(value, LATTICE_ACTION_MARKER);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createAction } = await import('./create');

  describe('isLatticeAction', () => {
    it('should correctly identify marked vs unmarked functions', () => {
      // Create a simple function
      const unmarkedFunction = () => ({ increment: () => {} });

      // Not marked yet
      expect(isLatticeAction(unmarkedFunction)).toBe(false);

      // Mark it manually using the symbol
      // We need to use unknown first since functions don't naturally have index signatures
      (
        unmarkedFunction as unknown as Record<
          typeof LATTICE_ACTION_MARKER,
          boolean
        >
      )[LATTICE_ACTION_MARKER] = true;

      // Should now be identified as a Lattice action
      expect(isLatticeAction(unmarkedFunction)).toBe(true);
    });

    it('should handle non-function values correctly', () => {
      // Test with various non-function values
      expect(isLatticeAction(null)).toBe(false);
      expect(isLatticeAction(undefined)).toBe(false);
      expect(isLatticeAction({})).toBe(false);
      expect(isLatticeAction(42)).toBe(false);
      expect(isLatticeAction('string')).toBe(false);

      // Even with the marker, non-functions should not be valid
      const obj = {
        [LATTICE_ACTION_MARKER]: true,
      };

      expect(isLatticeAction(obj)).toBe(false);
    });

    it('should work with the createAction function (integration)', () => {
      const validAction = createAction(() => ({ increment: () => {} }));
      expect(isLatticeAction(validAction)).toBe(true);
    });
  });

  describe('markAsLatticeAction', () => {
    it('should mark a function as a Lattice action', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isLatticeAction(regularFunction)).toBe(false);

      // Check that the marker is not defined yet
      expect(
        Object.prototype.hasOwnProperty.call(
          regularFunction,
          LATTICE_ACTION_MARKER
        )
      ).toBe(false);

      // After marking
      const markedFunction = markAsLatticeAction(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[LATTICE_ACTION_MARKER]).toBe(true);

      // Should pass the isLatticeAction check
      expect(isLatticeAction(markedFunction)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      const marked1 = markAsLatticeAction(fn);
      const marked2 = markAsLatticeAction(marked1);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isLatticeAction(marked1)).toBe(true);
      expect(isLatticeAction(marked2)).toBe(true);
    });
  });
}
