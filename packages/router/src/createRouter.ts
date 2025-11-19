/**
 * Router API - separate app-level API for routing
 */

import type { RendererConfig, RefSpec, SealedSpec, LifecycleCallback } from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type { ElMethod, SignalFunction, ComputedFunction } from '@lattice/view/component';
import type { MatchFactory } from '@lattice/view/match';
import type { ShowFactory } from '@lattice/view/show';
import type { RouteParams, RouteSpec, RouteMatch } from './types';
import { STATUS_ROUTE_SPEC } from './types';
import { composePath, matchPath, matchPathPrefix } from './helpers/matching';

/**
 * View API that the router depends on
 */
export type ViewApi<TConfig extends RendererConfig> = {
  el: ElMethod<TConfig>;
  match: MatchFactory<TConfig['baseElement']>['method'];
  show: ShowFactory<TConfig['baseElement']>['method'];
  signal: <T>(value: T) => SignalFunction<T>;
  computed: <T>(fn: () => T) => ComputedFunction<T>;
};

/**
 * Router configuration
 */
export type RouterConfig = {
  /**
   * Initial path for SSR or testing
   * If not provided, uses window.location.pathname + search + hash in browser
   */
  initialPath?: string;
};

/**
 * Route API passed to connect wrapper
 */
export type RouteApi = {
  navigate: (path: string) => void;
  currentPath: ComputedFunction<string>;
};

/**
 * Route context passed to connect wrapper
 */
export type RouteContext<TConfig extends RendererConfig> = {
  children: RefSpec<TConfig['baseElement']>[] | null;
  params: ComputedFunction<RouteParams>;
};

/**
 * A connected component that can be instantiated with route context
 */
export type ConnectedComponent<TConfig extends RendererConfig> =
  (routeContext: RouteContext<TConfig>) => SealedSpec<TConfig['baseElement']>;

/**
 * The connect method signature
 */
export type ConnectMethod<TConfig extends RendererConfig> = <
  TElement extends TConfig['baseElement'],
  TUserProps = {},
>(
  wrapper: (
    routeApi: RouteApi,
    routeContext: RouteContext<TConfig>
  ) => (userProps: TUserProps) => SealedSpec<TElement>
) => (
  // Make userProps optional when it's empty {}, required otherwise
  ...args: TUserProps extends Record<string, never>
    ? [userProps?: TUserProps]
    : [userProps: TUserProps]
) => (routeContext: RouteContext<TConfig>) => SealedSpec<TElement>;

/**
 * Route method signature
 */
export type RouteMethod<TConfig extends RendererConfig> = (
  path: string,
  connectedComponent: (routeContext: RouteContext<TConfig>) => SealedSpec<TConfig['baseElement']>
) => (
  ...children: RouteSpec<TConfig['baseElement']>[]
) => RouteSpec<TConfig['baseElement']>;

/**
 * Router object returned by createRouter
 * Generic over TConfig for type safety with renderer-specific implementations
 */
export type Router<TConfig extends RendererConfig> = {
  /**
   * Define a route
   */
  route: RouteMethod<TConfig>;

  /**
   * Connect a component to the router
   */
  connect: ConnectMethod<TConfig>;

  /**
   * Navigate to a new path
   */
  navigate: (path: string) => void;

  /**
   * Reactive signal for the current path
   */
  currentPath: ComputedFunction<string>;

  /**
   * Internal: renderer config type marker (not used at runtime)
   * This ensures TConfig is part of the type signature for type safety
   */
  _configType?: TConfig;
};

/**
 * Get the initial path from browser or config
 */
function getInitialPath(config: RouterConfig): string {
  if (config.initialPath !== undefined) {
    return config.initialPath;
  }

  // Browser environment - read from window.location
  if (typeof window !== 'undefined' && window.location) {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  // Default to root path (SSR or non-browser environment)
  return '/';
}

/**
 * Create a router instance
 *
 * The router is a separate app-level API that takes a view API as input.
 * It manages navigation state and provides routing primitives.
 */
export function createRouter<TConfig extends RendererConfig>(
  viewApi: ViewApi<TConfig>,
  config: RouterConfig = {}
): Router<TConfig> {
  // Internal signal for current path (writable)
  const currentPathSignal = viewApi.signal<string>(getInitialPath(config));

  // Public computed for current path (read-only)
  const currentPath = viewApi.computed(() => currentPathSignal());

  /**
   * Navigate to a new path
   * Updates both the currentPath signal and browser history
   */
  function navigate(path: string): void {
    // Update the signal first
    currentPathSignal(path);

    // Update browser history if available
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', path);
    }
  }

  // Set up popstate listener for browser back/forward buttons
  // This updates currentPath without calling pushState
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      const fullPath =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      // Only update signal, don't call pushState
      currentPathSignal(fullPath);
    });
  }

  // Shared state for tracking route groups
  // Routes created in the same synchronous tick are considered siblings
  let activeRouteGroup: Array<{
    id: string;
    pathPattern: string;
    matchedPath: ComputedFunction<RouteMatch | null>;
  }> | null = null;
  let groupCreationDepth = 0;

  /**
   * Route method - defines a route with path pattern and connected component
   */
  function route(
    path: string,
    connectedComponent: (routeContext: RouteContext<TConfig>) => SealedSpec<TConfig['baseElement']>
  ) {
    return (...children: RouteSpec<TConfig['baseElement']>[]) => {
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
          // All children are RouteSpecs since that's what the function signature accepts
          const metadata = child.routeMetadata;

          // Reset route group so children form their own group
          activeRouteGroup = null;
          groupCreationDepth = 0;

          // Rebuild with composed path, then unwrap
          const composedPath = composePath(path, metadata.relativePath);
          const rebuiltRouteSpec = metadata.rebuild(composedPath);
          // Unwrap to get the inner RefSpec for the renderer
          processedChildren.push(rebuiltRouteSpec.unwrap());
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
      const matchedPath = viewApi.computed(() => {
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
      const shouldRender = viewApi.computed(() => {
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

      // Build RouteContext to pass to connected component
      const routeContext: RouteContext<TConfig> = {
        children: processedChildren.length > 0 ? processedChildren : null,
        params: viewApi.computed(() => shouldRender()?.params ?? {}),
      };

      // Instantiate the connected component with route context
      const sealedSpec = connectedComponent(routeContext);

      // Wrap sealedSpec in lifecycle callback collector for show()
      const lifecycleCallbacks: LifecycleCallback<TConfig['baseElement']>[] =
        [];

      const componentRefSpec: RefSpec<TConfig['baseElement']> = (
        ...callbacks: LifecycleCallback<TConfig['baseElement']>[]
      ) => {
        lifecycleCallbacks.push(...callbacks);
        return componentRefSpec;
      };

      componentRefSpec.status = STATUS_REF_SPEC;
      componentRefSpec.create = <TExt>() => {
        const nodeRef = sealedSpec.create();
        // Apply lifecycle callbacks
        for (const callback of lifecycleCallbacks) {
          callback(nodeRef);
        }
        return nodeRef as typeof nodeRef & TExt;
      };

      // Use show() to control component visibility based on route match
      const baseRefSpec = viewApi.show(
        viewApi.computed(() => shouldRender() !== null),
        componentRefSpec
      );

      // Create true wrapper that delegates to baseRefSpec via closure
      const routeSpec: RouteSpec<TConfig['baseElement']> = (
        ...lifecycleCallbacks: LifecycleCallback<TConfig['baseElement']>[]
      ) => {
        // Delegate to base spec and return this wrapper for chaining
        baseRefSpec(...lifecycleCallbacks);
        return routeSpec;
      };

      // Set properties
      routeSpec.status = STATUS_ROUTE_SPEC;
      routeSpec.routeMetadata = {
        relativePath,
        rebuild: (parentPath: string) =>
          route(parentPath, connectedComponent)(...children),
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

  /**
   * Connect method - implements the outer wrapper pattern
   *
   * Takes a wrapper function that receives route API and route context,
   * and returns a function that can be called with user props to create
   * a connected component.
   */
  function connect<
    TElement extends TConfig['baseElement'],
    TUserProps = {}
  >(
    wrapper: (
      routeApi: RouteApi,
      routeContext: RouteContext<TConfig>
    ) => (userProps: TUserProps) => SealedSpec<TElement>
  ): (
    ...args: TUserProps extends Record<string, never>
      ? [userProps?: TUserProps]
      : [userProps: TUserProps]
  ) => (routeContext: RouteContext<TConfig>) => SealedSpec<TElement> {
    return (...args: [TUserProps?]) => (routeContext: RouteContext<TConfig>) => {
      const routeApi: RouteApi = { navigate, currentPath };
      const componentFactory = wrapper(routeApi, routeContext);
      // Use empty object as default if no props provided
      const userProps = args[0] ?? ({} as TUserProps);
      return componentFactory(userProps);
    };
  }

  // Return the router object
  return {
    route,
    connect,
    navigate,
    currentPath,
  };
}
