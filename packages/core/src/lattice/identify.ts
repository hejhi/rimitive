import { markAsLatticeObject } from '../shared/identify';
import { LatticeLike, Lattice, LATTICE_BRAND } from './types';

/**
 * Type guard to check if a value is a valid lattice instance
 *
 * @param value The value to check
 * @returns Whether the value is a valid lattice instance
 */
export function isLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(value: unknown): value is Lattice<TModel, TState, TActions, TViews> {
  if (
    !value ||
    typeof value !== 'object' ||
    !('model' in value) ||
    !('state' in value) ||
    !('actions' in value) ||
    !('view' in value)
  ) {
    return false;
  }

  // Check for lattice brand
  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.getOwnPropertySymbols(value).includes(LATTICE_BRAND)
  );
}

/**
 * Marks a value as a lattice instance
 *
 * @param value The value to mark
 * @returns The marked value
 */
export function markAsLattice<
  TModel = unknown,
  TState = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  value: LatticeLike<TModel, TState, TActions, TViews>
): Lattice<TModel, TState, TActions, TViews> {
  // Check if already branded to make it idempotent
  if (isLattice(value)) {
    return value as Lattice<TModel, TState, TActions, TViews>;
  }

  // Use the shared utility to brand the object with the lattice symbol
  // The markAsLatticeObject expects a function for other branded types,
  // but for Lattice we're applying it to an object, so we need to handle differently
  Object.defineProperty(value, LATTICE_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return value as Lattice<TModel, TState, TActions, TViews>;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('lattice identify module', () => {
    describe('isLattice', () => {
      it('should return true for valid lattice instances', () => {
        const mockLattice = {
          name: 'test-lattice',
          model: {},
          state: {},
          actions: {},
          view: {},
        };

        // Mark the object manually with the lattice brand
        const brandedLattice = markAsLatticeObject(mockLattice, LATTICE_BRAND);

        // Should identify as a lattice
        expect(isLattice(brandedLattice)).toBe(true);
      });

      it('should return false for non-lattice objects', () => {
        // Plain object (not a lattice)
        const plainObject = {
          name: 'fake-lattice',
          model: {},
          state: {},
          actions: {},
          view: {},
        };

        expect(isLattice(plainObject)).toBe(false);

        // Wrong structure
        const wrongStructure = {
          name: 'wrong-structure',
          // Missing required properties
        };

        expect(isLattice(wrongStructure)).toBe(false);

        // Wrong brand
        const wrongBrand = markAsLatticeObject(
          {
            name: 'wrong-brand',
            model: {},
            state: {},
            actions: {},
            view: {},
          },
          Symbol('wrong-brand')
        );

        expect(isLattice(wrongBrand)).toBe(false);
      });

      it('should correctly handle edge cases', () => {
        expect(isLattice(null)).toBe(false);
        expect(isLattice(undefined)).toBe(false);
        expect(isLattice(42)).toBe(false);
        expect(isLattice('string')).toBe(false);
        expect(isLattice({})).toBe(false);
        expect(isLattice([])).toBe(false);
        expect(isLattice(() => {})).toBe(false);
      });
    });

    describe('markAsLattice', () => {
      it('should correctly brand a valid lattice-like object', () => {
        const latticeLike: LatticeLike = {
          model: {} as any,
          state: {} as any,
          actions: {} as any,
          view: {} as any,
        };

        const brandedLattice = markAsLattice(latticeLike);

        // Should pass the isLattice check
        expect(isLattice(brandedLattice)).toBe(true);

        // Should have the correct brand
        expect(isLattice(brandedLattice)).toBe(true);

        // Should be the same object reference (no wrapping)
        expect(brandedLattice).toBe(latticeLike);

        // Structure should be preserved
        expect(brandedLattice.model).toEqual({});
        expect(brandedLattice.state).toEqual({});
        expect(brandedLattice.actions).toEqual({});
        expect(brandedLattice.view).toEqual({});
      });

      it('should be idempotent (calling it twice produces same result)', () => {
        const latticeLike: LatticeLike = {
          model: {} as any,
          state: {} as any,
          actions: {} as any,
          view: {} as any,
        };

        // Mark it once
        const markedOnce = markAsLattice(latticeLike);

        // Mark it again
        const markedTwice = markAsLattice(markedOnce);

        // Should be the same object
        expect(markedOnce).toBe(markedTwice);

        // Should still pass the isLattice check
        expect(isLattice(markedTwice)).toBe(true);

        // Only one brand should be applied
        expect(Object.getOwnPropertySymbols(markedTwice).length).toBe(1);
      });

      it('should preserve all properties of the original object', () => {
        const complexLattice: LatticeLike = {
          model: { count: 0, increment: () => {} } as any,
          state: { count: 0 } as any,
          actions: { increment: () => {} } as any,
          view: {
            counter: { 'data-count': 0 } as any,
            button: { onClick: () => {} } as any,
          },
        };

        const branded = markAsLattice(complexLattice);

        // All properties should be preserved
        expect(branded.model).toEqual(complexLattice.model);
        expect(branded.state).toEqual(complexLattice.state);
        expect(branded.actions).toEqual(complexLattice.actions);
        expect(branded.view).toEqual(complexLattice.view);

        // No new properties should be added (except the symbol)
        const symbols = Object.getOwnPropertySymbols(branded);
        expect(symbols.length).toBe(1);
        expect(symbols[0]).toBe(LATTICE_BRAND);
      });
    });
  });
}
