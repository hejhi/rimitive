/**
 * @rimitive/router
 *
 * Minimal routing for Rimitive applications
 *
 * The router is pure reactive state - it provides:
 * - matches: Signal<MatchedRoute[]> - currently matched routes
 * - currentPath: Signal<string> - current URL path
 * - navigate(path): void - navigation function
 *
 * The view layer uses match() to render based on router.matches().
 * Router does not create elements or manage rendering.
 */

// New minimal router API - Module pattern
export { createRouter, createRouterModule } from './router';
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
export { matchPath, matchPathPrefix, composePath } from './helpers/matching';

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

export type { Route, RouteMetadata, MatchFunction } from './types';
