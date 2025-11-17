/**
 * Route matching utilities and route rendering primitives
 */

import { create } from '@lattice/lattice';
import type { LatticeExtension } from '@lattice/lattice';
import type { RefSpec, Reactive } from '@lattice/view/types';
import type { RendererConfig } from '../../view/src/renderer';
import type { Renderer } from '../../view/src/renderer';
import type { CreateScopes } from '../../view/src/helpers/scope';

// Re-export types from ./types for backward compatibility
export type { RouteParams, RouteMatch, RouteConfig } from './types';
import type { RouteMatch as RouteMatchType } from './types';

/**
 * Matches a URL path against a route pattern
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
}) => RefSpec<TConfig['baseElement']>;

/**
 * Route configuration options
 */
export type RouteConfigOptions = import('./types').RouteConfig;

/**
 * Route factory type
 */
export type RouteFactory<TConfig extends RendererConfig> = LatticeExtension<
  'route',
  {
    (
      path: string,
      component: RouteComponent<TConfig>
    ): (config?: RouteConfigOptions) => RefSpec<TConfig['baseElement']>;
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
      ): (config?: RouteConfigOptions) => RefSpec<TConfig['baseElement']> {
        return () => {
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
          const matchedPath = computed(() => {
            const current = currentPath();
            return matchPath(path, current);
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

          return match(shouldRender)((pathMatch) => {
            if (pathMatch === null) {
              return null;
            }
            return component({ el });
          });
        };
      }

      const extension: RouteFactory<TConfig> = {
        name: 'route' as const,
        method: route,
      };

      return extension;
    }
);
