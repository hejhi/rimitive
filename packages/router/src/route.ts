/**
 * Route matching utilities and route rendering primitives
 */

import { create } from '@lattice/lattice';
import type { LatticeExtension } from '@lattice/lattice';
import type { RendererConfig, Renderer, RefSpec, Reactive, LifecycleCallback } from '@lattice/view/types';
import type { CreateScopes } from '@lattice/view/helpers/scope';

// Re-export types from ./types for backward compatibility
export type { RouteParams, RouteMatch } from './types';
import type { RouteMatch as RouteMatchType } from './types';

/**
 * Status bit for route specs - next power of 2 after STATUS_COMMENT (16)
 */
const STATUS_ROUTE_SPEC = 32; // 100000

/**
 * Route-specific metadata
 */
interface RouteMetadata<TConfig extends RendererConfig> {
  relativePath: string;
  rebuild: (parentPath: string) => RouteSpec<TConfig['baseElement']>;
}

/**
 * RouteSpec wraps a RefSpec with routing metadata
 * Uses true wrapper pattern - delegates to internal RefSpec via closure
 * Status is ONLY STATUS_ROUTE_SPEC (32) - not combined with STATUS_REF_SPEC
 * The wrapped RefSpec is kept internal and accessed via delegation
 *
 * Note: Does not extend RefSpec to avoid status type conflict.
 * Instead, provides same callable/create interface through delegation.
 */
interface RouteSpec<TElement> {
  status: typeof STATUS_ROUTE_SPEC;
  routeMetadata: RouteMetadata<RendererConfig>;
  // Unwrap method to get the inner RefSpec for renderer
  unwrap(): RefSpec<TElement>;
  (...lifecycleCallbacks: import('@lattice/view/types').LifecycleCallback<TElement>[]): RouteSpec<TElement>;
  create<TExt = Record<string, unknown>>(
    api?: unknown,
    extensions?: TExt
  ): import('@lattice/view/types').NodeRef<TElement> & TExt;
}

/**
 * Compose a parent path with a child path
 *
 * @param parentPath - Parent route path (e.g., '/', '/products')
 * @param childPath - Child route path (e.g., 'about', ':id')
 * @returns Combined path (e.g., '/about', '/products/:id')
 */
const composePath = (parentPath: string, childPath: string): string => {
  // If parent is root, just add a leading slash to child
  if (parentPath === '/') {
    return `/${childPath}`;
  }

  // Otherwise combine with a slash
  return `${parentPath}/${childPath}`;
};

/**
 * Matches a URL path against a route pattern (exact match)
 *
 * Supports exact string matching and path parameters using :paramName syntax
 *
 * @param pattern - Route pattern (e.g., '/', '/about', '/products/:id')
 * @param path - URL path to match against
 * @returns RouteMatch if matched, null otherwise
 */
export const matchPath = (pattern: string, path: string): RouteMatchType | null => {
  // Exact match (no parameters)
  if (pattern === path) {
    return {
      path,
      params: {},
    };
  }

  // Split into segments
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');

  // Must have same number of segments
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  // Match each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];

    if (patternSegment === undefined || pathSegment === undefined) {
      return null;
    }

    // Parameter segment (starts with :)
    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment must match exactly
      return null;
    }
  }

  return {
    path,
    params,
  };
};

/**
 * Matches a URL path against a route pattern (prefix match for parent routes)
 *
 * Used for routes with children - matches if the path starts with the pattern
 *
 * @param pattern - Route pattern (e.g., '/', '/products', '/users/:id')
 * @param path - URL path to match against
 * @returns RouteMatch if matched, null otherwise
 */
const matchPathPrefix = (pattern: string, path: string): RouteMatchType | null => {
  // Exact match
  if (pattern === path) {
    return {
      path,
      params: {},
    };
  }

  // For root pattern, it matches any path
  if (pattern === '/') {
    return {
      path,
      params: {},
    };
  }

  // Split into segments for comparison
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');

  // Path must have at least as many segments as pattern (prefix match)
  if (pathSegments.length < patternSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  // Match each segment of the pattern against the path
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];

    if (patternSegment === undefined || pathSegment === undefined) {
      return null;
    }

    if (patternSegment.startsWith(':')) {
      // Parameter segment - extract the value
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment must match exactly
      return null;
    }
  }

  // All pattern segments matched
  return {
    path,
    params,
  };
};

/**
 * Signal function with both getter and setter
 */
export interface SignalFunction<T> {
  (): T;
  (value: T): void;
  peek(): T;
}

/**
 * Computed function (read-only reactive)
 */
export interface ComputedFunction<T> {
  (): T;
  peek(): T;
}

/**
 * Match function type
 */
export interface MatchFunction<TBaseElement> {
  <T, TElement extends TBaseElement>(
    reactive: Reactive<T>
  ): (matcher: (value: T) => RefSpec<TElement> | null) => RefSpec<TElement>;
}

/**
 * Options passed to route factory
 */
export type RouteOpts<TConfig extends RendererConfig> = {
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
  el: <Tag extends string & keyof TConfig['elements']>(
    tag: Tag,
    props?: Record<string, unknown>
  ) => (...children: unknown[]) => RefSpec<TConfig['elements'][Tag]>;
  match: MatchFunction<TConfig['baseElement']>;
  currentPath: Reactive<string>;
  scopedEffect: CreateScopes['scopedEffect'];
  renderer: Renderer<TConfig>;
  createElementScope: CreateScopes['createElementScope'];
  onCleanup: CreateScopes['onCleanup'];
};

/**
 * Component that receives the API
 */
export type RouteComponent<TConfig extends RendererConfig> = (api: {
  el: RouteOpts<TConfig>['el'];
  params: ComputedFunction<import('./types').RouteParams>;
}) => RefSpec<TConfig['baseElement']>;


/**
 * Route factory type
 */
export type RouteFactory<TConfig extends RendererConfig> = LatticeExtension<
  'route',
  {
    (
      path: string,
      component: RouteComponent<TConfig>
    ): (...children: (RefSpec<TConfig['baseElement']> | RouteSpec<TConfig['baseElement']>)[]) => RouteSpec<TConfig['baseElement']>;
  }
>;

/**
 * Create route factory that handles route matching and rendering
 */
export const createRouteFactory = create(
  <TConfig extends RendererConfig>({
    computed,
    el,
    match,
    currentPath,
  }: RouteOpts<TConfig>) =>
    () => {
      // Shared state for tracking route groups
      // Routes created in the same synchronous tick are considered siblings
      let activeRouteGroup: Array<{
        id: string;
        pathPattern: string;
        matchedPath: ComputedFunction<RouteMatchType | null>;
      }> | null = null;
      let groupCreationDepth = 0;

      function route(
        path: string,
        component: RouteComponent<TConfig>
      ): (...children: (RefSpec<TConfig['baseElement']> | RouteSpec<TConfig['baseElement']>)[]) => RouteSpec<TConfig['baseElement']> {
        return (..._children: (RefSpec<TConfig['baseElement']> | RouteSpec<TConfig['baseElement']>)[]) => {
          // Store the original path before processing
          const relativePath = path;

          // Only process children if this route's path starts with '/' (it's been composed)
          // Otherwise, store them unprocessed for later rebuilding by parent
          const isComposedRoute = path.startsWith('/');

          const processedChildren: RefSpec<TConfig['baseElement']>[] = [];

          if (isComposedRoute) {
            // This route has been composed by a parent, so process its children
            // Save and reset route group context to prevent children from being
            // siblings with the parent route
            const savedRouteGroup = activeRouteGroup;
            const savedGroupDepth = groupCreationDepth;

            for (const child of _children) {
              // Check if this child is a RouteSpec using status bit
              const isRouteSpec = (child.status & STATUS_ROUTE_SPEC) === STATUS_ROUTE_SPEC;

              if (isRouteSpec) {
                const routeSpec = child as RouteSpec<TConfig['baseElement']>;
                const metadata = routeSpec.routeMetadata;

                // Reset route group so children form their own group
                activeRouteGroup = null;
                groupCreationDepth = 0;

                // This is a route child - rebuild with composed path, then unwrap
                const composedPath = composePath(path, metadata.relativePath);
                const rebuiltRouteSpec = metadata.rebuild(composedPath);
                // Unwrap to get the inner RefSpec for the renderer
                processedChildren.push(rebuiltRouteSpec.unwrap());
              } else {
                // Regular child (not a route) - keep as-is
                // TypeScript doesn't narrow the union here, so cast to RefSpec
                processedChildren.push(child as RefSpec<TConfig['baseElement']>);
              }
            }

            // Restore the route group
            activeRouteGroup = savedRouteGroup;
            groupCreationDepth = savedGroupDepth;
          }

          // Determine if this route has children
          const hasChildren = isComposedRoute && processedChildren.length > 0;

          // Determine if this route is part of a group or standalone
          const isFirstInGroup = activeRouteGroup === null;

          if (isFirstInGroup) {
            // Create a new group
            activeRouteGroup = [];
            groupCreationDepth = 0;
          }

          // This route's position in the group
          const routeIndex = groupCreationDepth++;
          const routeId = `route-${routeIndex}`;

          // Keep a reference to the current group (guaranteed non-null here)
          const myRoutes = activeRouteGroup as Array<{
            id: string;
            pathPattern: string;
            matchedPath: ComputedFunction<RouteMatchType | null>;
          }>;

          // Compute whether this route matches
          // Use prefix matching if route has children, exact matching otherwise
          const matchedPath = computed(() => {
            const current = currentPath();
            return hasChildren ? matchPathPrefix(path, current) : matchPath(path, current);
          });

          // Register this route in the group
          myRoutes.push({
            id: routeId,
            pathPattern: path,
            matchedPath,
          });

          // Reset group after this synchronous call stack completes
          // but only if this was the first route in the group
          if (isFirstInGroup) {
            queueMicrotask(() => {
              activeRouteGroup = null;
              groupCreationDepth = 0;
            });
          }

          // Compute whether this route should render
          // Only renders if it's the first matching route in its group
          const shouldRender = computed(() => {
            // Trigger reactivity on path changes
            currentPath();

            // Find the first matching route
            for (const r of myRoutes) {
              const match = r.matchedPath.peek();
              if (match !== null) {
                // Only render if this is THE matching route
                return r.id === routeId ? match : null;
              }
            }

            return null;
          });

          // Create the base RefSpec from match(...)
          const baseRefSpec = match(shouldRender)((pathMatch) => {
            if (pathMatch === null) {
              return null;
            }

            // Create params signal from the matched path
            const params = computed(() => {
              const match = shouldRender();
              return match?.params ?? {};
            });

            // Render component with processed children
            const componentResult = component({ el, params });

            // If there are children, we need to compose them with the component result
            if (processedChildren.length > 0) {
              // The component should render, and children should be included in the tree
              // For now, we'll assume the component handles children via its own rendering
              // But we need to make sure children are part of the render tree
              // This is a bit tricky - we need to combine the component with its nested children

              // Return a fragment-like structure that includes both component and children
              // We'll use el() to wrap them if needed
              return el('div' as never)(componentResult, ...processedChildren) as RefSpec<TConfig['baseElement']>;
            }

            return componentResult;
          });

          // Create true wrapper that delegates to baseRefSpec via closure
          // No mutation - full ownership through closure
          const routeSpec: RouteSpec<TConfig['baseElement']> = (
            ...lifecycleCallbacks: LifecycleCallback<TConfig['baseElement']>[]
          ) => {
            // Delegate to base spec and return this wrapper for chaining
            baseRefSpec(...lifecycleCallbacks);
            return routeSpec;
          };

          // Set properties - no mutation, we own this object
          routeSpec.status = STATUS_ROUTE_SPEC;
          routeSpec.routeMetadata = {
            relativePath,
            rebuild: (parentPath: string) => route(parentPath, component)(..._children),
          };

          // Unwrap method returns the wrapped RefSpec
          routeSpec.unwrap = () => baseRefSpec;

          // Delegate create method to base spec
          routeSpec.create = <TExt = Record<string, unknown>>(
            api?: unknown,
            extensions?: TExt
          ) => {
            return baseRefSpec.create(api, extensions);
          };

          return routeSpec;
        };
      }

      const extension: RouteFactory<TConfig> = {
        name: 'route' as const,
        method: route,
      };

      return extension;
    }
);
