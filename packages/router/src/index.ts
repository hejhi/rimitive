/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { Link } from './link';
export { createLocationFactory } from './location';
export { matchPath } from './helpers/matching';
export { createRouter, connect } from './createRouter';
export { defineRoutes } from './defineRoutes';
export type {
  RouteParams,
  RouteMatch,
  LinkOpts,
  LinkFactory,
  LocationSvc,
  LocationOpts,
  LocationFactory,
} from './types';
export type {
  ViewSvc,
  RouterConfig,
  Router,
  RouteMethod,
  RootMethod,
  RootContext,
  ConnectMethod,
  ConnectedSvc,
  RouteSvc,
  RouteContext,
  ConnectedComponent,
} from './createRouter';
export type {
  RouteTree,
  RouteNode,
  RouteBuilder,
  DefineRoutesContext,
} from './defineRoutes';
