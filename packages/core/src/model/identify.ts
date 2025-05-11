import { brandWithSymbol } from '../shared/identify';
import { MODEL_INSTANCE_BRAND } from '../shared/types';

/**
 * Marks a value as a valid Lattice model
 *
 * @param value The value to mark as a Lattice model
 */
export function markAsLatticeModel<T>(value: T) {
  return brandWithSymbol(value, MODEL_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { createModel } = await import('./create');
  const { isModelInstance } = await import('../shared/identify');

  describe('markAsLatticeModel', () => {
    it('should mark a function as a Lattice model', () => {
      const regularFunction = () => ({ hello: 'world' });

      // Before marking
      expect(isModelInstance(regularFunction)).toBe(false);

      // Check that the marker is not defined yet
      expect(
        Object.prototype.hasOwnProperty.call(
          regularFunction,
          MODEL_INSTANCE_BRAND
        )
      ).toBe(false);

      // After marking
      const markedFunction = markAsLatticeModel(regularFunction);

      // Should be marked with the correct symbol
      expect(markedFunction[MODEL_INSTANCE_BRAND]).toBe(true);

      // Should pass the isModelInstance check
      expect(isModelInstance(markedFunction)).toBe(true);

      // Should be the same function reference (no wrapping)
      expect(markedFunction).toBe(regularFunction);
    });

    it('should be idempotent', () => {
      // Marking the same function twice should have no additional effect
      const fn = () => ({ data: 'test' });

      const marked1 = markAsLatticeModel(fn);
      const marked2 = markAsLatticeModel(marked1);

      expect(marked1).toBe(fn);
      expect(marked2).toBe(fn);
      expect(isModelInstance(marked1)).toBe(true);
      expect(isModelInstance(marked2)).toBe(true);
    });

    it('should work with the createModel function (integration)', () => {
      const validModel = createModel(() => ({ count: 1 }));
      expect(isModelInstance(validModel)).toBe(true);
    });
  });
}
