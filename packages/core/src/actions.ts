// Lattice Actions Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  ActionsDependency,
  ActionsFactory,
  ActionsExtensionHelpers,
  ActionsCompositionHelpers,
  ActionsContract,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';
import {
  validateDependency,
  brandContract,
  extractContract,
  FactoryType,
} from './utils';
import { ACTIONS_FACTORY_TYPE } from './constants';

export function notImplementedExtensionPhase(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

// The actual factory function, branded as an ActionsFactory
const _createActions: TwoPhaseFactory<
  [
    dependency?: ActionsDependency,
    callback?: (
      arg: ActionsCompositionHelpers
    ) => Record<string, (...args: unknown[]) => unknown>,
  ],
  [ActionsExtensionHelpers],
  ActionsContract
> = (
  dependency?: ActionsDependency,
  callback?: (
    arg: ActionsCompositionHelpers
  ) => Record<string, (...args: unknown[]) => unknown>
) => {
  // Runtime contract enforcement for dependency
  validateDependency(dependency);

  // Extension phase implementation
  function extensionPhase(_helpers: ActionsExtensionHelpers): ActionsContract {
    let contract: Record<string, (...args: unknown[]) => unknown> = {};

    if (callback && dependency) {
      // Extract the dependency contract using our utility
      const actionsArg = extractContract(dependency, FactoryType.ACTIONS);

      // Pass the extracted contract to the callback for composition
      contract = callback({
        actions: actionsArg,
        select: <T>(obj: Record<string, unknown>, key: string): T =>
          obj && typeof obj === 'object' ? (obj[key] as T) : (undefined as T),
      });
    } else if (dependency) {
      // No composition callback, just pass the dependency contract through
      contract = extractContract(dependency, FactoryType.ACTIONS);
    }

    // Extension phase - ensure we enhance with what's available from extension phase
    // Note: Actions typically don't extend via get() since they're just function references

    return brandContract(contract) as ActionsContract;
  }

  return createTwoPhaseEnforcementProxy(extensionPhase, 'createActions');
};

// Attach the actions factory type tag for runtime detection (brand the factory, not the proxy)
Object.defineProperty(_createActions, ACTIONS_FACTORY_TYPE, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false,
});

export const createActions = _createActions as ActionsFactory;
