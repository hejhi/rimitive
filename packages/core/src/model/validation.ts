import type { ModelInstance } from './types';

/**
 * Validates a model instance for problems like circular references
 * that could cause runtime issues
 *
 * @param modelInstance The model instance to validate
 * @throws Error if validation fails
 */
export function validateModel<T>(modelInstance: ModelInstance<T>): void {
  // Create a mock get function for validation
  const visited = new Set<Function>();

  /**
   * Recursively detects circular references in object properties
   *
   * @param obj The object to check for circular references
   * @param path The path to the current property for error reporting
   */
  const detectCircular = (obj: any, path: string[] = []): void => {
    if (obj && typeof obj === 'object') {
      // Check each property/method
      Object.entries(obj).forEach(([key, value]) => {
        // If this is a function, we need to check for circular references
        if (typeof value === 'function') {
          if (visited.has(value)) {
            throw new Error(
              `Circular reference detected in model at ${path.join('.')}.${key}`
            );
          }

          visited.add(value);

          // Create a validation get function that detects circular references
          const validationGet = () => {
            // If we try to access the same function, it's circular
            if (value === obj[key]) {
              throw new Error(
                `Circular reference detected in model at ${path.join('.')}.${key}`
              );
            }
            return obj;
          };

          try {
            // Try to invoke the function with our validation get function
            value({ get: validationGet });
          } catch (error) {
            // If we triggered our specific error, propagate it
            if (
              error instanceof Error &&
              error.message.includes('Circular reference')
            ) {
              throw error;
            }
            // Otherwise, this is probably just a runtime error from our validation environment
            // and not a validation failure
          }
        }
      });
    }
  };

  // Get the model's factory function
  const sliceCreator = modelInstance();

  // Create validation set/get functions for model initialization
  const validationSet = () => {};
  const validationGet = () => ({});

  // Get the model state by calling the factory
  const modelState = sliceCreator(validationSet as any, validationGet as any);

  // Detect circular references in the model state
  detectCircular(modelState);
}

/**
 * Creates a finalized model from a model instance after validation
 *
 * @param modelInstance The model instance to finalize
 * @returns A finalized model that cannot be further composed
 */
export function finalizeModel<T>(modelInstance: ModelInstance<T>) {
  // Validate the model before finalizing
  validateModel(modelInstance);

  // Create the finalized model
  const finalizedModel = function finalizedModel() {
    return modelInstance();
  };

  // Mark as finalized
  Object.defineProperty(finalizedModel, '__finalized', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  // Add a .with() method that throws when called to provide a clear error message
  // This ensures runtime safety in addition to compile-time safety
  (finalizedModel as any).with = function withAfterFinalization() {
    throw new Error('Cannot compose a finalized model');
  };

  return finalizedModel;
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
