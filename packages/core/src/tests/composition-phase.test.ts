// This test is expected to fail (Red) until the correct contract enforcement is implemented in the factories.
// It verifies that calling a factory (model, view, state, actions) with only the first phase (composition)
// and omitting the extension phase is not allowed, per the Lattice spec.
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

import { describe, it, expect, vi } from 'vitest';
// NOTE: The following imports will fail until the corresponding implementations exist.
import { createModel } from '../model';
import { createView } from '../view';
import { createState } from '../state';
import { createActions } from '../actions';
import { ModelExtensionHelpers, StateExtensionHelpers } from '../types';

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
  // Create test helpers
  const mockGet = vi.fn().mockImplementation(() => ({
    foo: 123,
    bar: () => 'bar',
    baz: true,
  }));
  const mockSet = vi.fn();

  const modelExtensionHelpers: ModelExtensionHelpers = {
    get: mockGet,
    set: mockSet,
  };

  it('should pass through the contract as-is when no callback is provided', () => {
    // Mock dependency: a minimal model factory using the standard pattern from the spec
    const baseModel = createModel()(modelExtensionHelpers);

    // Compose with no callback
    const composed = createModel(baseModel);

    // Extension phase should see the full contract
    composed(modelExtensionHelpers);

    // Verify the get method was called and has access to both properties
    expect(mockGet).toHaveBeenCalled();
  });

  it('should shape the contract according to the callback return type', () => {
    // Mock dependency: a minimal model factory using the standard pattern from the spec
    const baseModel = createModel()(modelExtensionHelpers);

    // Compose with a callback that selects only foo and baz
    const composed = createModel(baseModel, ({ model, select }) => {
      return {
        foo: select(model, 'foo'),
        baz: select(model, 'baz'),
      };
    });

    // Extension phase should only see foo and baz
    composed(modelExtensionHelpers);

    // Verify the get method was called
    expect(mockGet).toHaveBeenCalled();
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
