// Lattice Actions Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  isLattice,
  isActionsFactory,
  ACTIONS_FACTORY_TYPE,
  ActionsDependency,
  ActionsFactory,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';

export function notImplementedExtensionPhaseActions(
  ..._args: unknown[]
): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

const _createActions: TwoPhaseFactory<
  [dependency?: ActionsDependency],
  unknown[],
  never
> = (dependency?: ActionsDependency) => {
  if (
    dependency !== undefined &&
    !isLattice(dependency) &&
    !isActionsFactory(dependency)
  ) {
    throw new Error(
      'Lattice: The first argument to createActions must be a lattice or actions factory.'
    );
  }
  function extensionPhase(..._extensionArgs: unknown[]): never {
    return notImplementedExtensionPhaseActions(..._extensionArgs);
  }
  return createTwoPhaseEnforcementProxy(extensionPhase, 'createActions');
};

Object.defineProperty(_createActions, ACTIONS_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createActions = _createActions as ActionsFactory;
