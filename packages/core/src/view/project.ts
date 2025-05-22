/**
 * Direct API for creating parameterized views with clean ergonomics
 *
 * This provides a focused API specifically for parameterized views that:
 * - Works with selector and action factories (like from() API)
 * - Returns views compatible with createComponent (unlike from() API)
 * - Has cleaner ergonomics for the common case of parameterized views
 */

import { SelectorsFactory, ActionsFactory, ViewFactory } from '../shared/types';
import { createView } from './create';

/**
 * Projects selector and action factories into parameterized view functions.
 *
 * Unlike the from() API which creates views with factory type parameters,
 * project() creates views with raw type parameters, making them compatible
 * with createComponent.
 *
 * @example
 * ```typescript
 * // In a component:
 * const nodeView = project(selectorsFactory, actionsFactory).toView(
 *   ({ selectors, actions }) => (nodeId: string) => ({
 *     'aria-selected': selectors().isSelected(nodeId),
 *     onClick: () => actions().selectNode(nodeId)
 *   })
 * );
 *
 * // This can be used directly in createComponent:
 * createComponent(() => ({
 *   model,
 *   selectors: selectorsFactory,
 *   actions: actionsFactory,
 *   view: { node: nodeView }  // Compatible!
 * }));
 * ```
 */
export function project<TSelectors, TActions, TModel>(
  selectorsFactory: SelectorsFactory<TSelectors>,
  actionsFactory: ActionsFactory<TActions, TModel>
) {
  return {
    toView<TViewFunc extends (...args: any[]) => Record<string, any>>(
      factory: (tools: {
        selectors: () => TSelectors;
        actions: () => TActions;
      }) => TViewFunc
    ): ViewFactory<TViewFunc, TSelectors, TActions> {
      // Follow the same pattern as from() but with raw type parameters
      // This makes the view compatible with createComponent
      return createView<TViewFunc, TSelectors, TActions>(
        {
          selectors: selectorsFactory as unknown as TSelectors,
          actions: actionsFactory as unknown as TActions,
        },
        // Wrap the factory to adapt from factory tools to raw tools
        (tools) =>
          factory({
            selectors: () => tools.selectors() as TSelectors,
            actions: () => tools.actions() as TActions,
          })
      );
    },
  };
}
