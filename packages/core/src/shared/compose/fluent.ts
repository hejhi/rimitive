import {
  ModelInstance,
  StateInstance,
  ActionsInstance,
  ViewInstance,
  ModelFactoryTools,
  StateFactoryTools,
  ActionsFactoryTools,
  ViewFactoryTools,
  MODEL_INSTANCE_BRAND,
  STATE_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
} from '../types';
import { composeWith } from './core';

/**
 * Unified fluent API for composing all Lattice entities (model, state, actions, view) with best-in-class type inference.
 *
 * Usage:
 *   const enhanced = compose(base).with<Ext>(cb)
 *
 * - The base type is inferred from base.
 * - The extension type is specified once at the point of extension.
 * - The callback receives tools typed to the merged shape (for model/state) or correct tools (for actions/view).
 * - The result is a new instance with the correct type.
 *
 * This is the recommended public API for Lattice composition.
 */
// Model
export function compose<B>(base: ModelInstance<B>): {
  with<Ext>(
    cb: (tools: ModelFactoryTools<B & Ext>) => Ext
  ): ModelInstance<B & Ext>;
};
// State
export function compose<B>(base: StateInstance<B>): {
  with<Ext>(
    cb: (tools: StateFactoryTools<B & Ext>) => Ext
  ): StateInstance<B & Ext>;
};
// Actions
export function compose<B>(base: ActionsInstance<B>): {
  with<Ext>(cb: (tools: ActionsFactoryTools) => Ext): ActionsInstance<B & Ext>;
};
// View
export function compose<B>(base: ViewInstance<B>): {
  with<Ext>(cb: (tools: ViewFactoryTools) => Ext): ViewInstance<B & Ext>;
};
// Implementation
export function compose(base: any): { with: (cb: any) => any } {
  return {
    with: (cb: any) => composeWith(base, cb),
  };
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('compose', async () => {
    const { brandWithSymbol } = await import('../identify');
    const { createModel } = await import('../../model');

    it('should support fluent compose for models', () => {
      const baseModel = createModel<{
        count: number;
      }>(() => ({
        count: 1,
      }));

      const enhanced = compose(baseModel).with<{ doubled: () => number }>(
        ({ get }) => ({
          doubled: () => get().count * 2,
        })
      );

      expect(typeof enhanced).toBe('function');
      expect(enhanced[MODEL_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for state', () => {
      const baseState = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        STATE_INSTANCE_BRAND
      );

      const enhanced = compose(baseState).with<{ bar: number }>(({ get }) => ({
        bar: get().foo.length,
      }));

      expect(typeof enhanced).toBe('function');
      expect(enhanced[STATE_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for actions', () => {
      const baseActions = brandWithSymbol(
        () => () => ({ inc: () => {} }),
        ACTIONS_INSTANCE_BRAND
      );

      const enhanced = compose(baseActions).with<{ dec: () => void }>(
        ({ mutate }) => ({
          dec: () => mutate(undefined as any, undefined as any),
        })
      );

      expect(typeof enhanced).toBe('function');
      expect(enhanced[ACTIONS_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for view', () => {
      const baseView = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        VIEW_INSTANCE_BRAND
      );

      const enhanced = compose(baseView).with<{ bar: number }>(
        ({ derive }) => ({
          bar: derive(() => 42, undefined as never),
        })
      );

      expect(typeof enhanced).toBe('function');
      expect(enhanced[VIEW_INSTANCE_BRAND]).toBe(true);
    });
  });
}
