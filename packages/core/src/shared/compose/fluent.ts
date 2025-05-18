import { createActions } from '../../actions';
import { createSelectors } from '../../selectors';
import { createView } from '../../view';
import {
  ModelInstance,
  SelectorsInstance,
  ActionsInstance,
  ViewInstance,
  ModelCompositionTools,
  SelectorsCompositionTools,
  ActionsCompositionTools,
  ViewCompositionTools,
  StoreFactoryTools,
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
export function compose<B>(base: ModelInstance<B>): {
  with<Ext>(
    cb: (tools: ModelCompositionTools<B, Ext>) => Ext
  ): (tools: StoreFactoryTools<B & Ext>) => B & Ext;
};

export function compose<B>(base: SelectorsInstance<B>): {
  with<Ext, TModel>(
    cb: (tools: SelectorsCompositionTools<TModel>) => Ext
  ): (options: { get: any }) => B & Ext;
};

export function compose<B>(base: ActionsInstance<B>): {
  with<Ext, TModel>(
    cb: (tools: ActionsCompositionTools<TModel>) => Ext
  ): (options: { mutate: any }) => B & Ext;
};

export function compose<B>(base: ViewInstance<B>): {
  with<Ext, TSelectors, TActions>(
    cb: (tools: ViewCompositionTools<TSelectors, TActions>) => Ext
  ): (options: any) => B & Ext;
};
// Implementation
export function compose(base: any): { with: (cb: any) => any } {
  return {
    with: (cb: any) => composeWith(base, cb),
  };
}

type CounterState = {
  count: number;
  increment: () => void;
};

type EnhancedCounterState = {
  doubled: () => void;
};

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('compose', async () => {
    const { brandWithSymbol } = await import('../identify');
    const { createModel } = await import('../../model');

    const baseModel = createModel<CounterState>(() => ({
      count: 1,
      increment: () => {},
    }));

    it('should support fluent compose for models', () => {
      const enhanced = compose(baseModel).with<EnhancedCounterState>(
        (tools) => ({
          doubled: () => tools.get().count * 2,
        })
      );

      expect(typeof enhanced).toBe('function');
    });

    const baseSelectors = createSelectors<{ count: number }, typeof baseModel>(
      { model: baseModel },
      ({ model }) => ({
        count: model().count,
      })
    );

    it('should support fluent compose for selectors', () => {
      const mockModelGetter = { count: 1 };
      const enhanced = compose(baseSelectors).with<
        { bar: number },
        typeof mockModelGetter
      >((tool) => ({
        bar: tool.model().count,
      }));

      expect(typeof enhanced).toBe('function');
    });

    const baseActions = createActions<{ inc: () => void }, typeof baseModel>(
      { model: baseModel },
      ({ model }) => ({
        inc: model().increment,
      })
    );

    it('should support fluent compose for actions', () => {
      // Mock model with a dec method
      const mockModelGetter = { dec: () => {} };

      const enhanced = compose(baseActions).with<
        { dec: () => void },
        typeof mockModelGetter
      >(({ model }) => ({
        dec: model().dec,
      }));

      expect(typeof enhanced).toBe('function');
    });

    it('should support fluent compose for view', () => {
      const baseView = createView<
        { foo: () => void; bar: number },
        typeof baseSelectors,
        typeof baseActions
      >(
        { selectors: baseSelectors, actions: baseActions },
        ({ actions, selectors }) => ({
          foo: actions().inc,
          bar: selectors().count,
        })
      );

      const enhanced = compose(baseView).with<{ baz: number; inc: () => void }>(
        ({ actions }) => ({
          baz: 2,
          inc: actions().inc,
        })
      );

      expect(typeof enhanced).toBe('function');
    });
  });
}
