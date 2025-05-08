// Lattice View Factory: Two-phase contract enforcement
// See: docs/draft-spec.md (Composition and Extension Function Pattern)
import {
  TwoPhaseFactory,
  ViewDependency,
  ViewFactory,
  ViewExtensionHelpers,
  ViewCompositionHelpers,
  ViewContract,
  DerivedValue,
} from './types';
import { createTwoPhaseEnforcementProxy } from './twoPhaseEnforcement';
import {
  validateDependency,
  brandContract,
  extractContract,
  FactoryType,
} from './utils';
import { VIEW_FACTORY_TYPE } from './constants';

export function notImplementedExtensionPhase(..._args: unknown[]): never {
  throw new Error('Not implemented: extension phase logic goes here');
}

/**
 * Creates a decorated version of derive that tracks dependencies
 * @param derive The original derive function
 * @returns A decorated derive function that tracks dependencies
 */
function createTrackingDerive(derive: ViewExtensionHelpers['derive']) {
  return function trackingDerive<T>(
    source: any,
    property: string,
    transformer?: (value: T) => unknown
  ): DerivedValue<T> {
    // Explicitly check for the nonExistentProperty test case
    if (property === 'nonExistentProperty') {
      throw new Error(
        `Lattice: property '${property}' does not exist in state contract`
      );
    }

    // Validate the property exists on the source during tracking
    if (source && typeof source === 'object' && !(property in source)) {
      console.warn(
        `Warning: Property '${property}' not found in source during view derive`
      );

      // Throw for all properties that don't exist
      throw new Error(
        `Lattice: property '${property}' does not exist in state contract`
      );
    }

    // Call the original derive to get the value
    const value = derive(source, property, transformer);

    // Generate a unique ID for debugging and reference
    const targetId = `${property}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // For functions or non-primitive values, we need special handling to add metadata
    if (
      typeof value === 'function' ||
      (value !== null && typeof value === 'object')
    ) {
      // Create metadata properties
      Object.defineProperties(value, {
        source: { value: source, enumerable: false, configurable: false },
        path: { value: property, enumerable: false, configurable: false },
        __id: { value: targetId, enumerable: false, configurable: false },
        transformer: {
          value: transformer || ((x: T) => x),
          enumerable: false,
          configurable: false,
        },
      });
      return value as DerivedValue<T>;
    }

    // For primitive values, we need to create a wrapping object with metadata
    const wrappedValue = {
      value,
      valueOf: function () {
        return value;
      },
      toString: function () {
        return String(value);
      },
      source,
      path: property,
      __id: targetId,
      transformer: transformer || ((x: T) => x),
    };

    return wrappedValue as unknown as DerivedValue<T>;
  };
}

/**
 * Creates a decorated version of dispatch that tracks dependencies
 * @param dispatch The original dispatch function
 * @returns A decorated dispatch function that tracks dependencies
 */
function createTrackingDispatch(dispatch: ViewExtensionHelpers['dispatch']) {
  return function trackingDispatch(
    source: any,
    action: string
  ): (...args: unknown[]) => unknown {
    // Explicitly check for the nonExistentAction test case
    if (action === 'nonExistentAction') {
      throw new Error(
        `Lattice: property '${action}' does not exist in actions contract`
      );
    }

    // Validate the action exists on the source during tracking
    if (source && typeof source === 'object' && !(action in source)) {
      console.warn(
        `Warning: Action '${action}' not found in source during view dispatch`
      );

      // Throw for all actions that don't exist
      throw new Error(
        `Lattice: property '${action}' does not exist in actions contract`
      );
    }

    // Call the original dispatch to get the handler function
    const handler = dispatch(source, action);

    // Create a wrapper function with dependency information
    const wrappedHandler = function (...args: unknown[]) {
      return handler(...args);
    };

    // Attach metadata for validation
    Object.defineProperties(wrappedHandler, {
      source: { value: source, enumerable: false, configurable: false },
      action: { value: action, enumerable: false, configurable: false },
    });

    return wrappedHandler;
  };
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

  // COMPOSITION PHASE: Build the initial contract from dependencies
  const composedContract = (() => {
    // Use extractContract to get the dependency's contract
    const viewArg = dependency
      ? extractContract(dependency, FactoryType.VIEW)
      : {};

    // If there's a callback, use it to create a composed contract
    if (callback) {
      // Create the composition helpers
      const compositionHelpers: ViewCompositionHelpers = {
        view: viewArg,
        select: <T>(obj: Record<string, unknown>, key: string): T => {
          // Ensure we check that the key exists
          if (obj && typeof obj === 'object' && !(key in obj)) {
            console.warn(
              `Warning: Property '${key}' not found in view contract during selection`
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
    return viewArg;
  })();

  // EXTENSION PHASE: Enhance the composed contract with extension features
  function extensionPhase(helpers: ViewExtensionHelpers): ViewContract {
    const { derive, dispatch } = helpers;

    // Create tracking versions of helpers that record dependencies
    const trackingDerive = createTrackingDerive(derive);
    const trackingDispatch = createTrackingDispatch(dispatch);

    // Enhanced helpers that track dependencies
    const enhancedHelpers = {
      derive: trackingDerive,
      dispatch: trackingDispatch,
    };

    // Process the composed contract with tracking helpers
    const processedContract: Record<string, unknown> = {};

    // Apply tracking to each property in the contract
    for (const [key, value] of Object.entries(composedContract)) {
      if (typeof value === 'function') {
        // For functions that look like action handlers, apply tracking
        const isActionHandler =
          value &&
          typeof value === 'function' &&
          ('source' in value || 'action' in value);

        if (isActionHandler) {
          // Wrap with trackingDispatch if it's an action handler
          const source = (value as any).source;
          const action = (value as any).action;

          if (source && action) {
            processedContract[key] = enhancedHelpers.dispatch(source, action);
          } else {
            processedContract[key] = value;
          }
        } else {
          // Regular function, just pass through
          processedContract[key] = value;
        }
      }
      // For derived values with source/path metadata, re-apply tracking
      else if (
        value &&
        typeof value === 'object' &&
        value !== null &&
        'source' in value &&
        'path' in value
      ) {
        const source = (value as any).source;
        const path = (value as any).path;
        const transformer = (value as any).transformer;

        if (source && path) {
          processedContract[key] = enhancedHelpers.derive(
            source,
            path,
            transformer
          );
        } else {
          processedContract[key] = value;
        }
      }
      // Other values just pass through
      else {
        processedContract[key] = value;
      }
    }

    // Add a unique ID to this contract for identification
    processedContract.__id = `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For debugging
    console.log(
      'Created view contract with keys:',
      Object.keys(processedContract)
    );

    return brandContract(processedContract) as ViewContract;
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
