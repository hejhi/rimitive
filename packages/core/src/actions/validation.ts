import { validateInstance, finalizeInstance } from '../shared/validation';

/**
 * Validates a action instance for problems like circular references
 * that could cause runtime issues
 *
 * @param actionInstance The action instance to validate
 * @throws Error if validation fails
 */
export function validateAction(actionInstance) {
  validateInstance(actionInstance, 'action');
}

/**
 * Creates a finalized action from a action instance after validation
 *
 * @param actionInstance The action instance to finalize
 * @returns A finalized action that cannot be further composed
 */
export function finalizeAction(actionInstance) {
  return finalizeInstance(actionInstance, 'action');
}
