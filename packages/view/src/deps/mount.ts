/**
 * Mount helper - creates a RefSpec into a NodeRef
 *
 * Used to instantiate the root component of an application.
 */

import { defineModule } from '@rimitive/core';
import type { RefSpec, NodeRef } from '../types';

/**
 * Mount function type - creates a RefSpec into a NodeRef
 */
export type MountFactory = <TElement>(
  spec: RefSpec<TElement>
) => NodeRef<TElement>;

/**
 * Create a mount factory
 *
 * @example
 * ```typescript
 * const mount = createMount();
 * const app = mount(App());
 * document.body.appendChild(app.element);
 * ```
 */
export const createMount = (): MountFactory => {
  return <TElement>(spec: RefSpec<TElement>): NodeRef<TElement> => {
    return spec.create();
  };
};

/**
 * Mount module - provides the mount helper for instantiating components.
 * No dependencies - mount just calls spec.create().
 */
export const MountModule = defineModule({
  name: 'mount',
  create: createMount,
});
