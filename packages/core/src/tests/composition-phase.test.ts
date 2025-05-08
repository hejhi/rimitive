// This test is expected to fail (Red) until the correct contract enforcement is implemented in the factories.
// It verifies that calling a factory (model, view, state, actions) with only the first phase (composition)
// and omitting the extension phase is not allowed, per the Lattice spec.
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

import { describe, it, expect, vi, beforeEach } from 'vitest';
// NOTE: The following imports will fail until the corresponding implementations exist.
import { createModel } from '../model_bk';
import { createView } from '../view';
import { createState } from '../state';
import { createActions } from '../actions';
import { ModelExtensionHelpers, StateExtensionHelpers } from '../types';
import * as utils from '../utils';
// Spy on the validateContractReferences function
const validateContractReferencesSpy = vi.spyOn(
  utils,
  'validateContractReferences'
);

describe('Composition Phase (first phase only, no extension phase)', () => {
  it('should fail when only the first phase is called for createModel (no extension phase)', () => {
    // Spec: createModel() must be followed by an extension phase function call
    const ModelFactory = createModel();
    // Not calling ModelFactory(...)
    expect(ModelFactory).toBeDefined(); // This line should never be reached if contract enforcement is correct
  });

  it('should fail when only the first phase is called for createView (no extension phase)', () => {
    const ViewFactory = createView();
    expect(ViewFactory).toBeDefined();
  });

  it('should fail when only the first phase is called for createState (no extension phase)', () => {
    const StateFactory = createState();
    expect(StateFactory).toBeDefined();
  });

  it('should fail when only the first phase is called for createActions (no extension phase)', () => {
    const ActionsFactory = createActions();
    expect(ActionsFactory).toBeDefined();
  });
});

describe('Runtime contract enforcement for createModel', () => {
  it('should throw if dependency is not a lattice or model contract instance', () => {
    expect(() => createModel(123 as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createModel({ foo: 'bar' } as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createModel(createModel as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
  });
});

describe('Runtime contract enforcement for createView', () => {
  it('should throw if dependency is not a lattice or view contract instance', () => {
    expect(() => createView(123 as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createView({ foo: 'bar' } as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createView(createView as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
  });
});

describe('Runtime contract enforcement for createState', () => {
  it('should throw if dependency is not a lattice or state contract instance', () => {
    expect(() => createState(123 as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createState({ foo: 'bar' } as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createState(createState as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
  });
});

describe('Runtime contract enforcement for createActions', () => {
  it('should throw if dependency is not a lattice or actions contract instance', () => {
    expect(() => createActions(123 as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createActions({ foo: (() => {}) as any })).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
    expect(() => createActions(createActions as any)).toThrow(
      'Lattice: The first argument must be a lattice or contract instance (result of extension phase), not a factory function or proxy.'
    );
  });
});

describe('createModel composition phase contract shaping', () => {
  // Reset spy before each test
  beforeEach(() => {
    validateContractReferencesSpy.mockClear();
  });

  // Create test helpers
  const mockGet = vi.fn().mockImplementation(() => ({
    foo: 123,
    bar: () => 'bar',
    baz: true,
  }));

  it('should shape the contract according to the callback return type', () => {
    // Mock dependency: a minimal model factory using the standard pattern from the spec
    const baseModel = createModel()(() => ({
      foo: 1,
      baz: 2,
    }));

    // Compose with a callback that selects only foo and baz
    const composed = createModel(baseModel, ({ model, select }) => {
      return {
        foo: select(model, 'foo'),
        baz: select(model, 'baz'),
      };
    })(({ get }) => ({
      bar: get().foo,
    }));

    // Verify the get method was called
    /// try and test that the validateContractReferences function was called with the correct arguments
    // right now it's an empty array.
    console.log('eeek', composed);
    expect(validateContractReferencesSpy).toHaveBeenCalledWith(baseModel);
  });
});

describe('createState composition phase contract shaping', () => {
  // Create test helpers for state
  const mockStateGet = vi.fn().mockImplementation(() => ({
    count: 42,
    status: 'idle',
    flag: true,
  }));
  const mockStateDerive = vi.fn();

  const stateExtensionHelpers: StateExtensionHelpers = {
    get: mockStateGet,
    derive: mockStateDerive,
  };

  it('should pass through the contract as-is when no callback is provided', () => {
    // Mock dependency: a minimal state factory using the standard pattern from the spec
    const baseState = createState()(stateExtensionHelpers);

    // Compose with no callback
    const composed = createState(baseState);

    // Extension phase should see the full contract
    composed(stateExtensionHelpers);

    // Verify the get method was called
    expect(mockStateGet).toHaveBeenCalled();
  });

  it('should shape the contract according to the callback return type', () => {
    // Mock dependency: a minimal state factory
    const baseState = createState()(stateExtensionHelpers);

    // Compose with a callback that selects only count and flag
    const composed = createState(baseState, ({ state, select }) => {
      return {
        count: select(state, 'count'),
        flag: select(state, 'flag'),
      };
    });

    // Extension phase should only see count and flag
    composed(stateExtensionHelpers);

    // Verify the get method was called
    expect(mockStateGet).toHaveBeenCalled();
  });
});
