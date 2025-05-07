import { LATTICE_TYPE } from './constants';
import {
  ModelContract,
  StateContract,
  ActionsContract,
  ViewContract,
} from './types';
import { isContract } from './utils';

interface LatticeParts {
  model: ModelContract;
  state: StateContract;
  actions: ActionsContract;
  view: ViewContract;
}

export function createLattice(name: string, parts: LatticeParts) {
  // Check that all parts are branded contract instances
  if (!isContract(parts.model)) {
    throw new Error(
      'Lattice: model must be a branded contract instance (result of createModel()())'
    );
  }
  if (!isContract(parts.state)) {
    throw new Error(
      'Lattice: state must be a branded contract instance (result of createState()())'
    );
  }
  if (!isContract(parts.actions)) {
    throw new Error(
      'Lattice: actions must be a branded contract instance (result of createActions()())'
    );
  }
  if (!isContract(parts.view)) {
    throw new Error(
      'Lattice: view must be a branded contract instance (result of createView()())'
    );
  }

  // TODO: Add proper contract consistency enforcement in the future
  // For now, we just ensure all parts are valid branded contracts

  // Create a lattice object with the LATTICE_TYPE brand
  const lattice = {
    name,
    model: parts.model,
    state: parts.state,
    actions: parts.actions,
    view: parts.view,
  };

  // Brand the lattice
  Object.defineProperty(lattice, LATTICE_TYPE, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return lattice;
}
