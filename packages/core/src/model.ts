// Lattice Model Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  ModelDependency,
  ModelFactory,
  TwoPhaseFactory,
  ModelExtensionHelpers,
  ModelCompositionHelpers,
  ModelContract,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';
import {
  validateDependency,
  brandContract,
  extractContract,
  FactoryType,
} from './utils';
import { MODEL_FACTORY_TYPE } from './constants';

export function notImplementedExtensionPhase(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

// The actual factory function, branded as a ModelFactory
const _createModel: TwoPhaseFactory<
  [
    dependency?: ModelDependency,
    callback?: (arg: ModelCompositionHelpers) => Record<string, unknown>,
  ],
  [ModelExtensionHelpers],
  ModelContract
> = (
  dependency?: ModelDependency,
  callback?: (arg: ModelCompositionHelpers) => Record<string, unknown>
) => {
  // Runtime contract enforcement for dependency
  validateDependency(dependency);

  // Extension phase implementation
  function extensionPhase({ get }: ModelExtensionHelpers): ModelContract {
    let contract: Record<string, unknown> = {};

    if (callback && dependency) {
      // Extract the dependency contract using our utility
      const modelArg = dependency
        ? extractContract(dependency, FactoryType.MODEL)
        : {};

      // Pass the extracted contract to the callback for composition
      contract = callback({
        model: modelArg,
        select: <T>(obj: Record<string, unknown>, key: string): T =>
          obj && typeof obj === 'object' ? (obj[key] as T) : (undefined as T),
      });
    } else if (dependency) {
      // No composition callback, just pass the dependency contract through
      contract = extractContract(dependency, FactoryType.MODEL);
    }

    // Extension phase - ensure we enhance with what the extension phase returns
    const extensionContract = typeof get === 'function' ? get() : {};

    return brandContract({
      ...contract,
      ...extensionContract,
    }) as ModelContract;
  }

  return createTwoPhaseEnforcementProxy(extensionPhase, 'createModel');
};

// Attach the model factory type tag for runtime detection (brand the factory, not the proxy)
Object.defineProperty(_createModel, MODEL_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createModel = _createModel as ModelFactory;
