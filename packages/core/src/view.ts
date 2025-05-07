// Lattice View Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  isLattice,
  isViewFactory,
  VIEW_FACTORY_TYPE,
  ViewDependency,
  ViewFactory,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';

export function notImplementedExtensionPhaseView(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

const _createView: TwoPhaseFactory<
  [dependency?: ViewDependency],
  unknown[],
  never
> = (dependency?: ViewDependency) => {
  if (
    dependency !== undefined &&
    !isLattice(dependency) &&
    !isViewFactory(dependency)
  ) {
    throw new Error(
      'Lattice: The first argument to createView must be a lattice or view factory.'
    );
  }
  function extensionPhase(..._extensionArgs: unknown[]): never {
    return notImplementedExtensionPhaseView(..._extensionArgs);
  }
  return createTwoPhaseEnforcementProxy(extensionPhase, 'createView');
};

Object.defineProperty(_createView, VIEW_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createView = _createView as ViewFactory;
