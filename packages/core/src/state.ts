// Lattice State Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  isLattice,
  isStateFactory,
  STATE_FACTORY_TYPE,
  StateDependency,
  StateFactory,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';

export function notImplementedExtensionPhaseState(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

const _createState: TwoPhaseFactory<
  [dependency?: StateDependency],
  unknown[],
  never
> = (dependency?: StateDependency) => {
  if (
    dependency !== undefined &&
    !isLattice(dependency) &&
    !isStateFactory(dependency)
  ) {
    throw new Error(
      'Lattice: The first argument to createState must be a lattice or state factory.'
    );
  }
  function extensionPhase(..._extensionArgs: unknown[]): never {
    return notImplementedExtensionPhaseState(..._extensionArgs);
  }
  return createTwoPhaseEnforcementProxy(extensionPhase, 'createState');
};

Object.defineProperty(_createState, STATE_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createState = _createState as StateFactory;
