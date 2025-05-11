import { validateInstance, finalizeInstance } from '../shared/validation';

/**
 * Validates a state instance for problems like circular references
 * that could cause runtime issues
 *
 * @param stateInstance The state instance to validate
 * @throws Error if validation fails
 */
export function validateState(stateInstance) {
  validateInstance(stateInstance, 'state');
}

/**
 * Creates a finalized state from a state instance after validation
 *
 * @param stateInstance The state instance to finalize
 * @returns A finalized state that cannot be further composed
 */
export function finalizeState(stateInstance) {
  return finalizeInstance(stateInstance, 'state');
}
