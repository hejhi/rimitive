/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { createRouteFactory } from './route';
export { matchPath } from './helpers/matching';
export type {
  RouteParams,
  RouteMatch,
  RouteOpts,
  RouteComponent,
  RouteFactory,
} from './types';
