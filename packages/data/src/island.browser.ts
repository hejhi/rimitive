/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 */

import type { SealedSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy, IslandMetaData } from './types';
import { ISLAND_META } from './types';

export function island<TProps>(
  id: string,
  component: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategy: IslandStrategy<TProps>,
  component: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => SealedSpec<unknown>),
  maybeComponent?: (props: TProps) => SealedSpec<unknown>
): IslandComponent<TProps> {
  const component = maybeComponent || (strategyOrComponent as (props: TProps) => SealedSpec<unknown>);
  const strategy = maybeComponent ? strategyOrComponent : undefined;

  // Create wrapper function instead of mutating the input component
  const wrapper = ((props: TProps) => component(props)) as IslandComponent<TProps>;

  // Attach metadata to wrapper (temporary - only for registry construction)
  // Includes component reference for unwrapping at registry boundary
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component } as IslandMetaData<TProps>,
    enumerable: false,
  });

  return wrapper;
}
