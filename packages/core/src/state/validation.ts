import type { StateInstance } from './types';

/**
 * Validates a state instance for problems like circular references
 * that could cause runtime issues
 *
 * @param stateInstance The state instance to validate
 * @throws Error if validation fails
 */
export function validateState<T>(stateInstance: StateInstance<T>): void {
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
              `Circular reference detected in state at ${path.join('.')}.${key}`
            );
          }

          visited.add(value);

          // Create a validation get function that detects circular references
          const validationGet = () => {
            // If we try to access the same function, it's circular
            if (value === obj[key]) {
              throw new Error(
                `Circular reference detected in state at ${path.join('.')}.${key}`
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

  // Get the state's factory function
  const sliceCreator = stateInstance();

  // Create validation set/get functions for state initialization
  const validationSet = () => {};
  const validationGet = () => ({});

  // Get the state state by calling the factory
  const stateState = sliceCreator(validationSet as any, validationGet as any);

  // Detect circular references in the state state
  detectCircular(stateState);
}

/**
 * Creates a finalized state from a state instance after validation
 *
 * @param stateInstance The state instance to finalize
 * @returns A finalized state that cannot be further composed
 */
export function finalizeState<T>(stateInstance: StateInstance<T>) {
  // Validate the state before finalizing
  validateState(stateInstance);

  // Create the finalized state
  const finalizedState = function finalizedState() {
    return stateInstance();
  };

  // Mark as finalized
  Object.defineProperty(finalizedState, '__finalized', {
    value: true,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  // Add a .with() method that throws when called to provide a clear error message
  // This ensures runtime safety in addition to compile-time safety
  (finalizedState as any).with = function withAfterFinalization() {
    throw new Error('Cannot compose a finalized state');
  };

  return finalizedState;
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('validateState', () => {
    it('should detect circular references in states', () => {
      // Create a state-like object with a circular reference
      const mockStateInstance = () => (_: any, __: any) => ({
        getCircularRef: ({ get }: { get: () => any }) => get().getCircularRef,
      });

      // Should throw when validating
      expect(() => validateState(mockStateInstance as any)).toThrow(
        /circular reference/i
      );
    });

    it('should pass validation for valid states', () => {
      // Create a state-like object without circular references
      const mockStateInstance = () => (_: any, __: any) => ({
        count: 42,
        getValue: () => 42,
      });

      // Should not throw
      expect(() => validateState(mockStateInstance as any)).not.toThrow();
    });
  });

  describe('finalizeState', () => {
    it('should prevent further composition after finalization', () => {
      // Create a mock state instance
      const mockStateInstance = () => (_: any, __: any) => ({ count: 42 });
      mockStateInstance.with = () => ({}) as any;
      mockStateInstance.create = () => ({}) as any;

      // Finalize the state
      const finalizedState = finalizeState(mockStateInstance as any);

      // Verify it's marked as finalized
      expect((finalizedState as any).__finalized).toBe(true);

      // Attempt to compose the finalized state - this should throw an error
      expect(() => {
        (finalizedState as any).with(() => ({ name: 'test' }));
      }).toThrow('Cannot compose a finalized state');
    });
  });
}
