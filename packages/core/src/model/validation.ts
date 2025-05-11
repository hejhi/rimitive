import type { ModelInstance } from '../shared/types';
import { validateInstance, finalizeInstance } from '../shared/validation';
import { Finalized } from '../shared';

/**
 * Validates a model instance for problems like circular references
 * that could cause runtime issues
 *
 * @param modelInstance The model instance to validate
 * @throws Error if validation fails
 */
export function validateModel<T>(modelInstance: ModelInstance<T>): void {
  validateInstance(modelInstance, 'model');
}

/**
 * Creates a finalized model from a model instance after validation
 *
 * @param modelInstance The model instance to finalize
 * @returns A finalized model that cannot be further composed
 */
export function finalizeModel<T>(
  modelInstance: ModelInstance<T>
): Finalized<T> {
  return finalizeInstance(modelInstance, 'model');
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('validateModel', () => {
    it('should detect circular references in models', () => {
      // Create a model-like object with a circular reference
      const mockModelInstance = () => (_: any, __: any) => ({
        getCircularRef: ({ get }: { get: () => any }) => get().getCircularRef,
      });

      // Should throw when validating
      expect(() => validateModel(mockModelInstance as any)).toThrow(
        /circular reference/i
      );
    });

    it('should pass validation for valid models', () => {
      // Create a model-like object without circular references
      const mockModelInstance = () => (_: any, __: any) => ({
        count: 42,
        getValue: () => 42,
      });

      // Should not throw
      expect(() => validateModel(mockModelInstance as any)).not.toThrow();
    });
  });

  describe('finalizeModel', () => {
    it('should prevent further composition after finalization', () => {
      // Create a mock model instance
      const mockModelInstance = () => (_: any, __: any) => ({ count: 42 });
      mockModelInstance.with = () => ({}) as any;
      mockModelInstance.create = () => ({}) as any;

      // Finalize the model
      const finalizedModel = finalizeModel(mockModelInstance as any);

      // Verify it's marked as finalized
      expect((finalizedModel as any).__finalized).toBe(true);

      // Attempt to compose the finalized model - this should throw an error
      expect(() => {
        (finalizedModel as any).with(() => ({ name: 'test' }));
      }).toThrow('Cannot compose a finalized model');
    });
  });
}
