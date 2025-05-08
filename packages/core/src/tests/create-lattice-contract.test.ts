import { describe, it, expect } from 'vitest';
import { createLattice } from '../lattice';
import { createModel } from '../model_bk';
import { createState } from '../state';
import { createActions } from '../actions';
import { createView } from '../view';

describe('createLattice contract enforcement', () => {
  it('should throw and be a type error if model is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: 123 as any,
        state: createState()(() => ({})),
        actions: createActions()(() => ({})),
        view: createView()(() => ({})),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: {} as any,
        state: createState()(() => ({})),
        actions: createActions()(() => ({})),
        view: createView()(() => ({})),
      })
    ).toThrow();
  });

  it('should throw and be a type error if state is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: 123 as any,
        actions: createActions()(() => ({})),
        view: createView()(() => ({})),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: {} as any,
        actions: createActions()(() => ({})),
        view: createView()(() => ({})),
      })
    ).toThrow();
  });

  it('should throw and be a type error if actions is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: createState()(() => ({})),
        actions: 123 as any,
        view: createView()(() => ({})),
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: createState()(() => ({})),
        actions: {} as any,
        view: createView()(() => ({})),
      })
    ).toThrow();
  });

  it('should throw and be a type error if view is not a branded contract', () => {
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: createState()(() => ({})),
        actions: createActions()(() => ({})),
        view: 123 as any,
      })
    ).toThrow();
    expect(() =>
      createLattice('test', {
        model: createModel()(() => ({})),
        state: createState()(() => ({})),
        actions: createActions()(() => ({})),
        view: {} as any,
      })
    ).toThrow();
  });

  // TODO: Add test for contract consistency enforcement once that feature is implemented
  // For now, we're focusing on accepting branded contracts

  it('should succeed if all parts are valid, branded contracts', () => {
    // Create contracts
    const model = createModel()(() => ({}));
    const state = createState()(() => ({}));
    const actions = createActions()(() => ({}));
    const view = createView()(() => ({}));

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
    const baseModel = createModel()(() => ({}));

    // Create a state that uses the same contract shape
    const baseState = createState()(() => ({}));

    // Create a composite state that uses a callback to shape the contract
    const compositeState = createState(baseState, ({ state, select }) => ({
      count: select(state, 'count'),
      status: select(state, 'status'),
    }))(() => ({}));

    expect(() =>
      createLattice('test', {
        model: baseModel,
        state: compositeState,
        actions: createActions()(() => ({})),
        view: createView()(() => ({})),
      })
    ).not.toThrow();
  });
});
