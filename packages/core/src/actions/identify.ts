import { brandWithSymbol } from '../shared/identify';
import { ACTIONS_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice action
 *
 * @param value The value to mark as a Lattice action
 */
export function markAsLatticeAction<T>(value: T) {
  return brandWithSymbol(value, ACTIONS_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createAction } = await import('./create');
  const { isActionInstance } = await import('../shared/identify');

  describe('markAsLatticeAction', () => {
    it('should mark a function as a Lattice action', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isActionInstance(regularFunction)).toBe(false);

      // Check that the marker is not defined yet
      expect(
        Object.prototype.hasOwnProperty.call(
          regularFunction,
          ACTIONS_INSTANCE_BRAND
        )
      ).toBe(false);

      // After marking
      const markedFunction = markAsLatticeAction(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[ACTIONS_INSTANCE_BRAND]).toBe(true);

      // Should pass the isActionInstance check
      expect(isActionInstance(markedFunction)).toBe(true);

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
      expect(isActionInstance(marked1)).toBe(true);
      expect(isActionInstance(marked2)).toBe(true);
    });

    it('should work with the createAction function (integration)', () => {
      const validAction = createAction(() => ({ increment: () => {} }));
      expect(isActionInstance(validAction)).toBe(true);
    });
  });
}
