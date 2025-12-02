/**
 * Route matching utilities and route rendering primitives
 */

import { defineService } from '@lattice/lattice';
import type { AdapterConfig, RefSpec } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';

// Import types
import type {
  RouteSpec,
  RouteOpts,
  RouteComponent,
  RouteFactory,
  ComputedFunction,
  RouteMatch,
} from './types';
import { STATUS_ROUTE_SPEC as STATUS_ROUTE_SPEC_CONST } from './types';

// Import matching utilities
import { composePath, matchPath, matchPathPrefix } from './helpers/matching';

// Import SSR context for environment detection
import { getActiveRouterContext } from './ssr-context';

// Re-export for backward compatibility and public API
export { matchPath } from './helpers/matching';

/**
 * Create route factory that handles route matching and rendering
 */
export const createRouteFactory = defineService(
  <TConfig extends AdapterConfig>(routeOpts: RouteOpts<TConfig>) =>
    () => {
      const { computed, el, match, currentPath } = routeOpts;
      // Create navigate function that updates path and history
      const navigate = (path: string): void => {
        currentPath(path);

        const ssrContext = getActiveRouterContext();
        if (!ssrContext) {
          // Client only: update browser history
          window.history.pushState({}, '', path);
        }
        // Server: no-op for history (currentPath already updated)
      };

      // Shared state for tracking route groups
      // Routes created in the same synchronous tick are considered siblings
      let activeRouteGroup: Array<{
        id: string;
        pathPattern: string;
        matchedPath: ComputedFunction<RouteMatch | null>;
      }> | null = null;
      let groupCreationDepth = 0;

      function route(path: string, component: RouteComponent<TConfig>) {
        return (
          ...children: (
            | RefSpec<TConfig['baseElement']>
            | RouteSpec<TConfig['baseElement']>
          )[]
        ) => {
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

            for (const child of children) {
              // Check if this child is a RouteSpec using status bit
              const isRouteSpec =
                (child.status & STATUS_ROUTE_SPEC_CONST) ===
                STATUS_ROUTE_SPEC_CONST;

              if (isRouteSpec) {
                const routeSpec = child as RouteSpec<TConfig['baseElement']>;
                const metadata = routeSpec.routeMetadata;

                // Reset route group so children form their own group
                activeRouteGroup = null;
                groupCreationDepth = 0;

                // This is a route child - rebuild with composed path, then unwrap
                const composedPath = composePath(path, metadata.relativePath);
                const rebuiltRouteSpec = metadata.rebuild(composedPath);
                // Unwrap to get the inner RefSpec for the adapter
                processedChildren.push(rebuiltRouteSpec.unwrap());
              } else {
                // Regular child (not a route) - keep as-is
                // TypeScript doesn't narrow the union here, so cast to RefSpec
                processedChildren.push(
                  child as RefSpec<TConfig['baseElement']>
                );
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
            matchedPath: ComputedFunction<RouteMatch | null>;
          }>;

          // Compute whether this route matches
          // Use prefix matching if route has children, exact matching otherwise
          const matchedPath = computed(() => {
            const current = currentPath();
            return hasChildren
              ? matchPathPrefix(path, current)
              : matchPath(path, current);
          });

          // Register this route in the group
          myRoutes.push({
            id: routeId,
            pathPattern: path,
            matchedPath,
          });

          // Compute whether this route should render
          // Only renders if it's the first matching route in its group
          // Wildcards are always checked last
          const shouldRender = computed(() => {
            // Trigger reactivity on path changes
            currentPath();

            // Separate routes into wildcard and non-wildcard
            const wildcardRoutes: typeof myRoutes = [];
            const normalRoutes: typeof myRoutes = [];

            for (const r of myRoutes) {
              if (r.pathPattern === '*') {
                wildcardRoutes.push(r);
              } else {
                normalRoutes.push(r);
              }
            }

            // Check if any normal route matches
            let normalRouteMatched = false;
            for (const r of normalRoutes) {
              const match = r.matchedPath.peek();
              if (match !== null) {
                normalRouteMatched = true;
                // Only render if this is THE matching route
                return r.id === routeId ? match : null;
              }
            }

            // Only check wildcard routes if no normal route matched
            if (!normalRouteMatched) {
              for (const r of wildcardRoutes) {
                const match = r.matchedPath.peek();
                if (match !== null) {
                  // Only render if this is THE matching wildcard route
                  return r.id === routeId ? match : null;
                }
              }
            }

            return null;
          });

          // Create outlet function that renders the matched child
          const outlet = (): RefSpec<TConfig['baseElement']> | null => {
            // If there are no children, outlet returns null
            if (processedChildren.length === 0) {
              return null;
            }

            // Wrap children in a match() to make them reactive
            // This allows the outlet to update when the path changes
            return match(shouldRender)(() => {
              // Find the first child that's currently matched
              // Since processedChildren are already wrapped in match(),
              // they will handle their own visibility
              // We just need to render all of them and let them decide
              return el('div' as never)(...processedChildren) as RefSpec<
                TConfig['baseElement']
              >;
            });
          };

          // Use match() to control component rendering based on route match
          // match() recreates the component on every param change
          const baseRefSpec = match(shouldRender)((matchResult) => {
            if (!matchResult) return null;

            // Create params computed fresh for this match
            // Returns static value since matchResult is captured
            const params = computed(() => matchResult.params);

            // Create component API fresh each time
            const componentApi = {
              ...routeOpts,
              params,
              outlet,
              navigate,
            };

            // Create component with fresh api
            if ('create' in component && typeof component.create === 'function') {
              // Component has create method - wrap it in a RefSpec
              const refSpec: RefSpec<TConfig['baseElement']> = {
                status: STATUS_REF_SPEC,
                create: <TExt>() => {
                  const nodeRef = component.create(componentApi);
                  return nodeRef as typeof nodeRef & TExt;
                },
              };

              return refSpec;
            } else {
              // Plain function pattern (backwards compatibility) - call it directly
              return (
                component as unknown as (
                  api: typeof componentApi
                ) => RefSpec<TConfig['baseElement']>
              )(componentApi);
            }
          });

          // Create wrapper that delegates to baseRefSpec via closure
          const routeSpec: RouteSpec<TConfig['baseElement']> = {
            status: STATUS_ROUTE_SPEC_CONST,
            routeMetadata: {
              relativePath,
              rebuild: (parentPath: string) =>
                route(parentPath, component)(...children),
            },
            // Unwrap method returns the wrapped RefSpec
            unwrap: () => baseRefSpec,
            // Delegate create method to base spec
            create: <TExt = Record<string, unknown>>(
              api?: unknown,
              extensions?: TExt
            ) => {
              return baseRefSpec.create(api, extensions);
            },
          };

          return routeSpec;
        };
      }

      const extension: RouteFactory<TConfig> = {
        name: 'route' as const,
        impl: route,
      };

      return extension;
    }
);
