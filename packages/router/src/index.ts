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
  ConnectedApi,
  RouteApi,
  RouteContext,
  ConnectedComponent,
} from './createRouter';
export type {
  RouteTree,
  RouteNode,
  RouteBuilder,
  DefineRoutesContext,
} from './defineRoutes';
