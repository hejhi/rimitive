/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Just attaches metadata for the hydrator.
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
  const strategy = maybeComponent ? (strategyOrComponent as IslandStrategy<TProps>) : undefined;

  // Browser version: just return the component with metadata
  // No SSR context interaction
  const wrapper = component as IslandComponent<TProps>;

  // Attach metadata for hydrator
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy } as IslandMetaData<TProps>,
    enumerable: false,
  });

  return wrapper;
}
