import { ViewInstance, ViewFactoryTools } from '../types';
import { composeWith } from './core';

/**
 * Curried helper for composing views with strong type inference.
 *
 * Due to TypeScript limitations, the tools in the extension callback are typed to the base shape unless the extension type is provided explicitly.
 *
 * @param base The base view instance
 * @returns A function accepting an extension callback with ViewFactoryTools
 */
export function composeView<B>(
  base: ViewInstance<B>
): <Ext = unknown>(
  extension: (tools: ViewFactoryTools) => Ext
) => ViewInstance<B & Ext> {
  return function <Ext = unknown>(
    extension: (tools: ViewFactoryTools) => Ext
  ): ViewInstance<B & Ext> {
    return composeWith(base, extension);
  };
}