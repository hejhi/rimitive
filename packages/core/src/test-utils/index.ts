/**
 * Test utilities for Lattice components.
 * 
 * Provides standardized mocking utilities, factory creators, and common patterns
 * to reduce test boilerplate and ensure consistency across the codebase.
 * 
 * @example
 * ```typescript
 * import { createMockModel, mockModels, createMockTools } from '@lattice/core/test-utils';
 * 
 * // Create custom mocks
 * const customModel = createMockModel({ count: 5 });
 * 
 * // Use common patterns
 * const counterModel = mockModels.counter();
 * 
 * // Create mock tools for factory testing
 * const tools = createMockTools({
 *   model: () => ({ count: 0 })
 * });
 * ```
 */

// Factory creators
export {
  createMockModel,
  createMockSelectors, 
  createMockActions,
  createMockView,
} from './factories';

// Tool utilities
export { createMockTools } from './tools';

// Common patterns
export { mockModels, mockSelectors, mockActions, mockImplementations } from './patterns';