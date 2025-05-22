import {
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
} from '../types';
import { isBranded } from './marker';

/**
 * Type guard to check if a value is a model factory
 *
 * @param value The value to check
 * @returns Whether the value is a model factory
 */
export function isModelFactory<T = unknown>(
  value: unknown
): value is ModelFactory<T> {
  return isBranded(value, MODEL_FACTORY_BRAND);
}

/**
 * Type guard to check if a value is a selectors factory
 *
 * @param value The value to check
 * @returns Whether the value is a selectors factory
 */
export function isSelectorsFactory<T = unknown>(
  value: unknown
): value is SelectorsFactory<T> {
  return isBranded(value, SELECTORS_FACTORY_BRAND);
}

/**
 * Type guard to check if a value is an actions factory
 *
 * @param value The value to check
 * @returns Whether the value is an actions factory
 */
export function isActionsFactory<T = unknown>(
  value: unknown
): value is ActionsFactory<T> {
  return isBranded(value, ACTIONS_FACTORY_BRAND);
}

/**
 * Type guard to check if a value is a view factory
 *
 * @param value The value to check
 * @returns Whether the value is a view factory
 */
export function isViewFactory<T = unknown>(
  value: unknown
): value is ViewFactory<T> {
  return isBranded(value, VIEW_FACTORY_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { brandWithSymbol } = await import('./marker');

  describe('factory identification', () => {
    // Using separate tests with just one assertion each to isolate potential issues
    it('identifies a branded model factory as true', () => {
      const fn = function uniqueModelFn() {
        return { count: 1 };
      };
      const branded = brandWithSymbol(fn, MODEL_FACTORY_BRAND);
      expect(isModelFactory(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for model factory', () => {
      expect(isModelFactory({})).toBe(false);
    });

    it('identifies a branded selectors factory as true', () => {
      const fn = function uniqueSelectorsFn() {
        return { value: 'test' };
      };
      const branded = brandWithSymbol(fn, SELECTORS_FACTORY_BRAND);
      expect(isSelectorsFactory(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for selectors factory', () => {
      expect(isSelectorsFactory({})).toBe(false);
    });

    it('identifies a branded actions factory as true', () => {
      const fn = function uniqueActionFn() {
        return { increment: () => {} };
      };
      const branded = brandWithSymbol(fn, ACTIONS_FACTORY_BRAND);
      expect(isActionsFactory(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for actions factory', () => {
      expect(isActionsFactory({})).toBe(false);
    });

    it('identifies a branded view factory as true', () => {
      const fn = function uniqueViewFn() {
        return { render: () => {} };
      };
      const branded = brandWithSymbol(fn, VIEW_FACTORY_BRAND);
      expect(isViewFactory(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for view factory', () => {
      expect(isViewFactory({})).toBe(false);
    });
  });
}
