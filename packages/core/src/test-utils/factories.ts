/**
 * Mock factory utilities for testing Lattice components.
 * 
 * Provides type-safe factory creators that properly brand mock implementations
 * for use in unit tests.
 */

import { brandWithSymbol } from '../shared/identify';
import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  MODEL_FACTORY_BRAND,
  SELECTORS_FACTORY_BRAND,
  ACTIONS_FACTORY_BRAND,
  VIEW_FACTORY_BRAND,
} from '../shared/types';

/**
 * Creates a properly branded mock model factory with type safety.
 * 
 * @param implementation - The mock model implementation
 * @returns A branded ModelFactory that can be used in tests
 * 
 * @example
 * ```typescript
 * const mockModel = createMockModel({
 *   count: 0,
 *   increment: vi.fn(),
 *   reset: vi.fn()
 * });
 * ```
 */
export function createMockModel<T>(implementation: T): ModelFactory<T> {
  return brandWithSymbol(
    () => () => implementation,
    MODEL_FACTORY_BRAND
  ) as unknown as ModelFactory<T>;
}

/**
 * Creates a properly branded mock selectors factory with type safety.
 * 
 * @param implementation - The mock selectors implementation
 * @returns A branded SelectorsFactory that can be used in tests
 * 
 * @example
 * ```typescript
 * const mockSelectors = createMockSelectors({
 *   count: 5,
 *   isPositive: true,
 *   label: 'Counter: 5'
 * });
 * ```
 */
export function createMockSelectors<T>(implementation: T): SelectorsFactory<T> {
  return brandWithSymbol(
    () => () => implementation,
    SELECTORS_FACTORY_BRAND
  ) as unknown as SelectorsFactory<T>;
}

/**
 * Creates a properly branded mock actions factory with type safety.
 * 
 * @param implementation - The mock actions implementation  
 * @returns A branded ActionsFactory that can be used in tests
 * 
 * @example
 * ```typescript
 * const mockActions = createMockActions({
 *   increment: vi.fn(),
 *   decrement: vi.fn(),
 *   reset: vi.fn()
 * });
 * ```
 */
export function createMockActions<T>(implementation: T): ActionsFactory<T> {
  return brandWithSymbol(
    () => () => implementation,
    ACTIONS_FACTORY_BRAND
  ) as unknown as ActionsFactory<T>;
}

/**
 * Creates a properly branded mock view factory with type safety.
 * 
 * @param implementation - The mock view implementation
 * @returns A branded ViewFactory that can be used in tests
 * 
 * @example
 * ```typescript
 * const mockView = createMockView({
 *   'data-count': '5',
 *   'aria-label': 'Counter',
 *   onClick: vi.fn()
 * });
 * ```
 */
export function createMockView<T>(implementation: T): ViewFactory<T> {
  return brandWithSymbol(
    () => () => implementation,
    VIEW_FACTORY_BRAND
  ) as unknown as ViewFactory<T>;
}