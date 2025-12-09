/**
 * @lattice/router
 *
 * Minimal client-side routing for Lattice applications
 */

export { Link } from './link';
export { createLocationFactory } from './location';
export { matchPath } from './deps/matching';
export { createRouter, connect } from './createRouter';
export { defineRoutes } from './defineRoutes';
export type {
  RouteParams,
  RouteMatch,
  RouteSpec,
  RouteMetadata,
  LinkOpts,
  LinkFunction,
  LocationSvc,
  LocationOpts,
  LocationFactory,
  MatchFunction,
} from './types';

export { STATUS_ROUTE_SPEC } from './types';
export type {
  ViewSvc,
  RouterConfig,
  Router,
  RouteMethod,
  RootMethod,
  RootContext,
  ConnectMethod,
  ConnectedSvc,
  ConnectedContext,
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
