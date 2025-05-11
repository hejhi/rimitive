import { validateInstance, finalizeInstance } from '../shared/validation';

/**
 * Validates a model instance for problems like circular references
 * that could cause runtime issues
 *
 * @param modelInstance The model instance to validate
 * @throws Error if validation fails
 */
export function validateModel(modelInstance) {
  validateInstance(modelInstance, 'model');
}

/**
 * Creates a finalized model from a model instance after validation
 *
 * @param modelInstance The model instance to finalize
 * @returns A finalized model that cannot be further composed
 */
export function finalizeModel(modelInstance) {
  return finalizeInstance(modelInstance, 'model');
}
