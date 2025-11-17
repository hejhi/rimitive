/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { matchPath, createRouteFactory } from './route';
export type {
  RouteParams,
  RouteMatch,
} from './types';
export type {
  RouteOpts,
  RouteComponent,
  RouteFactory,
} from './route';
