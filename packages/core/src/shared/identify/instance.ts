import {
  MODEL_INSTANCE_BRAND,
  SELECTORS_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
  COMPONENT_INSTANCE_BRAND,
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
  ComponentInstance,
} from '../types';
import { isBranded } from './marker';

/**
 * Type guard to check if a value is a model instance
 *
 * @param value The value to check
 * @returns Whether the value is a model instance
 */
export function isModelInstance<T = unknown>(
  value: unknown
): value is ModelInstance<T> {
  return isBranded(value, MODEL_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is a selectors instance
 *
 * @param value The value to check
 * @returns Whether the value is a selectors instance
 */
export function isSelectorsInstance<T = unknown>(
  value: unknown
): value is SelectorsInstance<T> {
  return isBranded(value, SELECTORS_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is an action instance
 *
 * @param value The value to check
 * @returns Whether the value is an action instance
 */
export function isActionInstance<T = unknown>(
  value: unknown
): value is ActionsInstance<T> {
  return isBranded(value, ACTIONS_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is a view instance
 *
 * @param value The value to check
 * @returns Whether the value is a view instance
 */
export function isViewInstance<T = unknown>(
  value: unknown
): value is ViewInstance<T> {
  return isBranded(value, VIEW_INSTANCE_BRAND);
}

/**
 * Type guard to check if a value is a component instance
 *
 * @param value The value to check
 * @returns Whether the value is a component instance
 */
export function isComponentInstance<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>
>(
  value: unknown
): value is ComponentInstance<TModel, TSelectors, TActions, TViews> {
  return isBranded(value, COMPONENT_INSTANCE_BRAND);
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;
  const { brandWithSymbol } = await import('./marker');

  describe('instance', () => {
    // Using separate tests with just one assertion each to isolate potential issues
    it('identifies a branded model instance as true', () => {
      const fn = function uniqueModelFn() {
        return { count: 1 };
      };
      const branded = brandWithSymbol(fn, MODEL_INSTANCE_BRAND);
      expect(isModelInstance(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for model instance', () => {
      expect(isModelInstance({})).toBe(false);
    });

    it('identifies a branded selectors instance as true', () => {
      const fn = function uniqueSelectorsFn() {
        return { value: 'test' };
      };
      const branded = brandWithSymbol(fn, SELECTORS_INSTANCE_BRAND);
      expect(isSelectorsInstance(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for selectors instance', () => {
      expect(isSelectorsInstance({})).toBe(false);
    });

    it('identifies a branded action instance as true', () => {
      const fn = function uniqueActionFn() {
        return { increment: () => {} };
      };
      const branded = brandWithSymbol(fn, ACTIONS_INSTANCE_BRAND);
      expect(isActionInstance(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for action instance', () => {
      expect(isActionInstance({})).toBe(false);
    });

    it('identifies a branded view instance as true', () => {
      const fn = function uniqueViewFn() {
        return { render: () => {} };
      };
      const branded = brandWithSymbol(fn, VIEW_INSTANCE_BRAND);
      expect(isViewInstance(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for view instance', () => {
      expect(isViewInstance({})).toBe(false);
    });
    
    it('identifies a branded component instance as true', () => {
      const fn = function uniqueComponentFn() {
        return {};
      };
      const branded = brandWithSymbol(fn, COMPONENT_INSTANCE_BRAND);
      expect(isComponentInstance(branded)).toBe(true);
    });

    it('identifies a non-branded object as false for component instance', () => {
      expect(isComponentInstance({})).toBe(false);
    });
  });
}
