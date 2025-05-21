/**
 * Mock tools utilities for testing factory functions.
 * 
 * Provides utilities for creating mock dependency injection tools
 * used by factory functions in tests.
 */

import { vi } from 'vitest';

/**
 * Creates mock tools for testing factory functions that expect model/selectors/actions.
 * 
 * @param deps - Object containing the dependencies to mock
 * @returns Mock tools object with the provided dependencies
 * 
 * @example
 * ```typescript
 * const tools = createMockTools({
 *   model: () => ({ count: 0 }),
 *   selectors: () => ({ count: 0, isZero: true }),
 *   actions: () => ({ increment: vi.fn() })
 * });
 * 
 * // Use in factory tests
 * const actionCreator = actionsFactory();
 * actionCreator(tools);
 * ```
 */
export function createMockTools<T extends Record<string, any>>(deps: T): T {
  const tools: Record<string, any> = {};
  
  Object.entries(deps).forEach(([key, value]) => {
    if (typeof value === 'function') {
      tools[key] = vi.fn(value);
    } else {
      tools[key] = vi.fn(() => value);
    }
  });
  
  return tools as T;
}