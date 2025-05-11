import { createState, stateMarker } from './create';
import { createComposedInstance } from '../shared/compose';

/**
 * Creates a composed state instance that combines two input states
 *
 * @param baseState The base state to extend
 * @param extensionState The state containing extensions
 * @returns A state instance representing the composed state
 */
export function createComposedStateInstance(baseState, extensionState) {
  // Cast the shared composed instance to the specific StateInstance type
  return createComposedInstance(
    baseState,
    extensionState,
    createState,
    stateMarker
  );
}
