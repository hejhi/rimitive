/**
 * Island Wrapper - Browser version
 *
 * Client-side version that skips SSR context logic entirely.
 * Creates a wrapper with metadata for the hydrator.
 */

import type { RefSpec } from '@lattice/view/types';
import type { IslandComponent, IslandStrategy } from './types';
import { ISLAND_META } from './types';

export function island<TProps>(
  id: string,
  component: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategy: IslandStrategy<TProps>,
  component: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps>;

export function island<TProps>(
  id: string,
  strategyOrComponent: IslandStrategy<TProps> | ((props: TProps) => RefSpec<unknown>),
  maybeComponent?: (props: TProps) => RefSpec<unknown>
): IslandComponent<TProps> {
  const component =
    maybeComponent ||
    (strategyOrComponent as (props: TProps) => RefSpec<unknown>);
  const strategy = maybeComponent ? strategyOrComponent : undefined;

  // Create wrapper function instead of mutating the input component
  const wrapper: IslandComponent<TProps> = (props: TProps) => component(props);

  // Attach metadata to wrapper (temporary - only for registry construction)
  // Includes component reference for unwrapping at registry boundary
  Object.defineProperty(wrapper, ISLAND_META, {
    value: { id, strategy, component },
    enumerable: false,
  });

  return wrapper;
}
