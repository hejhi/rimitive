import { brandWithSymbol } from '../shared/identify';
import { STATE_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice state
 *
 * @param value The value to mark as a Lattice state
 */
export function markAsLatticeState<T>(value: T) {
  return brandWithSymbol(value, STATE_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createState } = await import('./create');
  const { isStateInstance } = await import('../shared/identify');

  describe('markAsLatticeState', () => {
    it('should mark a function as a Lattice state', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isStateInstance(regularFunction)).toBe(false);

      // Check that the marker is not defined yet
      expect(
        Object.prototype.hasOwnProperty.call(
          regularFunction,
          STATE_INSTANCE_BRAND
        )
      ).toBe(false);

      // After marking
      const markedFunction = markAsLatticeState(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[STATE_INSTANCE_BRAND]).toBe(true);

      // Should pass the isStateInstance check
      expect(isStateInstance(markedFunction)).toBe(true);

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
      expect(isStateInstance(marked1)).toBe(true);
      expect(isStateInstance(marked2)).toBe(true);
    });

    it('should work with the createState function (integration)', () => {
      const validState = createState(() => ({ count: 1 }));
      expect(isStateInstance(validState)).toBe(true);
    });
  });
}
