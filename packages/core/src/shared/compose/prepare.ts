import {
  ModelInstance,
  StateInstance,
  ActionsInstance,
  ViewInstance,
  PreparedModelInstance,
  PreparedStateInstance,
  PreparedActionsInstance,
  PreparedViewInstance,
  PREPARED_BRAND,
  STATE_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
} from '../types';
import {
  brandWithSymbol,
  isModelInstance,
  isStateInstance,
  isActionInstance,
  isViewInstance,
} from '../identify';

/**
 * Prepares a Lattice entity (model, state, actions, view) for use.
 *
 * Usage:
 *   const prepared = prepare(myModelInstance);
 *   if (isPrepared(prepared)) { ... }
 *
 * - Preserves the original entity brand.
 * - Adds the PREPARED_BRAND for type safety and runtime checks.
 * - Works for all entity types via overloads.
 */
// Model
export function prepare<T>(
  instance: ModelInstance<T>
): PreparedModelInstance<T>;
// State
export function prepare<T>(
  instance: StateInstance<T>
): PreparedStateInstance<T>;
// Actions
export function prepare<T>(
  instance: ActionsInstance<T>
): PreparedActionsInstance<T>;
// View
export function prepare<T>(instance: ViewInstance<T>): PreparedViewInstance<T>;
// Implementation
export function prepare(instance: any): any {
  if (typeof instance !== 'function') {
    throw new Error('Invalid entity: Must be a function');
  }
  if (
    !isModelInstance(instance) &&
    !isStateInstance(instance) &&
    !isActionInstance(instance) &&
    !isViewInstance(instance)
  ) {
    throw new Error('Invalid entity: Must be a branded Lattice instance');
  }
  return brandWithSymbol(instance, PREPARED_BRAND);
}

/**
 * Type guard for prepared entities.
 */
export function isPrepared(
  entity: unknown
): entity is { [PREPARED_BRAND]: true } {
  return Boolean(
    entity && typeof entity === 'function' && (entity as any)[PREPARED_BRAND]
  );
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('prepare', async () => {
    const { brandWithSymbol } = await import('../identify');
    const { createModel } = await import('../../model');
    const { createActions } = await import('../../actions');

    it('should prepare a model instance', () => {
      const baseModel = createModel<{ count: number }>(() => ({ count: 1 }));
      const prepared = prepare(baseModel);
      expect(typeof prepared).toBe('function');
      expect(isPrepared(prepared)).toBe(true);
      expect((prepared as any)[PREPARED_BRAND]).toBe(true);
    });

    it('should prepare a state instance', () => {
      const baseState = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        STATE_INSTANCE_BRAND
      );
      const prepared = prepare(baseState);
      expect(typeof prepared).toBe('function');
      expect(isPrepared(prepared)).toBe(true);
      expect((prepared as any)[PREPARED_BRAND]).toBe(true);
    });

    it('should prepare an actions instance', () => {
      const baseActions = createActions<{ inc: () => void }>(() => ({
        inc: () => {},
      }));
      const prepared = prepare(baseActions);
      expect(typeof prepared).toBe('function');
      expect(isPrepared(prepared)).toBe(true);
      expect((prepared as any)[PREPARED_BRAND]).toBe(true);
    });

    it('should prepare a view instance', () => {
      const baseView = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        VIEW_INSTANCE_BRAND
      );
      const prepared = prepare(baseView);
      expect(typeof prepared).toBe('function');
      expect(isPrepared(prepared)).toBe(true);
      expect((prepared as any)[PREPARED_BRAND]).toBe(true);
    });

    it('should throw for non-function entities', () => {
      expect(() => prepare(null as any)).toThrow('Invalid entity');
      expect(() => prepare({} as any)).toThrow('Invalid entity');
      expect(() => prepare('not a function' as any)).toThrow('Invalid entity');
    });
  });
}
