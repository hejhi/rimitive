// Lattice View Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  ViewDependency,
  ViewFactory,
  ViewExtensionHelpers,
  ViewCompositionHelpers,
  ViewContract,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';
import {
  validateDependency,
  brandContract,
  extractContract,
  FactoryType,
} from './utils';
import { VIEW_FACTORY_TYPE } from './constants';

export function notImplementedExtensionPhaseView(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

// The actual factory function, branded as a ViewFactory
const _createView: TwoPhaseFactory<
  [
    dependency?: ViewDependency,
    callback?: (arg: ViewCompositionHelpers) => Record<string, unknown>,
  ],
  [ViewExtensionHelpers],
  ViewContract
> = (
  dependency?: ViewDependency,
  callback?: (arg: ViewCompositionHelpers) => Record<string, unknown>
) => {
  // Runtime contract enforcement for dependency
  validateDependency(dependency);

  // Extension phase implementation
  function extensionPhase(_helpers: ViewExtensionHelpers): ViewContract {
    let contract: Record<string, unknown> = {};

    if (callback && dependency) {
      // Extract the dependency contract using our utility
      const viewArg = extractContract(dependency, FactoryType.VIEW);

      // Pass the extracted contract to the callback for composition
      contract = callback({
        view: viewArg,
        select: <T>(obj: Record<string, unknown>, key: string): T =>
          obj && typeof obj === 'object' ? (obj[key] as T) : (undefined as T),
      });
    } else if (dependency) {
      // No composition callback, just pass the dependency contract through
      contract = extractContract(dependency, FactoryType.VIEW);
    }

    // Extension phase typically adds new view properties using derive/dispatch
    // For now, we just return the composed contract

    return brandContract(contract) as ViewContract;
  }

  return createTwoPhaseEnforcementProxy(extensionPhase, 'createView');
};

// Attach the view factory type tag for runtime detection (brand the factory, not the proxy)
Object.defineProperty(_createView, VIEW_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createView = _createView as ViewFactory;
