import {
  ACTIONS_FACTORY_TYPE,
  LATTICE_TYPE,
  MODEL_FACTORY_TYPE,
  STATE_FACTORY_TYPE,
  VIEW_FACTORY_TYPE,
} from './constants';
import {
  ActionsFactory,
  Lattice,
  ModelFactory,
  StateFactory,
  ViewFactory,
} from './types';

export const CONTRACT_BRAND = Symbol.for('lattice.contract');

export enum FactoryType {
  MODEL = 'model',
  STATE = 'state',
  ACTIONS = 'actions',
  VIEW = 'view',
}

export function brandContract<T extends object>(obj: T): T {
  if (!obj) return obj;

  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Lattice: contract instance must be an object.');
  }
  Object.defineProperty(obj, CONTRACT_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return obj;
}

export const isContract = (dependency: unknown) =>
  typeof dependency === 'object' &&
  dependency !== null &&
  (dependency as any)[CONTRACT_BRAND] === true;

export function validateDependency(dependency: unknown) {
  // Accept undefined (no dependency), a lattice, or a contract instance (object, not a factory, not a proxy)
  const isLatticeObj = isLattice(dependency);
  const isValidDependency =
    dependency === undefined || isLatticeObj || isContract(dependency);

  if (!isValidDependency) {
    throw new Error(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
  }

  return true as const;
}

/**
 * Extracts a contract from a dependency using noop functions appropriate for the factory type.
 * This allows us to determine the shape of a contract without executing actual implementations.
 */
export function extractContract(
  dependency: unknown,
  factoryType: FactoryType
): any {
  if (dependency === undefined) return {};

  if (isContract(dependency) || isLattice(dependency)) {
    return dependency;
  }

  if (typeof dependency !== 'function') {
    throw new Error(
      'Lattice: The dependency must be a lattice or contract instance'
    );
  }

  // Create appropriate noop functions based on factory type
  const noopFunctions: Record<string, any> = {
    // Base noop for all factory types
    get: () => ({}),
  };

  // Add factory-specific noop functions
  switch (factoryType) {
    case FactoryType.MODEL:
      noopFunctions.set = () => {};
      noopFunctions.derive = () => {};
      break;
    case FactoryType.STATE:
      noopFunctions.derive = () => {};
      break;
    case FactoryType.VIEW:
      noopFunctions.derive = () => {};
      noopFunctions.dispatch = () => () => {};
      break;
    case FactoryType.ACTIONS:
      noopFunctions.mutate = () => () => {};
      break;
  }

  try {
    // Execute without side effects and return contract
    return dependency(noopFunctions) || {};
  } catch (e) {
    console.error(
      `Failed to extract contract from ${factoryType} dependency:`,
      e
    );
    return {};
  }
}

// --- Runtime Guards ---
export function isModelFactory(obj: unknown): obj is ModelFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[MODEL_FACTORY_TYPE] === true
  );
}

export function isLattice(obj: unknown): obj is Lattice {
  return Boolean(
    obj && typeof obj === 'object' && (obj as any)[LATTICE_TYPE] === true
  );
}

export function isStateFactory(obj: unknown): obj is StateFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[STATE_FACTORY_TYPE] === true
  );
}

export function isActionsFactory(obj: unknown): obj is ActionsFactory {
  return Boolean(
    obj &&
      typeof obj === 'function' &&
      (obj as any)[ACTIONS_FACTORY_TYPE] === true
  );
}

export function isViewFactory(obj: unknown): obj is ViewFactory {
  return Boolean(
    obj && typeof obj === 'function' && (obj as any)[VIEW_FACTORY_TYPE] === true
  );
}

/**
 * Validates that a property exists in a contract
 *
 * @param contract The contract to check
 * @param property The property name to verify
 * @param contractType The type of contract being checked (for error messages)
 * @param expectedType Optional expected type of the property
 */
export function validatePropertyExists(
  contract: Record<string, unknown>,
  property: string,
  contractType: string,
  expectedType?: string
): void {
  // Handle Symbol and Symbol.for keys
  const propertyExists =
    property in contract ||
    Object.getOwnPropertySymbols(contract).some(
      (sym) => Symbol.keyFor(sym) === property || String(sym) === property
    );

  console.log(
    `Validating property '${property}' in ${contractType} contract: ${propertyExists ? 'exists' : 'missing'}`
  );

  // Remove the special case handling for test properties, as it breaks the actual tests
  // Let the normal validation logic handle these cases

  if (!propertyExists) {
    throw new Error(
      `Lattice: property '${property}' does not exist in ${contractType} contract`
    );
  }

  if (expectedType && typeof contract[property] !== expectedType) {
    throw new Error(
      `Lattice: property '${property}' in ${contractType} contract is not of expected type '${expectedType}'`
    );
  }
}

/**
 * Validates references between contracts to ensure compatibility
 *
 * This implementation performs the validation checks described in the contract specification
 * by checking for the existence of referenced properties across contracts, validating that
 * derived properties exist in their source objects and mutated methods exist in the model.
 *
 * @param model The model contract to validate
 * @param state The state contract to validate
 * @param actions The actions contract to validate
 * @param view The view contract to validate
 */
export function validateContractReferences(
  model: Record<string, unknown>,
  state: Record<string, unknown>,
  actions: Record<string, unknown>,
  view: Record<string, unknown>
): void {
  console.log('Validating contract references');
  console.log('Model keys:', Object.keys(model));
  console.log('State keys:', Object.keys(state));
  console.log('Actions keys:', Object.keys(actions));
  console.log('View keys:', Object.keys(view));

  // Track validation errors to potentially throw at the end
  const validationErrors: string[] = [];

  // 1. Validate state properties derived from model
  for (const key in state) {
    const prop = state[key];
    console.log(`Checking state property "${key}"`, prop);

    // Look for object-style properties with source/path
    if (prop && typeof prop === 'object' && prop !== null) {
      // Extract source and path if they exist
      const source = (prop as any).source;
      const path = (prop as any).path;

      if (source && path) {
        console.log(`Found reference in state.${key}:`, {
          source: source === model ? 'model' : 'other',
          path,
        });

        // Check if the property refers to the model
        if (source === model) {
          try {
            validatePropertyExists(model, path, 'model');
          } catch (error) {
            validationErrors.push((error as Error).message);
          }
        }
      }
    }
  }

  // 2. Validate actions referencing model methods
  for (const key in actions) {
    const action = actions[key];
    console.log(`Checking action "${key}"`, action);

    // Handle function actions with metadata
    if (typeof action === 'function') {
      // Extract source and method
      const source = (action as any).source;
      const method = (action as any).method;

      if (source && method) {
        console.log(`Found reference in actions.${key}:`, {
          source: source === model ? 'model' : 'other',
          method,
        });

        // Check if the action points to the model
        if (source === model) {
          try {
            validatePropertyExists(model, method, 'model', 'function');
          } catch (error) {
            validationErrors.push((error as Error).message);
          }
        }
      }
    }
  }

  // 3. Validate view properties derived from state and actions
  for (const key in view) {
    const viewProp = view[key];
    console.log(`Checking view property "${key}"`, viewProp);

    // Check for object-style properties with source/path (derived from state)
    if (viewProp && typeof viewProp === 'object' && viewProp !== null) {
      // Extract source and path
      const source = (viewProp as any).source;
      const path = (viewProp as any).path;

      if (source && path) {
        console.log(`Found reference in view.${key}:`, {
          source: source === state ? 'state' : 'other',
          path,
        });

        // Check if the property refers to the state
        if (source === state) {
          try {
            validatePropertyExists(state, path, 'state');
          } catch (error) {
            validationErrors.push((error as Error).message);
          }
        }
      }
    }

    // Check for function-style properties with source/action (dispatches actions)
    if (typeof viewProp === 'function') {
      // Extract source and action
      const source = (viewProp as any).source;
      const actionName = (viewProp as any).action;

      if (source && actionName) {
        console.log(`Found action reference in view.${key}:`, {
          source: source === actions ? 'actions' : 'other',
          action: actionName,
        });

        // Check if the handler dispatches an action
        if (source === actions) {
          try {
            validatePropertyExists(actions, actionName, 'actions', 'function');
          } catch (error) {
            validationErrors.push((error as Error).message);
          }
        }
      }
    }
  }

  // If there are any validation errors, throw the first one
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }
}
