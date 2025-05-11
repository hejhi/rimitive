import type { StateInstance } from '../shared/types';
import { validateInstance, finalizeInstance } from '../shared/validation';
import { Finalized } from '../shared';

/**
 * Validates a state instance for problems like circular references
 * that could cause runtime issues
 *
 * @param stateInstance The state instance to validate
 * @throws Error if validation fails
 */
export function validateState<T>(stateInstance: StateInstance<T>): void {
  validateInstance(stateInstance, 'state');
}

/**
 * Creates a finalized state from a state instance after validation
 *
 * @param stateInstance The state instance to finalize
 * @returns A finalized state that cannot be further composed
 */
export function finalizeState<T>(
  stateInstance: StateInstance<T>
): Finalized<T> {
  return finalizeInstance(stateInstance, 'state');
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
