import { createModel } from './create';
import { markAsLatticeModel } from './identify';
import { createComposedInstance } from '../shared/compose';

/**
 * Creates a composed model instance that combines two input models
 *
 * @param baseModel The base model to extend
 * @param extensionModel The model containing extensions
 * @returns A model instance representing the composed model
 */
export function createComposedModelInstance(baseModel, extensionModel) {
  // Cast the shared composed instance to the specific ModelInstance type
  return createComposedInstance(
    baseModel,
    extensionModel,
    createModel,
    markAsLatticeModel
  );
}
