/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { createRouteFactory } from './route';
export { createLinkFactory } from './link';
export { createLocationFactory } from './location';
export { matchPath } from './helpers/matching';
export type {
  RouteParams,
  RouteMatch,
  RouteOpts,
  RouteComponent,
  RouteFactory,
  LinkOpts,
  LinkFactory,
  LocationAPI,
  LocationOpts,
  LocationFactory,
} from './types';
