import {
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
  ModelCompositionTools,
  SelectorsCompositionTools,
  ActionsCompositionTools,
  ViewCompositionTools,
  MODEL_INSTANCE_BRAND,
  SELECTORS_INSTANCE_BRAND,
  ACTIONS_INSTANCE_BRAND,
  VIEW_INSTANCE_BRAND,
} from '../types';
import { composeWith } from './core';

/**
 * Unified fluent API for composing all Lattice entities (model, selectors, actions, view) with best-in-class type inference.
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
// Model - uses slice-first pattern with tools object
export function compose<B>(base: ModelInstance<B>): {
  with<Ext>(
    cb: (slice: B, tools: ModelCompositionTools<B, Ext>) => Ext
  ): ModelInstance<B & Ext>;
};

// Selectors - uses slice-first pattern with tools object
export function compose<B>(base: SelectorsInstance<B>): {
  with<Ext, TModel>(
    cb: (slice: B, tools: SelectorsCompositionTools<TModel>) => Ext
  ): SelectorsInstance<B & Ext>;
};

// Actions - uses slice-first pattern with tools object
export function compose<B>(base: ActionsInstance<B>): {
  with<Ext, TModel>(
    cb: (slice: B, tools: ActionsCompositionTools<TModel>) => Ext
  ): ActionsInstance<B & Ext>;
};

// View - uses slice-first pattern with tools object
export function compose<B>(base: ViewInstance<B>): {
  with<Ext, TSelectors, TActions>(
    cb: (slice: B, tools: ViewCompositionTools<TSelectors, TActions>) => Ext
  ): ViewInstance<B & Ext>;
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
      const baseModel = createModel(() => ({
        count: 1,
      }));

      const enhanced = compose(baseModel).with<{ doubled: () => number }>(
        (slice, tools) => ({
          ...slice,
          doubled: () => tools.get().count * 2,
        })
      );

      expect(typeof enhanced).toBe('function');
      expect(enhanced[MODEL_INSTANCE_BRAND]).toBe(true);
    });

    it('should support cherry-picking properties from slice in models', () => {
      const baseModel = createModel(() => ({
        count: 1,
        privateData: 'sensitive',
      }));

      // Should allow cherry-picking specific properties
      const enhanced = compose(baseModel).with<{ doubled: () => number }>(
        (slice, tools) => ({
          // Only include count, omit privateData
          count: slice.count,
          doubled: () => tools.get().count * 2,
        })
      );

      expect(typeof enhanced).toBe('function');
      expect(enhanced[MODEL_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for selectors', () => {
      const baseSelectors = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        SELECTORS_INSTANCE_BRAND
      );

      const enhanced = compose(baseSelectors).with<
        { bar: number },
        { foo: string }
      >((slice) => ({
        ...slice,
        bar: slice.foo.length,
      }));

      expect(typeof enhanced).toBe('function');
      expect(enhanced[SELECTORS_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for actions', () => {
      const baseActions = brandWithSymbol(
        () => () => ({ inc: () => {} }),
        ACTIONS_INSTANCE_BRAND
      );

      // Mock model with a dec method
      const mockModel = { dec: () => {} };

      const enhanced = compose(baseActions).with<
        { dec: () => void },
        typeof mockModel
      >((slice, tools) => ({
        ...slice,
        dec: tools.model().dec,
      }));

      expect(typeof enhanced).toBe('function');
      expect(enhanced[ACTIONS_INSTANCE_BRAND]).toBe(true);
    });

    it('should support fluent compose for view', () => {
      const baseView = brandWithSymbol(
        () => () => ({ foo: 'bar' }),
        VIEW_INSTANCE_BRAND
      );

      const enhanced = compose(baseView).with<
        { bar: number },
        unknown,
        unknown
      >((slice) => ({
        ...slice,
        bar: 2,
      }));

      expect(typeof enhanced).toBe('function');
      expect(enhanced[VIEW_INSTANCE_BRAND]).toBe(true);
    });
  });
}
