import type { ActionInstance } from './types';
import { validateInstance, finalizeInstance } from '../shared/validation';
import { Finalized } from '../shared';

/**
 * Validates a action instance for problems like circular references
 * that could cause runtime issues
 *
 * @param actionInstance The action instance to validate
 * @throws Error if validation fails
 */
export function validateAction<T>(actionInstance: ActionInstance<T>): void {
  validateInstance(actionInstance, 'action');
}

/**
 * Creates a finalized action from a action instance after validation
 *
 * @param actionInstance The action instance to finalize
 * @returns A finalized action that cannot be further composed
 */
export function finalizeAction<T>(
  actionInstance: ActionInstance<T>
): Finalized<T> {
  return finalizeInstance(actionInstance, 'action');
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('validateAction', () => {
    it('should detect circular references in actions', () => {
      // Create a action-like object with a circular reference
      const mockActionInstance = () => (_: any, __: any) => ({
        getCircularRef: ({ get }: { get: () => any }) => get().getCircularRef,
      });

      // Should throw when validating
      expect(() => validateAction(mockActionInstance as any)).toThrow(
        /circular reference/i
      );
    });

    it('should pass validation for valid actions', () => {
      // Create a action-like object without circular references
      const mockActionInstance = () => (_: any) => ({
        increment: () => {},
        reset: () => {},
      });

      // Should not throw
      expect(() => validateAction(mockActionInstance as any)).not.toThrow();
    });
  });

  describe('finalizeAction', () => {
    it('should prevent further composition after finalization', () => {
      // Create a mock action instance
      const mockActionInstance = () => (_: any) => ({ increment: () => {} });
      mockActionInstance.with = () => ({}) as any;
      mockActionInstance.create = () => ({}) as any;

      // Finalize the action
      const finalizedAction = finalizeAction(mockActionInstance as any);

      // Verify it's marked as finalized
      expect((finalizedAction as any).__finalized).toBe(true);

      // Attempt to compose the finalized action - this should throw an error
      expect(() => {
        (finalizedAction as any).with(() => ({ name: 'test' }));
      }).toThrow('Cannot compose a finalized action');
    });
  });
}
