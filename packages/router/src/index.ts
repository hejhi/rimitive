/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { createRouteFactory } from './route';
export { createLinkFactory } from './link';
export { matchPath } from './helpers/matching';
export type {
  RouteParams,
  RouteMatch,
  RouteOpts,
  RouteComponent,
  RouteFactory,
  LinkOpts,
  LinkFactory,
} from './types';
