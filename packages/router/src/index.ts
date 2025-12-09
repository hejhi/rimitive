/**
 * @lattice/router
 *
 * Minimal routing for Lattice applications
 *
 * The router is pure reactive state - it provides:
 * - matches: Signal<MatchedRoute[]> - currently matched routes
 * - currentPath: Signal<string> - current URL path
 * - navigate(path): void - navigation function
 *
 * The view layer uses match() to render based on router.matches().
 * Router does not create elements or manage rendering.
 */

// New minimal router API
export { createRouter } from './router';
export type {
  Router,
  RouterDeps,
  RouterOptions,
  RouteConfig,
  MatchedRoute,
} from './router';

// Link component
export { Link } from './link';

// Location utilities
export { createLocationFactory } from './location';

// Path matching utilities
export { matchPath, matchPathPrefix, composePath } from './deps/matching';

// Types
export type {
  RouteParams,
  RouteMatch,
  LinkOpts,
  LinkFunction,
  LocationSvc,
  LocationOpts,
  LocationFactory,
} from './types';

// Legacy exports for backwards compatibility (deprecated)
// TODO: Remove in next major version
export { createRouter as createLegacyRouter, connect } from './createRouter';
export { defineRoutes } from './defineRoutes';
export { STATUS_ROUTE_SPEC } from './types';
export type { RouteSpec, RouteMetadata, MatchFunction } from './types';
export type {
  ViewSvc,
  RouterConfig,
  Router as LegacyRouter,
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
