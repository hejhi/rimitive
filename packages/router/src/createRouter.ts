/**
 * Router API - separate app-level API for routing
 */

import type {
  RendererConfig,
  RefSpec,
  LifecycleCallback,
} from '@lattice/view/types';
import { STATUS_REF_SPEC } from '@lattice/view/types';
import type {
  ElMethod,
  SignalFunction,
  ComputedFunction,
} from '@lattice/view/component';
import type { MatchFactory } from '@lattice/view/match';
import type { ShowFactory } from '@lattice/view/show';
import type { RouteParams, RouteSpec, RouteMatch } from './types';
import { STATUS_ROUTE_SPEC } from './types';
import { composePath, matchPath, matchPathPrefix } from './helpers/matching';
import type { RouteTree, RouteNode } from './defineRoutes';

/**
 * Standalone connect function - doesn't require a router instance
 *
 * Creates a connected component that receives routeApi and routeContext
 * when mounted via router.mount(). Works identically on server and client.
 *
 * @example
 * ```ts
 * import { connect } from '@lattice/router';
 *
 * export const Home = connect(({ navigate }, { params }) =>
 *   useSvc(({ el }) => () =>
 *     el('div')('Home page')
 *   )
 * );
 * ```
 */
export function connect<
  TConfig extends RendererConfig,
  TElement extends TConfig['baseElement'] = TConfig['baseElement'],
  TUserProps = Record<string, unknown>,
>(
  wrapper: (
    routeApi: RouteApi,
    routeContext: RouteContext<TConfig>
  ) => (userProps: TUserProps) => RefSpec<TElement>
): (
  ...args: [TUserProps?]
) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement> {
  return (...args: [TUserProps?]) =>
    (routeContext: RouteContext<TConfig>) => {
      // routeApi is always populated by router.mount()
      const routeApi = routeContext.routeApi!;
      const componentFactory = wrapper(routeApi, routeContext);
      const userProps = args[0] ?? ({} as TUserProps);
      return componentFactory(userProps);
    };
}

/**
 * View API that the router depends on
 */
export type ViewApi<TConfig extends RendererConfig> = {
  el: ElMethod<TConfig>;
  match: MatchFactory<TConfig['baseElement']>['impl'];
  show: ShowFactory<TConfig['baseElement']>['impl'];
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
 *
 * Includes optional routeApi for server-side rendering where components
 * are defined at module load time but need access to per-request router state.
 */
export type RouteContext<TConfig extends RendererConfig> = {
  children: RefSpec<TConfig['baseElement']>[] | null;
  params: ComputedFunction<RouteParams>;
  /** Route API - included when context is created by a router instance */
  routeApi?: RouteApi;
};

/**
 * A connected component that can be instantiated with route context
 */
export type ConnectedComponent<TConfig extends RendererConfig> = (
  routeContext: RouteContext<TConfig>
) => RefSpec<TConfig['baseElement']>;

/**
 * The connect impl signature
 */
export type ConnectMethod<TConfig extends RendererConfig> = <
  TElement extends TConfig['baseElement'],
  TUserProps = Record<string, unknown>,
>(
  wrapper: (
    routeApi: RouteApi,
    routeContext: RouteContext<TConfig>
  ) => (userProps: TUserProps) => RefSpec<TElement>
) => (
  ...args: [TUserProps?]
) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement>;

/**
 * Route method signature
 */
export type RouteMethod<TConfig extends RendererConfig> = (
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
export type RootContext<TConfig extends RendererConfig> = {
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
export type RootMethod<TConfig extends RendererConfig> = (
  path: string,
  connectedComponent: (
    routeContext: RouteContext<TConfig>
  ) => RefSpec<TConfig['baseElement']>
) => RootContext<TConfig>;

/**
 * Router object returned by createRouter
 * Generic over TConfig for type safety with renderer-specific implementations
 */
export type Router<TConfig extends RendererConfig> = {
  /**
   * Define the root layout that's always rendered
   * Unlike route(), root() doesn't wrap in show() since the root is always visible
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
      // Include routeApi so server-side components can access current path
      const routeContext: RouteContext<TConfig> = {
        children: processedChildren.length > 0 ? processedChildren : null,
        params: viewApi.computed(() => shouldRender()?.params ?? {}),
        routeApi: { navigate, currentPath },
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
      componentRefSpec.create = <TExt>(api?: unknown) => {
        const nodeRef = sealedSpec.create(api);
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
    TUserProps = Record<string, unknown>,
  >(
    wrapper: (
      routeApi: RouteApi,
      routeContext: RouteContext<TConfig>
    ) => (userProps: TUserProps) => RefSpec<TElement>
  ): (
    ...args: [TUserProps?]
  ) => (routeContext: RouteContext<TConfig>) => RefSpec<TElement> {
    return (...args: [TUserProps?]) =>
      (routeContext: RouteContext<TConfig>) => {
        const routeApi: RouteApi = { navigate, currentPath };
        const componentFactory = wrapper(routeApi, routeContext);
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
   * Unlike route(), root() doesn't wrap the component in show() since
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

      // Save and reset route group for children
      const savedRouteGroup = activeRouteGroup;
      const savedGroupDepth = groupCreationDepth;

      for (const child of children) {
        const metadata = child.routeMetadata;

        // Reset route group so children form their own group
        activeRouteGroup = null;
        groupCreationDepth = 0;

        // Rebuild with composed path
        const composedPath = composePath(path, metadata.relativePath);
        const rebuiltRouteSpec = metadata.rebuild(composedPath);
        // Unwrap to get the inner RefSpec for the renderer
        processedChildren.push(rebuiltRouteSpec.unwrap());
      }

      // Restore the route group
      activeRouteGroup = savedRouteGroup;
      groupCreationDepth = savedGroupDepth;

      // Build RouteContext for the root component
      // Root always matches, so params are empty
      // Include routeApi so server-side components can access current path
      const routeContext: RouteContext<TConfig> = {
        children: processedChildren.length > 0 ? processedChildren : null,
        params: viewApi.computed(() => ({})),
        routeApi: { navigate, currentPath },
      };

      // Return the component RefSpec directly (not wrapped in show())
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

        // Build route context
        const routeContext: RouteContext<TConfig> = {
          children: childRefSpecs.length > 0 ? childRefSpecs : null,
          params: viewApi.computed(() => shouldRender()?.params ?? {}),
          routeApi: { navigate, currentPath },
        };

        // Create the component RefSpec
        const componentRefSpec = node.component(routeContext);

        // Wrap in show() for conditional rendering
        return viewApi.show(
          viewApi.computed(() => shouldRender() !== null),
          componentRefSpec
        );
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
      routeApi: { navigate, currentPath },
    };

    // Return the root component (not wrapped in show - always visible)
    return routeTree.rootComponent(rootContext);
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
  };
}
