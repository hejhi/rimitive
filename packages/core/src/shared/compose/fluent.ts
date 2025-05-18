import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
  ModelCompositionTools,
  SelectorsCompositionTools,
  ActionsCompositionTools,
  ViewCompositionTools,
  StoreFactoryTools
} from '../types';

import { composeWith } from './core';

// Define the ViewParamsToToolsAdapter to represent view tools
interface ViewParamsToToolsAdapter<TSelectors = unknown, TActions = unknown> {
  getSelectors?: () => TSelectors;
  getActions?: () => TActions;
}

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
export function compose<B>(base: ModelFactory<B>): {
  with<Ext>(
    cb: (tools: ModelCompositionTools<B, Ext>) => Ext
  ): (tools: StoreFactoryTools<B & Ext>) => B & Ext;
};

export function compose<B>(base: SelectorsFactory<B>): {
  with<Ext, TModel>(
    cb: (tools: SelectorsCompositionTools<TModel>) => Ext
  ): (options: { get: () => B & Ext }) => B & Ext;
};

export function compose<B>(base: ActionsFactory<B>): {
  with<Ext, TModel>(
    cb: (tools: ActionsCompositionTools<TModel>) => Ext
  ): (options: { mutate: <M>(model: M) => any }) => B & Ext;
};

export function compose<B>(base: ViewFactory<B>): {
  with<Ext, TSelectors, TActions>(
    cb: (tools: ViewCompositionTools<TSelectors, TActions>) => Ext
  ): (options: ViewParamsToToolsAdapter<TSelectors, TActions>) => B & Ext;
};

/**
 * Implementation of the compose function that dispatches to the appropriate overload.
 * Uses type discrimination at runtime to maintain type safety.
 *
 * This matches the API surface described in the spec at lines 89-97.
 */
// Implementation function that handles the overloaded scenarios using type discrimination
export function compose<B>(
  base: ModelFactory<B> | SelectorsFactory<B> | ActionsFactory<B> | ViewFactory<B>
): any {
  // Type-safe implementation that dispatches to appropriate overloads based on runtime checks
  return {
    with: (cb: unknown) => {
      // composeWith handles the type discrimination internally
      return composeWith(base as any, cb as any);
    }
  };
}

// In-source tests
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('compose', async () => {
    it('should support fluent compose', () => {
      expect(typeof compose).toBe('function');
    });
  });
}