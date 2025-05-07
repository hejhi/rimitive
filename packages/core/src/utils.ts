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
  VIEW = 'view'
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
export function extractContract(dependency: unknown, factoryType: FactoryType): any {
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
    console.error(`Failed to extract contract from ${factoryType} dependency:`, e);
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
