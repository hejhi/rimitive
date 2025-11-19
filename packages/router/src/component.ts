/**
 * Component creation helper for route components
 *
 * Similar to @lattice/view/component but specifically typed for route components
 * that receive the route API including outlet, params, navigate, etc.
 */

import { create as baseCreate } from '@lattice/view/component';
import type { RouteOpts } from './types';
import type { RefSpec, RendererConfig, SealedSpec } from '@lattice/view/types';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import type { ComputedFunction, RouteParams } from './types';

/**
 * Route component API type
 * Includes all RouteOpts plus route-specific additions
 */
export type RouteComponentApi<TConfig extends RendererConfig> = RouteOpts<TConfig> & {
  params: ComputedFunction<RouteParams>;
  outlet: () => RefSpec<TConfig['baseElement']> | null;
  navigate: (path: string) => void;
};

/**
 * Create a route component that receives the route API at instantiation time
 *
 * Route components created with this function receive:
 * - All view helpers (el, match, show, computed, signal, etc.)
 * - Route-specific helpers (params, outlet, navigate)
 *
 * @example
 * ```ts
 * export const MyRoute = createRouteComponent(({ el, outlet, params }) => () => {
 *   return el('div')(
 *     el('h1')(computed(() => `Product ${params().id}`)),
 *     outlet()
 *   );
 * })();
 * ```
 */
export function createRouteComponent<TConfig extends RendererConfig = DOMRendererConfig, TArgs extends unknown[] = []>(
  factory: (api: RouteComponentApi<TConfig>) => (...args: TArgs) => RefSpec<TConfig['baseElement']>
): (...args: TArgs) => SealedSpec<TConfig['baseElement']> {
  return baseCreate<TArgs, RouteComponentApi<TConfig>>(factory) as (...args: TArgs) => SealedSpec<TConfig['baseElement']>;
}
