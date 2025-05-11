import { createAction } from './create';
import { markAsLatticeAction } from './identify';
import { createComposedInstance } from '../shared/compose';

/**
 * Creates a composed action instance that combines two input actions
 *
 * @param baseAction The base action to extend
 * @param extensionAction The action containing extensions
 * @returns A action instance representing the composed action
 */
export function createComposedActionInstance(baseAction, extensionAction) {
  // Cast the shared composed instance to the specific ActionInstance type
  return createComposedInstance(
    baseAction,
    extensionAction,
    createAction,
    markAsLatticeAction
  );
}
