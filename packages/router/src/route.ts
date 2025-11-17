/**
 * Route matching utilities and route rendering primitives
 */

import { create } from '@lattice/lattice';
import type { RendererConfig, RefSpec, LifecycleCallback } from '@lattice/view/types';

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

// Re-export for backward compatibility and public API
export { matchPath } from './helpers/matching';
export type { RouteOpts, RouteComponent, RouteFactory } from './types';

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
      // Create navigate function that updates path and history
      const navigate = (path: string): void => {
        currentPath(path);
        window.history.pushState({}, '', path);
      };

      // Shared state for tracking route groups
      // Routes created in the same synchronous tick are considered siblings
      let activeRouteGroup: Array<{
        id: string;
        pathPattern: string;
        matchedPath: ComputedFunction<RouteMatch | null>;
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
              const isRouteSpec = (child.status & STATUS_ROUTE_SPEC_CONST) === STATUS_ROUTE_SPEC_CONST;

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
            matchedPath: ComputedFunction<RouteMatch | null>;
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

          // Create params computed - reactive, updates automatically when path changes
          const params = computed(() => {
            const match = shouldRender();
            return match?.params ?? {};
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
              return el('div' as never)(...processedChildren) as RefSpec<TConfig['baseElement']>;
            });
          };

          // Create component ONCE - runs only when route is defined, not on every navigation
          // Component functions should only run once per component instance
          const componentRef = component({ el, params, outlet, navigate });

          // Use match() to control component visibility based on route match
          const baseRefSpec = match(shouldRender)((pathMatch) => {
            if (pathMatch === null) {
              return null;
            }
            return componentRef;
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
          routeSpec.status = STATUS_ROUTE_SPEC_CONST;
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
