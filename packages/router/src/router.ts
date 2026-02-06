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

import { defineConfigurableModule } from '@rimitive/core';
import type { SignalFactory, ComputedFactory } from '@rimitive/signals/extend';
import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
import { matchPath, matchPathPrefix } from './helpers/matching';
import { Readable, Writable } from '@rimitive/signals';

// =============================================================================
// Navigation API Types (not yet in standard TypeScript lib)
// =============================================================================

declare global {
  interface Window {
    navigation?: {
      currentEntry: { index: number } | null;
      addEventListener(
        type: 'navigate',
        listener: (event: NavigateEvent) => void
      ): void;
    };
  }

  interface NavigateEvent extends Event {
    navigationType: 'push' | 'replace' | 'reload' | 'traverse';
    destination: { index: number; url: string };
  }
}

/**
 * Navigation direction for page transitions
 */
export type NavigationDirection = 'forward' | 'back';

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
   * @param path - The path to navigate to
   * @param direction - Optional direction hint for animations (defaults to 'forward')
   */
  navigate: (path: string, direction?: NavigationDirection) => void;

  /**
   * Navigate back in history
   */
  back: () => void;

  /**
   * Navigate forward in history
   */
  forward: () => void;

  // Location - reactive access to URL components

  /**
   * Reactive pathname (path without query string or hash)
   * e.g., "/products/123"
   */
  pathname: Readable<string>;

  /**
   * Reactive search/query string (including leading '?')
   * e.g., "?sort=price&filter=new"
   */
  search: Readable<string>;

  /**
   * Reactive hash (including leading '#')
   * e.g., "#section-1"
   */
  hash: Readable<string>;

  /**
   * Reactive parsed query parameters
   * e.g., { sort: "price", filter: "new" }
   */
  query: Readable<Record<string, string>>;

  // Navigation state for transitions

  /**
   * Direction of the last navigation ('forward' or 'back')
   * Useful for page transition animations
   */
  direction: Readable<NavigationDirection>;

  /**
   * Whether this is the initial page load (no previous navigation)
   * Useful to skip entrance animations on first render
   */
  isInitial: Readable<boolean>;
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

  /**
   * Called before each navigation with the target path.
   * Useful for prefetching data in parallel with route chunk loading.
   * If it returns a Promise, the promise is NOT awaited (fire-and-forget).
   */
  onNavigate?: (path: string) => void | Promise<void>;
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
 * Parse URL into components
 */
function parseURL(url: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  // Find hash first (everything after #)
  const hashIndex = url.indexOf('#');
  const hash = hashIndex !== -1 ? url.slice(hashIndex) : '';
  const urlWithoutHash = hashIndex !== -1 ? url.slice(0, hashIndex) : url;

  // Find query string (everything after ?)
  const searchIndex = urlWithoutHash.indexOf('?');
  const search = searchIndex !== -1 ? urlWithoutHash.slice(searchIndex) : '';
  const pathname =
    searchIndex !== -1 ? urlWithoutHash.slice(0, searchIndex) : urlWithoutHash;

  return { pathname, search, hash };
}

/**
 * Parse query string into object
 * e.g., "?sort=price&filter=new" -> { sort: "price", filter: "new" }
 */
function parseQueryString(search: string): Record<string, string> {
  if (!search || search === '?') {
    return {};
  }

  // Remove leading '?' if present
  const queryString = search.startsWith('?') ? search.slice(1) : search;

  const params: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    if (!pair) continue;

    const equalsIndex = pair.indexOf('=');
    if (equalsIndex === -1) {
      // No '=' means param without value
      params[pair] = '';
    } else {
      const key = pair.slice(0, equalsIndex);
      const value = pair.slice(equalsIndex + 1);
      params[key] = value;
    }
  }

  return params;
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
 * @param deps - Signal primitives from @rimitive/signals
 * @param routes - Route configuration (pure data)
 * @param options - Router options
 *
 * @example
 * ```typescript
 * import { createRouter } from '@rimitive/router';
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

  // Navigation state signals
  const directionSignal = signal<NavigationDirection>('forward');
  const isInitialSignal = signal(true);

  // Public read-only computed
  const currentPath = computed(() => pathSignal());
  const direction = computed(() => directionSignal());
  const isInitial = computed(() => isInitialSignal());

  // Computed matches - recomputes when path changes
  const matches = computed(() => {
    const path = pathSignal();
    const pathname = getPathname(path);
    return matchRoutes(routes, pathname);
  });

  // Navigation function
  function navigate(
    path: string,
    navDirection: NavigationDirection = 'forward'
  ): void {
    if (path === pathSignal()) return;

    // Fire onNavigate before updating path signal (fire-and-forget)
    options.onNavigate?.(path);

    directionSignal(navDirection);
    isInitialSignal(pathSignal() === '');

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', path);
    }

    pathSignal(path);
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

  // Listen for browser-initiated navigation (back/forward buttons)
  // Uses Navigation API for direction detection with popstate fallback
  if (typeof window !== 'undefined') {
    const nav = window.navigation;

    if (nav) {
      // Navigation API - can detect actual direction
      nav.addEventListener('navigate', (event: NavigateEvent) => {
        if (event.navigationType === 'traverse') {
          const currentIndex = nav.currentEntry?.index ?? 0;
          const destinationIndex = event.destination.index;
          const newDirection: NavigationDirection =
            destinationIndex < currentIndex ? 'back' : 'forward';
          const newPath = new URL(event.destination.url).pathname;

          if (newPath === pathSignal()) return;

          directionSignal(newDirection);
          isInitialSignal(false);
          pathSignal(newPath);
        }
      });
    } else {
      // Fallback for browsers without Navigation API
      window.addEventListener('popstate', () => {
        const fullPath =
          window.location.pathname +
          window.location.search +
          window.location.hash;

        if (fullPath === pathSignal()) return;

        // Cannot determine direction without Navigation API, default to 'back'
        directionSignal('back');
        isInitialSignal(false);
        pathSignal(fullPath);
      });
    }
  }

  // Location - reactive URL components
  const pathname = computed(() => parseURL(pathSignal()).pathname);
  const search = computed(() => parseURL(pathSignal()).search);
  const hash = computed(() => parseURL(pathSignal()).hash);
  const query = computed(() => parseQueryString(parseURL(pathSignal()).search));

  return {
    matches,
    currentPath,
    navigate,
    back,
    forward,
    pathname,
    search,
    hash,
    query,
    direction,
    isInitial,
  };
}

/**
 * Router configuration for RouterModule
 */
export type RouterConfig = {
  routes: RouteConfig[];
  initialPath?: string;
  onNavigate?: (path: string) => void | Promise<void>;
};

/**
 * Router module for use with compose().
 *
 * Requires configuration via .with() before composing.
 * Use RouterModule.module in dependency arrays to declare dependency.
 *
 * @example
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule } from '@rimitive/signals/extend';
 * import { RouterModule } from '@rimitive/router';
 *
 * const routes = [
 *   { id: 'home', path: '' },
 *   { id: 'about', path: 'about' },
 *   { id: 'products', path: 'products', children: [
 *     { id: 'product-detail', path: ':id' }
 *   ]}
 * ];
 *
 * const svc = compose(
 *   SignalModule,
 *   ComputedModule,
 *   RouterModule.with({ routes, initialPath: '/' })
 * );
 *
 * // Router is now part of the composed context
 * const { router, signal, computed } = svc;
 *
 * // Use in view layer
 * match(router.matches, (matches) => {
 *   const route = matches[0];
 *   if (!route) return NotFound();
 *   return componentMap[route.id]({ params: route.params });
 * });
 * ```
 *
 * @example Declaring dependency on router
 * ```typescript
 * import { defineModule } from '@rimitive/core';
 * import { RouterModule } from '@rimitive/router';
 *
 * const NavigationModule = defineModule({
 *   name: 'nav',
 *   dependencies: [RouterModule.module],  // Use .module for dependency
 *   create: ({ router }) => ({
 *     goHome: () => router.navigate('/'),
 *   }),
 * });
 * ```
 */
export const RouterModule = defineConfigurableModule({
  name: 'router' as const,
  dependencies: [SignalModule, ComputedModule],
  create: (
    { signal, computed }: { signal: SignalFactory; computed: ComputedFactory },
    config: RouterConfig
  ): Router =>
    createRouter({ signal, computed }, config.routes, {
      initialPath: config.initialPath,
      onNavigate: config.onNavigate,
    }),
});
