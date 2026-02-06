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

// Router - Configurable module pattern
export { createRouter, RouterModule } from './router';
export type {
  Router,
  RouterConfig,
  RouterDeps,
  RouterOptions,
  RouteConfig,
  MatchedRoute,
  NavigationDirection,
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
