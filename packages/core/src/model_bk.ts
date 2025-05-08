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

  // COMPOSITION PHASE: Build the initial contract from dependencies
  const composedContract = (() => {
    // Use extractContract to get the dependency's contract
    const modelArg = dependency
      ? extractContract(dependency, FactoryType.MODEL)
      : {};

    // If there's a callback, use it to create a composed contract
    if (callback) {
      // Create the composition helpers
      const compositionHelpers: ModelCompositionHelpers = {
        model: modelArg,
        select: <T>(obj: Record<string, unknown>, key: string): T => {
          // Ensure we check that the key exists
          if (obj && typeof obj === 'object' && !(key in obj)) {
            console.warn(
              `Warning: Property '${key}' not found in model contract during selection`
            );
          }
          return obj && typeof obj === 'object'
            ? (obj[key] as T)
            : (undefined as T);
        },
      };

      // Call the callback with composition helpers to get the composed contract
      return callback(compositionHelpers);
    }

    // No composition callback, just pass the dependency contract through
    return modelArg;
  })();

  // EXTENSION PHASE: Enhance the composed contract with extension features
  function extensionPhase({ get }: ModelExtensionHelpers): ModelContract {
    // Extension phase - ensure we enhance with what the extension phase returns
    // We need to actually call get() to get the model's state
    const extensionContract = typeof get === 'function' ? get() : {};

    // Create the final contract with composition + extension
    const finalContract = {
      ...composedContract,
      ...extensionContract,
    };

    // For debugging
    console.log(
      'Created model contract with keys:',
      Object.keys(finalContract)
    );

    // Brand and return the final contract
    return brandContract(finalContract) as ModelContract;
  }

  // Create and return the two-phase enforcement proxy
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
