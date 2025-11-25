/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { Link } from './link';
export { createLocationFactory } from './location';
export { matchPath } from './helpers/matching';
export { createRouter } from './createRouter';
export type {
  RouteParams,
  RouteMatch,
  LinkOpts,
  LinkFactory,
  LocationAPI,
  LocationOpts,
  LocationFactory,
} from './types';
export type {
  ViewApi,
  RouterConfig,
  Router,
  RouteMethod,
  RootMethod,
  RootContext,
  ConnectMethod,
  RouteApi,
  RouteContext,
  ConnectedComponent,
} from './createRouter';
