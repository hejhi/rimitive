/**
 * Minimal Router - Pure Reactive State
 *
 * The router is just a reactive state container that:
 * 1. Tracks current path as a signal
 * 2. Matches path against route definitions
 * 3. Provides navigate() to change path
 *
 * It does NOT:
 * - Create or manage DOM elements
 * - Handle rendering lifecycle
 * - "Mount" or "attach" to anything
 *
 * The view layer uses match() to render based on router.matches().
 */

import type { Readable, Writable } from '@lattice/view/types';
import { matchPath, matchPathPrefix } from './deps/matching';

/**
 * Route configuration - pure data, no components
 */
export type RouteConfig = {
  /** Unique identifier for this route */
  id: string;
  /** Path pattern (e.g., '/', '/products', '/products/:id') */
  path: string;
  /** Child routes for nested matching */
  children?: RouteConfig[];
};

/**
 * A matched route with its extracted parameters
 */
export type MatchedRoute = {
  /** Route ID from config */
  id: string;
  /** Path pattern that matched */
  pattern: string;
  /** Extracted parameters (e.g., { id: '123' }) */
  params: Record<string, string>;
  /** The actual path that was matched */
  path: string;
};

/**
 * Router instance - reactive state + navigation
 */
export type Router = {
  /**
   * Reactive signal of currently matched routes (parent -> child hierarchy)
   * Empty array if no routes match (404)
   */
  matches: Readable<MatchedRoute[]>;

  /**
   * Current path as a reactive signal
   */
  currentPath: Readable<string>;

  /**
   * Navigate to a new path
   */
  navigate: (path: string) => void;

  /**
   * Navigate back in history
   */
  back: () => void;

  /**
   * Navigate forward in history
   */
  forward: () => void;
};

/**
 * Router configuration
 */
export type RouterOptions = {
  /**
   * Initial path (for SSR or testing)
   * Defaults to window.location on client
   */
  initialPath?: string;
};

/**
 * Dependencies for creating the router
 * These come from the signals module
 */
export type RouterDeps = {
  signal: <T>(value: T) => Writable<T>;
  computed: <T>(fn: () => T) => Readable<T>;
};

/**
 * Get initial path from browser or config
 */
function getInitialPath(options: RouterOptions): string {
  if (options.initialPath !== undefined) {
    return options.initialPath;
  }

  if (typeof window !== 'undefined' && window.location) {
    return (
      window.location.pathname + window.location.search + window.location.hash
    );
  }

  return '/';
}

/**
 * Strip query string and hash from path for matching
 */
function getPathname(path: string): string {
  const queryIndex = path.indexOf('?');
  const hashIndex = path.indexOf('#');
  let end = path.length;

  if (queryIndex !== -1 && queryIndex < end) end = queryIndex;
  if (hashIndex !== -1 && hashIndex < end) end = hashIndex;

  return path.slice(0, end);
}

/**
 * Match a path against routes, returning the hierarchy of matches
 */
function matchRoutes(
  routes: RouteConfig[],
  pathname: string,
  parentPath: string = ''
): MatchedRoute[] {
  for (const route of routes) {
    // Build full path pattern
    const fullPattern =
      parentPath === '/'
        ? route.path === ''
          ? '/'
          : `/${route.path}`
        : parentPath === ''
          ? route.path === ''
            ? '/'
            : `/${route.path}`
          : route.path === ''
            ? parentPath
            : `${parentPath}/${route.path}`;

    const hasChildren = route.children && route.children.length > 0;

    // Use prefix matching if route has children, exact matching otherwise
    const match = hasChildren
      ? matchPathPrefix(fullPattern, pathname)
      : matchPath(fullPattern, pathname);

    if (match) {
      const matchedRoute: MatchedRoute = {
        id: route.id,
        pattern: fullPattern,
        params: match.params,
        path: match.path,
      };

      // If has children, try to match them too
      if (hasChildren && route.children) {
        const childMatches = matchRoutes(route.children, pathname, fullPattern);
        return [matchedRoute, ...childMatches];
      }

      return [matchedRoute];
    }
  }

  return [];
}

/**
 * Create a router instance
 *
 * @param deps - Signal primitives from @lattice/signals
 * @param routes - Route configuration (pure data)
 * @param options - Router options
 *
 * @example
 * ```typescript
 * import { createRouter } from '@lattice/router';
 *
 * const routes = [
 *   { id: 'home', path: '' },
 *   { id: 'about', path: 'about' },
 *   { id: 'products', path: 'products', children: [
 *     { id: 'product-detail', path: ':id' }
 *   ]}
 * ];
 *
 * const router = createRouter({ signal, computed }, routes);
 *
 * // Use in view layer
 * match(router.matches, (matches) => {
 *   const route = matches[0];
 *   if (!route) return NotFound();
 *   return componentMap[route.id]({ params: route.params });
 * });
 * ```
 */
export function createRouter(
  deps: RouterDeps,
  routes: RouteConfig[],
  options: RouterOptions = {}
): Router {
  const { signal, computed } = deps;

  // Internal writable signal for current path
  const pathSignal = signal<string>(getInitialPath(options));

  // Public read-only computed
  const currentPath = computed(() => pathSignal());

  // Computed matches - recomputes when path changes
  const matches = computed(() => {
    const path = pathSignal();
    const pathname = getPathname(path);
    return matchRoutes(routes, pathname);
  });

  // Navigation function
  function navigate(path: string): void {
    pathSignal(path);

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', path);
    }
  }

  // History navigation
  function back(): void {
    if (typeof window !== 'undefined' && window.history) {
      window.history.back();
    }
  }

  function forward(): void {
    if (typeof window !== 'undefined' && window.history) {
      window.history.forward();
    }
  }

  // Listen to popstate for back/forward buttons
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const fullPath =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      pathSignal(fullPath);
    });
  }

  return {
    matches,
    currentPath,
    navigate,
    back,
    forward,
  };
}
