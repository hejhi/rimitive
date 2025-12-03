/**
 * Router API - separate app-level API for routing
 */

import type { AdapterConfig, RefSpec } from '@lattice/view/types';
import type {
  ElMethod,
  SignalFunction,
  ComputedFunction,
} from '@lattice/view/component';
import type { MatchFactory } from '@lattice/view/match';
import type { RouteParams, RouteSpec, RouteMatch } from './types';
import { STATUS_ROUTE_SPEC } from './types';
import { composePath, matchPath, matchPathPrefix } from './helpers/matching';
import type { RouteTree, RouteNode } from './defineRoutes';

/**
 * Standalone connect function - doesn't require a router instance
 *
 * Creates a connected component that receives route context (children, params)
 * when mounted via router.mount(). Works identically on server and client.
 *
 * @example
 * ```ts
 * import { connect } from '@lattice/router';
 * import { el } from './service';
 *
 * export const Home = connect(({ params }) => () =>
 *   el('div')(`Product: ${params().id}`)
 * );
 * ```
 */
export function connect<
  TConfig extends AdapterConfig,
  TElement extends TConfig['baseElement'] = TConfig['baseElement'],
  TUserProps = Record<string, unknown>,
>(
  wrapper: (
    routeContext: RouteContext<TConfig>
  ) => (userProps: TUserProps) => RefSpec<TElement>
): (
  ...args: [TUserProps?]
) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement> {
  return (...args: [TUserProps?]) =>
    (routeContext: RouteContext<TConfig>) => {
      const componentFactory = wrapper(routeContext);
      const userProps = args[0] ?? ({} as TUserProps);
      return componentFactory(userProps);
    };
}

/**
 * View API that the router depends on
 */
export type ViewApi<TConfig extends AdapterConfig> = {
  el: ElMethod<TConfig>;
  match: MatchFactory<TConfig['baseElement']>['impl'];
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
 * Route API - navigation and path signals
 */
export type RouteApi = {
  navigate: (path: string) => void;
  currentPath: ComputedFunction<string>;
};

/**
 * Connected API - merged view API + route API
 *
 * This is the API passed to connected components, enabling them to use
 * whatever adapter is provided (hydrating or regular) rather than
 * pulling from a singleton.
 */
export type ConnectedApi<TConfig extends AdapterConfig> = ViewApi<TConfig> &
  RouteApi;

/**
 * Route context passed to connect wrapper
 *
 * Contains route-specific data (children, params) and the merged API
 * for rendering. The API is always populated by router.mount().
 */
export type RouteContext<TConfig extends AdapterConfig> = {
  children: RefSpec<TConfig['baseElement']>[] | null;
  params: ComputedFunction<RouteParams>;
  /** Merged API (view + route) - populated by router.mount() */
  api?: ConnectedApi<TConfig>;
};

/**
 * A connected component that can be instantiated with route context
 */
export type ConnectedComponent<TConfig extends AdapterConfig> = (
  routeContext: RouteContext<TConfig>
) => RefSpec<TConfig['baseElement']>;

/**
 * The connect impl signature
 */
export type ConnectMethod<TConfig extends AdapterConfig> = <
  TElement extends TConfig['baseElement'],
  TUserProps = Record<string, unknown>,
>(
  wrapper: (
    routeContext: RouteContext<TConfig>
  ) => (userProps: TUserProps) => RefSpec<TElement>
) => (
  ...args: [TUserProps?]
) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement>;

/**
 * Route method signature
 */
export type RouteMethod<TConfig extends AdapterConfig> = (
  path: string,
  connectedComponent: (
    routeContext: RouteContext<TConfig>
  ) => RefSpec<TConfig['baseElement']>
) => (
  ...children: RouteSpec<TConfig['baseElement']>[]
) => RouteSpec<TConfig['baseElement']>;

/**
 * Root context returned by router.root()
 * Provides scoped route creation and a create method for finalizing the route tree
 */
export type RootContext<TConfig extends AdapterConfig> = {
  /**
   * Create the root element with its child routes
   * Returns a RefSpec that renders the root layout with children
   */
  create: (
    ...children: RouteSpec<TConfig['baseElement']>[]
  ) => RefSpec<TConfig['baseElement']>;

  /**
   * Scoped route function for defining child routes within this root
   */
  route: RouteMethod<TConfig>;
};

/**
 * Root method signature - defines the always-rendered root layout
 */
export type RootMethod<TConfig extends AdapterConfig> = (
  path: string,
  connectedComponent: (
    routeContext: RouteContext<TConfig>
  ) => RefSpec<TConfig['baseElement']>
) => RootContext<TConfig>;

/**
 * Router object returned by createRouter
 * Generic over TConfig for type safety with adapter-specific implementations
 */
export type Router<TConfig extends AdapterConfig> = {
  /**
   * Define the root layout that's always rendered
   * Unlike route(), root() doesn't wrap in match() since the root is always visible
   */
  root: RootMethod<TConfig>;

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
   * Get a reactive current path signal that works in both SSR and client contexts
   *
   * @param initialPath - The initial path value to use during SSR (typically from props)
   * @returns A computed signal containing the current path
   *
   * On client: Returns the router's reactive currentPath
   * On server: Returns a computed wrapping the initialPath
   *
   * This abstracts away environment detection from user code.
   */
  useCurrentPath: (initialPath: string) => ComputedFunction<string>;

  /**
   * Mount a route tree defined with defineRoutes()
   *
   * Binds pure route data to this router instance, creating all reactive
   * bindings for route matching, navigation, and rendering.
   *
   * @param routeTree - Route tree from defineRoutes().create()
   * @returns RefSpec that renders the complete route tree
   *
   * @example
   * ```ts
   * import { appRoutes } from './routes';
   *
   * const App = router.mount(appRoutes);
   * mount(App);
   * ```
   */
  mount: (routeTree: RouteTree<TConfig>) => RefSpec<TConfig['baseElement']>;

  /**
   * Render a RefSpec with the router's connected API
   *
   * Use this instead of the view service's mount() to ensure Link components
   * receive the navigate function and can intercept clicks.
   *
   * @param spec - The RefSpec to render (typically from router.root().create())
   * @returns ElementRef ready to append to DOM
   *
   * @example
   * ```ts
   * const App = router.root('/', AppLayout).create(
   *   route('/', Home)(),
   *   route('*', NotFound)()
   * );
   * const appRef = router.renderApp(App);
   * container.appendChild(appRef.element);
   * ```
   */
  renderApp: <TElement extends TConfig['baseElement']>(
    spec: RefSpec<TElement>
  ) => ReturnType<RefSpec<TElement>['create']>;

  /**
   * Internal: adapter config type marker (not used at runtime)
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
    return (
      window.location.pathname + window.location.search + window.location.hash
    );
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
export function createRouter<TConfig extends AdapterConfig>(
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

  // Merged API (view + route) passed to connected components
  // This enables hydration - components use whatever API is provided
  const connectedApi: ConnectedApi<TConfig> = {
    ...viewApi,
    navigate,
    currentPath,
  };

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
    connectedComponent: (
      routeContext: RouteContext<TConfig>
    ) => RefSpec<TConfig['baseElement']>
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
          // Unwrap to get the inner RefSpec for the adapter
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

      // Use match() to control component rendering based on route match
      // match() recreates the component on every param change
      const baseRefSpec = viewApi.match(shouldRender)((matchResult) => {
        if (!matchResult) return null;

        // Build RouteContext fresh for each match
        // Include merged API so components can render with appropriate adapter
        const routeContext: RouteContext<TConfig> = {
          children: processedChildren.length > 0 ? processedChildren : null,
          params: viewApi.computed(() => matchResult.params),
          api: connectedApi,
        };

        // Instantiate the connected component with route context
        const sealedSpec = connectedComponent(routeContext);

        // Return the sealed spec directly - lifecycle callbacks use .ref() on elements
        return sealedSpec;
      });

      // Create wrapper that delegates to baseRefSpec via closure
      const routeSpec: RouteSpec<TConfig['baseElement']> = {
        status: STATUS_ROUTE_SPEC,
        routeMetadata: {
          relativePath,
          rebuild: (parentPath: string) =>
            route(parentPath, connectedComponent)(...children),
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

  /**
   * Connect method - wraps a component to receive route context
   *
   * Takes a wrapper function that receives route context (children, params),
   * and returns a function that can be called with user props.
   */
  function connect<
    TElement extends TConfig['baseElement'],
    TUserProps = Record<string, unknown>,
  >(
    wrapper: (
      routeContext: RouteContext<TConfig>
    ) => (userProps: TUserProps) => RefSpec<TElement>
  ): (
    ...args: [TUserProps?]
  ) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement> {
    return (...args: [TUserProps?]) =>
      (routeContext: RouteContext<TConfig>) => {
        const componentFactory = wrapper(routeContext);
        // Use empty object as default if no props provided
        const userProps = args[0] ?? ({} as TUserProps);
        return componentFactory(userProps);
      };
  }

  /**
   * useCurrentPath - Get a reactive current path that works in both SSR and client
   *
   * Abstracts away environment detection from user code.
   *
   * @param initialPath - The initial path value to use during SSR (from props)
   * @returns A computed signal containing the current path
   */
  function useCurrentPath(initialPath: string): ComputedFunction<string> {
    return viewApi.computed(() =>
      typeof window === 'undefined' ? initialPath : currentPath()
    );
  }

  /**
   * Root method - defines the root layout that's always rendered
   *
   * Unlike route(), root() doesn't wrap the component in match() since
   * the root layout is always visible. This solves the SSR issue where
   * fragments at the root level have no parent to attach to.
   *
   * Returns an object with:
   * - create: finalizes the route tree and returns a RefSpec (element, not fragment)
   * - route: scoped route function for defining child routes
   */
  function root(
    path: string,
    connectedComponent: (
      routeContext: RouteContext<TConfig>
    ) => RefSpec<TConfig['baseElement']>
  ): RootContext<TConfig> {
    /**
     * Create the root element with its child routes
     */
    const create = (
      ...children: RouteSpec<TConfig['baseElement']>[]
    ): RefSpec<TConfig['baseElement']> => {
      // Process children - compose their paths with the root path
      const processedChildren: RefSpec<TConfig['baseElement']>[] = [];

      // Save current route group state
      const savedRouteGroup = activeRouteGroup;
      const savedGroupDepth = groupCreationDepth;

      // Reset route group ONCE before processing - all children are siblings
      // in the same group and compete for matching
      activeRouteGroup = null;
      groupCreationDepth = 0;

      for (const child of children) {
        const metadata = child.routeMetadata;

        // Rebuild with composed path (route group is shared across siblings)
        const composedPath = composePath(path, metadata.relativePath);
        const rebuiltRouteSpec = metadata.rebuild(composedPath);
        // Unwrap to get the inner RefSpec for the adapter
        processedChildren.push(rebuiltRouteSpec.unwrap());
      }

      // Restore the route group
      activeRouteGroup = savedRouteGroup;
      groupCreationDepth = savedGroupDepth;

      // Build RouteContext for the root component
      // Root always matches, so params are empty
      // Include merged API so components can render with appropriate adapter
      const routeContext: RouteContext<TConfig> = {
        children: processedChildren.length > 0 ? processedChildren : null,
        params: viewApi.computed(() => ({})),
        api: connectedApi,
      };

      // Return the component RefSpec directly (not wrapped in match())
      return connectedComponent(routeContext);
    };

    return {
      create,
      route, // Same route function - path composition happens in create()
    };
  }

  /**
   * Mount a route tree defined with defineRoutes()
   *
   * Binds pure route data to this router instance, creating all reactive
   * bindings for route matching, navigation, and rendering.
   */
  function mount(routeTree: RouteTree<TConfig>): RefSpec<TConfig['baseElement']> {
    /**
     * Process a group of sibling routes - creates reactive matching logic
     */
    function processRouteGroup(
      parentPath: string,
      nodes: RouteNode<TConfig>[]
    ): RefSpec<TConfig['baseElement']>[] {
      // Route group state - sibling routes compete for matching
      const routeGroup: Array<{
        id: string;
        pathPattern: string;
        matchedPath: ComputedFunction<RouteMatch | null>;
      }> = [];

      return nodes.map((node, index) => {
        const fullPath = composePath(parentPath, node.path);
        const routeId = `route-${index}`;
        const hasChildren = node.children.length > 0;

        // Compute whether this route matches
        const matchedPath = viewApi.computed(() => {
          const current = currentPath();
          return hasChildren
            ? matchPathPrefix(fullPath, current)
            : matchPath(fullPath, current);
        });

        // Register in route group
        routeGroup.push({
          id: routeId,
          pathPattern: fullPath,
          matchedPath,
        });

        // Capture current group state for this route's shouldRender
        const myRoutes = routeGroup;
        const myRouteId = routeId;

        // Compute whether this route should render (first match wins, wildcards last)
        const shouldRender = viewApi.computed(() => {
          // Trigger reactivity
          currentPath();

          // Separate wildcard and normal routes
          const wildcardRoutes: typeof myRoutes = [];
          const normalRoutes: typeof myRoutes = [];

          for (const r of myRoutes) {
            if (r.pathPattern === '*' || r.pathPattern.endsWith('/*')) {
              wildcardRoutes.push(r);
            } else {
              normalRoutes.push(r);
            }
          }

          // Check normal routes first
          let normalRouteMatched = false;
          for (const r of normalRoutes) {
            const match = r.matchedPath.peek();
            if (match !== null) {
              normalRouteMatched = true;
              return r.id === myRouteId ? match : null;
            }
          }

          // Only check wildcards if no normal route matched
          if (!normalRouteMatched) {
            for (const r of wildcardRoutes) {
              const match = r.matchedPath.peek();
              if (match !== null) {
                return r.id === myRouteId ? match : null;
              }
            }
          }

          return null;
        });

        // Process children recursively
        const childRefSpecs = hasChildren
          ? processRouteGroup(fullPath, node.children)
          : [];

        // Use match() for conditional rendering - recreates component on param change
        return viewApi.match(shouldRender)((matchResult) => {
          if (!matchResult) return null;

          // Build route context fresh for each match
          const routeContext: RouteContext<TConfig> = {
            children: childRefSpecs.length > 0 ? childRefSpecs : null,
            params: viewApi.computed(() => matchResult.params),
            api: connectedApi,
          };

          // Create the component RefSpec
          return node.component(routeContext);
        });
      });
    }

    // Process the root's children
    const childRefSpecs = processRouteGroup(
      routeTree.rootPath,
      routeTree.children
    );

    // Build root context
    const rootContext: RouteContext<TConfig> = {
      children: childRefSpecs.length > 0 ? childRefSpecs : null,
      params: viewApi.computed(() => ({})),
      api: connectedApi,
    };

    // Return the root component (not wrapped in match - always visible)
    return routeTree.rootComponent(rootContext);
  }

  /**
   * Render a RefSpec with the router's connected API
   *
   * Passes connectedApi (which includes navigate) to spec.create(),
   * ensuring Link components can intercept clicks for SPA navigation.
   */
  function renderApp<TElement extends TConfig['baseElement']>(
    spec: RefSpec<TElement>
  ): ReturnType<RefSpec<TElement>['create']> {
    return spec.create(connectedApi);
  }

  // Return the router object
  return {
    root,
    route,
    connect,
    navigate,
    currentPath,
    useCurrentPath,
    mount,
    renderApp,
  };
}
