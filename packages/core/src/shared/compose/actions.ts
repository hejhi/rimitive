import { ActionsInstance, ActionsFactoryTools } from '../types';
import { composeWith } from './core';

/**
 * Curried helper for composing actions with strong type inference.
 *
 * Due to TypeScript limitations, the tools in the extension callback are typed to the base shape unless the extension type is provided explicitly.
 *
 * @param base The base actions instance
 * @returns A function accepting an extension callback with ActionsFactoryTools
 */
export function composeActions<B>(
  base: ActionsInstance<B>
): <Ext = unknown>(
  extension: (tools: ActionsFactoryTools) => Ext
) => ActionsInstance<B & Ext> {
  return function <Ext = unknown>(
    extension: (tools: ActionsFactoryTools) => Ext
  ): ActionsInstance<B & Ext> {
    return composeWith(base, extension);
  };
}