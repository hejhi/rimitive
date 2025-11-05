/**
 * Create extension - instantiates RefSpecs with the API
 */

import type { LatticeExtension } from '@lattice/lattice';
import type { RefSpec, NodeRef } from './types';
import type { LatticeViewAPI } from './component';
import type { Element as RendererElement } from './renderer';

export interface CreateOpts<TElement extends RendererElement> {
  api: LatticeViewAPI<TElement>;
}

export type CreateFactory<TElement extends RendererElement> = LatticeExtension<
  'create',
  <T extends RefSpec<TElement>>(spec: T) => NodeRef<TElement>
>;

export function createCreateFactory<TElement extends RendererElement>(
  opts: CreateOpts<TElement>
): CreateFactory<TElement> {
  const { api } = opts;

  return {
    name: 'create',
    method: <T extends RefSpec<TElement>>(spec: T): NodeRef<TElement> => {
      // Uniform interface - just pass the API
      return spec.create(api);
    }
  };
}
