// Lattice Model Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  isModelFactory,
  isLattice,
  MODEL_FACTORY_TYPE,
  ModelDependency,
  ModelFactory,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';

export function notImplementedExtensionPhase(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

// The actual factory function, branded as a ModelFactory
const _createModel: TwoPhaseFactory<
  [dependency?: ModelDependency],
  unknown[],
  never
> = (dependency?: ModelDependency) => {
  // Runtime contract enforcement for dependency
  if (
    dependency !== undefined &&
    !isLattice(dependency) &&
    !isModelFactory(dependency)
  ) {
    throw new Error(
      'Lattice: The first argument to createModel must be a lattice or model factory.'
    );
  }
  function extensionPhase(..._extensionArgs: unknown[]): never {
    return notImplementedExtensionPhase(..._extensionArgs);
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
