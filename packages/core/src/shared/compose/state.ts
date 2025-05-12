import { StateInstance, StateFactoryTools } from '../types';
import { composeWith } from './core';

/**
 * Curried helper for composing state with strong type inference.
 *
 * Due to TypeScript limitations, the tools in the extension callback are typed to the base shape unless the extension type is provided explicitly.
 *
 * @param base The base state instance
 * @returns A function accepting an extension callback with StateFactoryTools typed to the final shape
 */
export function composeState<B>(
  base: StateInstance<B>
): <Ext = unknown>(
  extension: (tools: StateFactoryTools<B & Ext>) => Ext
) => StateInstance<B & Ext> {
  return function <Ext = unknown>(
    extension: (tools: StateFactoryTools<B & Ext>) => Ext
  ): StateInstance<B & Ext> {
    return composeWith(base, extension);
  };
}