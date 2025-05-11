/**
 * Validates an instance for problems like circular references
 * that could cause runtime issues
 *
 * @param instance The instance to validate
 * @param entityName The name of the entity (model, state, etc.) for error messages
 * @throws Error if validation fails
 */
export function validateInstance(instance, entityName) {
  // Create a mock get function for validation
  const visited = new Set();

  /**
   * Recursively detects circular references in object properties
   *
   * @param obj The object to check for circular references
   * @param path The path to the current property for error reporting
   */
  const detectCircular = (obj, path = []) => {
    if (obj && typeof obj === 'object') {
      // Check each property/method
      Object.entries(obj).forEach(([key, value]) => {
        // If this is a function, we need to check for circular references
        if (typeof value === 'function') {
          if (visited.has(value)) {
            throw new Error(
              `Circular reference detected in ${entityName} at ${path.join('.')}.${key}`
            );
          }

          visited.add(value);

          // Create a validation get function that detects circular references
          const validationGet = () => {
            // If we try to access the same function, it's circular
            if (value === obj[key]) {
              throw new Error(
                `Circular reference detected in ${entityName} at ${path.join('.')}.${key}`
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

  // Get the instance's factory function
  const sliceCreator = instance();

  // Create validation set/get functions for instance initialization
  const validationSet = () => {};
  const validationGet = () => ({});

  // Get the instance state by calling the factory with Factory interface
  const instanceState = sliceCreator({
    get: validationGet,
    set: validationSet,
  });

  // Detect circular references in the instance state
  detectCircular(instanceState);
}

/**
 * Creates a finalized instance from an instance after validation
 *
 * @param instance The instance to validate
 * @param entityName The name of the entity (model, state, etc.) for error messages
 * @returns A finalized instance that cannot be further composed
 */
export function finalizeInstance(instance, entityName) {
  // Validate the instance before finalizing
  validateInstance(instance, entityName);

  // Create the finalized instance
  const finalizedInstance = function finalizedInstance() {
    return instance();
  };

  // Mark as finalized
  Object.defineProperty(finalizedInstance, '__finalized', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  // Add a .with() method that throws when called to provide a clear error message
  // This ensures runtime safety in addition to compile-time safety
  finalizedInstance.with = function withAfterFinalization() {
    throw new Error(`Cannot compose a finalized ${entityName}`);
  };

  return finalizedInstance;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('validateInstance', () => {
    it('should detect circular references in instances', () => {
      // Create an instance-like object with a circular reference
      const mockInstance = () => () => ({
        getCircularRef: ({ get }) => get().getCircularRef,
      });

      // Should throw when validating
      expect(() => validateInstance(mockInstance, 'test')).toThrow(
        /circular reference/i
      );
    });

    it('should pass validation for valid instances', () => {
      // Create an instance-like object without circular references
      const mockInstance = () => () => ({
        count: 42,
        getValue: () => 42,
      });

      // Should not throw
      expect(() => validateInstance(mockInstance, 'test')).not.toThrow();
    });
  });

  describe('finalizeInstance', () => {
    it('should prevent further composition after finalization', () => {
      // Create a mock instance
      const mockInstance = () => () => ({ count: 42 });
      mockInstance.with = () => ({});
      mockInstance.create = () => ({});

      // Finalize the instance
      const finalizedInstance = finalizeInstance(mockInstance, 'test');

      // Verify it's marked as finalized
      expect(finalizedInstance['__finalized']).toBe(true);

      // Attempt to compose the finalized instance - this should throw an error
      expect(() => {
        finalizedInstance.with();
      }).toThrow('Cannot compose a finalized test');
    });
  });
}
