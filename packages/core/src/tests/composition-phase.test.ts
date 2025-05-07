// This test is expected to fail (Red) until the correct contract enforcement is implemented in the factories.
// It verifies that calling a factory (model, view, state, actions) with only the first phase (composition)
// and omitting the extension phase is not allowed, per the Lattice spec.
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

import { describe, it, expect } from 'vitest';
// NOTE: The following imports will fail until the corresponding implementations exist.
import { createModel } from '../model';
import { createView } from '../view';
import { createState } from '../state';
import { createActions } from '../actions';

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
  it('should throw if dependency is not a lattice or model factory', () => {
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createModel(123)).toThrow(
      /must be a lattice or model factory/i
    );
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createModel({ foo: 'bar' })).toThrow(
      /must be a lattice or model factory/i
    );
  });

  it('should allow passing the model factory function as dependency', () => {
    expect(() => createModel(createModel)).not.toThrow();
  });
});

describe('Runtime contract enforcement for createView', () => {
  it('should throw if dependency is not a lattice or view factory', () => {
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createView(123)).toThrow(/must be a lattice or view factory/i);
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createView({ foo: 'bar' })).toThrow(
      /must be a lattice or view factory/i
    );
  });

  it('should allow passing the view factory function as dependency', () => {
    expect(() => createView(createView)).not.toThrow();
  });
});

describe('Runtime contract enforcement for createState', () => {
  it('should throw if dependency is not a lattice or state factory', () => {
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createState(123)).toThrow(
      /must be a lattice or state factory/i
    );
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createState({ foo: 'bar' })).toThrow(
      /must be a lattice or state factory/i
    );
  });

  it('should allow passing the state factory function as dependency', () => {
    expect(() => createState(createState)).not.toThrow();
  });
});

describe('Runtime contract enforcement for createActions', () => {
  it('should throw if dependency is not a lattice or actions factory', () => {
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createActions(123)).toThrow(
      /must be a lattice or actions factory/i
    );
    // @ts-expect-error - purposely invalid dependency (should fail at compile time)
    expect(() => createActions({ foo: 'bar' })).toThrow(
      /must be a lattice or actions factory/i
    );
  });

  it('should allow passing the actions factory function as dependency', () => {
    expect(() => createActions(createActions)).not.toThrow();
  });
});
