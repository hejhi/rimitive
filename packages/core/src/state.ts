// Lattice State Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  StateDependency,
  StateFactory,
  StateExtensionHelpers,
  StateCompositionHelpers,
  StateContract,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';
import {
  validateDependency,
  brandContract,
  extractContract,
  FactoryType,
} from './utils';
import { STATE_FACTORY_TYPE } from './constants';

/**
 * Creates a state factory with proper two-phase pattern and contract handling.
 * Supports composition with existing state contracts or lattices.
 */
const _createState: TwoPhaseFactory<
  [
    dependency?: StateDependency,
    callback?: (arg: StateCompositionHelpers) => Record<string, unknown>,
  ],
  [StateExtensionHelpers],
  StateContract
> = (
  dependency?: StateDependency,
  callback?: (arg: StateCompositionHelpers) => Record<string, unknown>
) => {
  // Runtime contract enforcement for dependency
  validateDependency(dependency);

  // Extension phase implementation
  function extensionPhase(helpers: StateExtensionHelpers): StateContract {
    const { get } = helpers;
    // Destructure derive but don't use it to suppress warnings

    let contract: Record<string, unknown> = {};

    if (callback && dependency) {
      // Extract the dependency contract using our utility
      const stateArg = extractContract(dependency, FactoryType.STATE);

      // Pass the extracted contract to the callback for composition
      contract = callback({
        state: stateArg,
        select: <T>(obj: Record<string, unknown>, key: string): T =>
          obj && typeof obj === 'object' ? (obj[key] as T) : (undefined as T),
      });
    } else if (dependency) {
      // No composition callback, just pass the dependency contract through
      contract = extractContract(dependency, FactoryType.STATE);
    }

    // Extension phase - ensure we enhance with what the extension phase returns
    const extensionContract = typeof get === 'function' ? get() : {};

    // Combine with extension phase results and brand
    return brandContract({
      ...contract,
      ...extensionContract,
    }) as StateContract;
  }

  return createTwoPhaseEnforcementProxy(extensionPhase, 'createState');
};

// Attach the state factory type tag for runtime detection (brand the factory, not the proxy)
Object.defineProperty(_createState, STATE_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createState = _createState as StateFactory;
