import type { StateInstance } from './types';
import {
  createMarker,
  markAsLatticeObject,
  isLatticeObject,
  Branded,
} from '../shared/identify';

/**
 * Branded type for Lattice states
 */
export type LatticeState<T> = Branded<T, 'LatticeState'>;

/**
 * A symbol used to mark valid Lattice states
 */
export const LATTICE_STATE_MARKER = createMarker('LATTICE_STATE');

/**
 * Marks a value as a valid Lattice state
 *
 * @param value The value to mark as a Lattice state
 */
export function markAsLatticeState<T>(
  value: T
): T & Record<typeof LATTICE_STATE_MARKER, boolean> {
  return markAsLatticeObject(value, LATTICE_STATE_MARKER);
}

/**
 * Checks if a given value is a valid Lattice state
 *
 * @param value The value to check
 * @returns Whether the value is a valid Lattice state
 */
export function isLatticeState(value: unknown): value is StateInstance<any> {
  return isLatticeObject(value, LATTICE_STATE_MARKER);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createState } = await import('./create');

  describe('isLatticeState', () => {
    it('should correctly identify marked vs unmarked functions', () => {
      // Create a simple function
      const unmarkedFunction = () => ({ count: 1 });

      // Not marked yet
      expect(isLatticeState(unmarkedFunction)).toBe(false);

      // Mark it manually using the symbol
      (
        unmarkedFunction as unknown as Record<
          typeof LATTICE_STATE_MARKER,
          boolean
        >
      )[LATTICE_STATE_MARKER] = true;

      // Should now be identified as a Lattice state
      expect(isLatticeState(unmarkedFunction)).toBe(true);
    });

    it('should handle non-function values correctly', () => {
      // Test with various non-function values
      expect(isLatticeState(null)).toBe(false);
      expect(isLatticeState(undefined)).toBe(false);
      expect(isLatticeState({})).toBe(false);
      expect(isLatticeState(42)).toBe(false);
      expect(isLatticeState('string')).toBe(false);

      // Even with the marker, non-functions should not be valid
      const obj = {
        [LATTICE_STATE_MARKER]: true,
      };

      expect(isLatticeState(obj)).toBe(false);
    });

    it('should work with the createState function (integration)', () => {
      const validState = createState(() => ({ count: 1 }));
      expect(isLatticeState(validState)).toBe(true);
    });
  });

  describe('markAsLatticeState', () => {
    it('should mark a function as a Lattice state', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isLatticeState(regularFunction)).toBe(false);

      // Check that the marker is not defined yet
      expect(
        Object.prototype.hasOwnProperty.call(
          regularFunction,
          LATTICE_STATE_MARKER
        )
      ).toBe(false);

      // After marking
      const markedFunction = markAsLatticeState(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[LATTICE_STATE_MARKER]).toBe(true);

      // Should pass the isLatticeState check
      expect(isLatticeState(markedFunction)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      const marked1 = markAsLatticeState(fn);
      const marked2 = markAsLatticeState(marked1);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isLatticeState(marked1)).toBe(true);
      expect(isLatticeState(marked2)).toBe(true);
    });
  });
}
