import { ModelInstance, ModelFactoryTools } from '../types';
import { composeWith } from './core';

/**
 * Curried helper for composing models with strong type inference.
 *
 * Due to TypeScript limitations, the tools in the extension callback are typed to the base shape unless the extension type is provided explicitly:
 *
 *   // get() is typed to base only
 *   const enhanced = composeModel(baseModel)(({ get }) => ({ doubled: () => get().count * 2 }));
 *
 *   // get() is typed to base + extension
 *   const enhanced = composeModel<{ doubled: () => number }>(baseModel)(({ get }) => ({ doubled: () => get().count * 2 }));
 *
 * @param base The base model instance
 * @returns A function accepting an extension callback with ModelFactoryTools typed to the final shape
 */
export function composeModel<B>(
  base: ModelInstance<B>
): <Ext = unknown>(
  extension: (tools: ModelFactoryTools<B & Ext>) => Ext
) => ModelInstance<B & Ext> {
  return function <Ext = unknown>(
    extension: (tools: ModelFactoryTools<B & Ext>) => Ext
  ): ModelInstance<B & Ext> {
    return composeWith(base, extension);
  };
}

/**
 * Helper for composing model tools with ergonomic type inference inside createModel.
 *
 * Usage:
 *   const enhanced = createModel<{ doubled: () => number }>((...args) => {
 *     const { createTools } = composeModelTools(baseModel);
 *     const { get, set } = createTools<{ doubled: () => number }>()(...args);
 *     return {
 *       doubled: () => get().count * 2,
 *     };
 *   });
 *
 * - You do not need to re-specify the base type.
 * - You only specify the extension type to createModel and (optionally) to createTools for full type safety.
 * - If you omit the type parameter to createTools, get() is typed to the base only.
 */
export function composeModelTools<B>(base: ModelInstance<B>) {
  return {
    createTools:
      <Ext = unknown>() =>
      (options: any): ModelFactoryTools<B & Ext> =>
        (base() as unknown as (options: any) => any)(
          options
        ) as ModelFactoryTools<B & Ext>,
  };
}
