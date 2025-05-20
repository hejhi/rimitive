/**
 * A fluent API for creating Lattice components with proper type inference.
 *
 * The `from` function provides a much better developer experience by:
 * 1. Requiring only a single type parameter in most cases
 * 2. Preserving type information across the entire chain
 * 3. Providing a readable, chainable API
 *
 * Each overload of `from` provides context-appropriate methods based on what was passed to it.
 */

import { createActions } from '../actions/create';
import { createSelectors } from '../selectors/create';
import { createView } from '../view/create';
import { isModelFactory, isSelectorsFactory } from './identify';
import {
  ModelFactory,
  SelectorsFactory,
  ActionsFactory,
  ViewFactory,
} from './types';

/**
 * Type overloads for the from function
 */

/**
 * Creates a fluent API from a model factory.
 * This provides methods for creating actions and selectors with full type inference.
 */
export function from<TModel>(source: ModelFactory<TModel>): {
  createActions<TActions>(
    factory: (tools: { model: () => TModel }) => TActions
  ): ActionsFactory<TActions, TModel>;

  createSelectors<TSelectors>(
    factory: (tools: { model: () => TModel }) => TSelectors
  ): SelectorsFactory<TSelectors>;
};

/**
 * Creates a fluent API from a selectors factory.
 * This provides methods for working with selectors and creating views.
 */
export function from<TSelectors>(source: SelectorsFactory<TSelectors>): {
  withActions<TActions>(actions: TActions): {
    createView<TView>(
      factory: (tools: {
        selectors: () => TSelectors;
        actions: () => TActions;
      }) => TView
    ): ViewFactory<TView, TSelectors, TActions>;
  };
};

/**
 * Type guard and implementation to determine which overload to use at runtime.
 */
export function from(source: any): any {
  if (isModelFactory(source)) {
    return fromModel(source);
  }

  if (isSelectorsFactory(source)) {
    return fromSelectors(source);
  }

  // Fallback for other types, could be expanded as needed
  throw new Error('Unsupported source type for from()');
}

// Private implementation helpers
function fromModel<TModel>(model: ModelFactory<TModel>) {
  return {
    createActions<TActions>(
      factory: (tools: { model: () => TModel }) => TActions
    ) {
      // Use proper type parameters to maintain type safety
      return createActions<TActions, ModelFactory<TModel>>(
        { model },
        // Cast to the correct type to ensure compatibility
        (tools) =>
          factory({
            model: () => tools.model() as TModel,
          })
      );
    },

    createSelectors<TSelectors>(
      factory: (tools: { model: () => TModel }) => TSelectors
    ) {
      // Use proper type parameters to maintain type safety
      return createSelectors<TSelectors, ModelFactory<TModel>>(
        { model },
        // Cast to the correct type to ensure compatibility
        (tools) =>
          factory({
            model: () => tools.model() as TModel,
          })
      );
    },
  };
}

function fromSelectors<TSelectors>(selectors: SelectorsFactory<TSelectors>) {
  return {
    withActions<TActions>(actions: ActionsFactory<TActions>) {
      return {
        createView<TView>(
          factory: (tools: {
            selectors: () => TSelectors;
            actions: () => TActions;
          }) => TView
        ) {
          // Following the same pattern as createActions and createSelectors,
          // we pass the factories directly without unwrapping
          return createView<
            TView,
            SelectorsFactory<TSelectors>,
            ActionsFactory<TActions>
          >(
            {
              selectors,
              actions,
            },
            // The factory is wrapped to match the expected signature
            (tools) =>
              factory({
                selectors: () => tools.selectors() as TSelectors,
                actions: () => tools.actions() as TActions,
              })
          );
        },
      };
    },
  };
}
