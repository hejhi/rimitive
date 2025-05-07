import { describe, it, expect, vi } from 'vitest';
import { createLattice } from '../lattice';
import { createModel } from '../model';
import { createState } from '../state';
import { createActions } from '../actions';
import { createView } from '../view';
import {
  ModelExtensionHelpers,
  StateExtensionHelpers,
  ActionsExtensionHelpers,
  ViewExtensionHelpers,
} from '../types';

describe('createLattice contract enforcement', () => {
  // Mock get/set/derive functions for extension helpers
  const mockGet = vi.fn().mockReturnValue({
    count: 42,
    status: 'active',
  });

  const mockSet = vi.fn();
  const mockDerive = vi.fn();
  const mockDispatch = vi.fn();
  const mockMutate = vi.fn();

  // Create mocked extension helper objects
  const modelHelpers: ModelExtensionHelpers = {
    get: mockGet,
    set: mockSet,
  };

  const stateHelpers: StateExtensionHelpers = {
    get: mockGet,
    derive: mockDerive,
  };

  const actionsHelpers: ActionsExtensionHelpers = {
    mutate: mockMutate,
  };

  const viewHelpers: ViewExtensionHelpers = {
    derive: mockDerive,
    dispatch: mockDispatch,
  };

  it('should throw and be a type error if model is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: 123 as any,
        state: createState()(stateHelpers),
        actions: createActions()(actionsHelpers),
        view: createView()(viewHelpers),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: {} as any,
        state: createState()(stateHelpers),
        actions: createActions()(actionsHelpers),
        view: createView()(viewHelpers),
      })
    ).toThrow();
  });

  it('should throw and be a type error if state is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: 123 as any,
        actions: createActions()(actionsHelpers),
        view: createView()(viewHelpers),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: {} as any,
        actions: createActions()(actionsHelpers),
        view: createView()(viewHelpers),
      })
    ).toThrow();
  });

  it('should throw and be a type error if actions is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: createState()(stateHelpers),
        actions: 123 as any,
        view: createView()(viewHelpers),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: createState()(stateHelpers),
        actions: {} as any,
        view: createView()(viewHelpers),
      })
    ).toThrow();
  });

  it('should throw and be a type error if view is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: createState()(stateHelpers),
        actions: createActions()(actionsHelpers),
        view: 123 as any,
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(modelHelpers),
        state: createState()(stateHelpers),
        actions: createActions()(actionsHelpers),
        view: {} as any,
      })
    ).toThrow();
  });

  // TODO: Add test for contract consistency enforcement once that feature is implemented
  // For now, we're focusing on accepting branded contracts

  it('should succeed if all parts are valid, branded contracts', () => {
    // Create contracts
    const model = createModel()(modelHelpers);
    const state = createState()(stateHelpers);
    const actions = createActions()(actionsHelpers);
    const view = createView()(viewHelpers);

    expect(() =>
      createLattice('test', {
        model,
        state,
        actions,
        view,
      })
    ).not.toThrow();
  });

  it('should correctly use derived contracts with composition', () => {
    // Create a model with a specific contract
    const baseModel = createModel()(modelHelpers);

    // Create a state that uses the same contract shape
    const baseState = createState()(stateHelpers);

    // Create a composite state that uses a callback to shape the contract
    const compositeState = createState(baseState, ({ state, select }) => ({
      count: select(state, 'count'),
      status: select(state, 'status'),
    }))(stateHelpers);

    expect(() =>
      createLattice('test', {
        model: baseModel,
        state: compositeState,
        actions: createActions()(actionsHelpers),
        view: createView()(viewHelpers),
      })
    ).not.toThrow();
  });
});
