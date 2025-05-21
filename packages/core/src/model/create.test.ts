/**
 * Test to validate model composition as specified in docs/spec.md lines 114-121
 * and to verify the updated terminology and branding works correctly
 */

import { describe, it, expect, vi } from 'vitest';
import { createModel } from './create';
import { isModelFactory } from '../shared/identify';
import { MODEL_FACTORY_BRAND, MODEL_TOOLS_BRAND } from '../shared/types';
import { createMockTools } from '../test-utils';

type CounterState = {
  count: number;
  increment: () => void;
  decrement: () => void;
};

describe('Model Composition', () => {
  // Test the updated terminology and brand symbols
  it('should properly brand model factories with MODEL_FACTORY_BRAND', () => {
    const counterModel = createModel<CounterState>(({ set }) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
    }));

    // Verify the model is branded as a factory
    expect(isModelFactory(counterModel)).toBe(true);

    // Verify the model function has the correct symbol
    expect(Reflect.has(counterModel, MODEL_FACTORY_BRAND)).toBe(true);
    expect(Reflect.get(counterModel, MODEL_FACTORY_BRAND)).toBe(true);

    // Tools provided to the slice factory should be branded with MODEL_TOOLS_BRAND
    const factorySpy = vi.fn(() => ({ count: 0 }));
    const spyModel = createModel(factorySpy);

    // Use standardized mock tools
    const mockTools = createMockTools({
      get: () => ({ count: 0 }),
      set: vi.fn(),
    });
    spyModel()(mockTools);

    // Verify the spy was called
    expect(factorySpy).toHaveBeenCalled();

    // Check that the factory was called with a tools object
    expect(factorySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        // This is a better approach than accessing mock.calls directly
        [MODEL_TOOLS_BRAND]: true,
      })
    );
  });
});
