/**
 * Component Creation with State Adapters
 * 
 * This provides the core API for creating Lattice components with pluggable
 * state management, enabling users to choose their preferred state solution.
 */

import type { 
  ComponentConfig, 
  ComponentFactory, 
  Lattice,
  ModelFactoryParams
} from '../shared/types';
import { COMPONENT_FACTORY_BRAND } from '../shared/types';
import type { StateAdapter, StateStore } from '../shared/state-adapter';
import { brandWithSymbol } from '../shared/identify';

/**
 * Configuration for creating a component with a state adapter
 */
export interface ComponentWithAdapterConfig<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
> extends ComponentConfig<TModel, TSelectors, TActions, TViews> {
  /**
   * The state adapter to use for this component
   */
  adapter: StateAdapter<TModel>;
  
  /**
   * Initial state for the component
   */
  initialState: TModel;
}

/**
 * Create a Lattice component with a pluggable state adapter
 * 
 * This enables users to choose their state management strategy per component instance.
 * 
 * @example
 * ```typescript
 * import { createComponentWithAdapter } from '@lattice/core';
 * import { createZustandAdapter } from '@lattice/core/adapters';
 * 
 * const adapter = await createZustandAdapter({ devtools: true });
 * 
 * const component = createComponentWithAdapter({
 *   model: myModelFactory,
 *   selectors: mySelectorsFactory,
 *   actions: myActionsFactory,
 *   view: { main: myViewFactory },
 *   adapter,
 *   initialState: { count: 0 }
 * });
 * ```
 */
export function createComponentWithAdapter<
  TModel = unknown,
  TSelectors = unknown,
  TActions = unknown,
  TViews extends Record<string, unknown> = Record<string, unknown>,
>(
  config: ComponentWithAdapterConfig<TModel, TSelectors, TActions, TViews>
): ComponentFactory<TModel, TSelectors, TActions, TViews> {
  const { model, selectors, actions, view, adapter, initialState } = config;

  return brandWithSymbol(
    (): Lattice<TModel, TSelectors, TActions, TViews> => {
      // Create the state store using the adapter
      const store: StateStore<TModel> = adapter.createStore(initialState);
      
      // Create model factory params from the store
      const modelParams: ModelFactoryParams<TModel> = {
        set: store.set,
        get: store.get,
      };

      // Create the component instances
      const modelInstance = model()(modelParams);
      const selectorsInstance = selectors()({ model: () => modelInstance });
      const actionsInstance = actions()({ model: () => modelInstance });

      // Create view instances
      const viewInstances = Object.entries(view).reduce((acc, [key, viewFactory]) => {
        acc[key] = viewFactory()({
          selectors: () => selectorsInstance,
          actions: () => actionsInstance,
        });
        return acc;
      }, {} as Record<string, unknown>) as TViews;

      // Return the Lattice interface
      return brandWithSymbol(
        {
          getModel: () => model,
          getSelectors: () => selectors,
          getActions: () => actions,
          getView: <K extends keyof TViews>(viewName: K) => view[viewName],
          getAllViews: () => view,
        },
        COMPONENT_FACTORY_BRAND
      );
    },
    COMPONENT_FACTORY_BRAND
  );
}