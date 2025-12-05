import type { AdapterConfig, RefSpec } from '@lattice/view/types';
import type { RouteContext } from './createRouter';

/**
 * Connected component type - a function that receives route context
 */
export type ConnectedComponent<TConfig extends AdapterConfig> = (
  routeContext: RouteContext<TConfig>
) => RefSpec<TConfig['baseElement']>;

/**
 * A single route node in the tree
 */
export type RouteNode<TConfig extends AdapterConfig> = {
  /** The path pattern for this route (relative) */
  path: string;
  /** The component to render when this route matches */
  component: ConnectedComponent<TConfig>;
  /** Child routes */
  children: RouteNode<TConfig>[];
};

/**
 * The complete route tree returned by defineRoutes().create()
 */
export type RouteTree<TConfig extends AdapterConfig> = {
  /** Root path (typically '/') */
  rootPath: string;
  /** Root layout component */
  rootComponent: ConnectedComponent<TConfig>;
  /** Child routes */
  children: RouteNode<TConfig>[];
};

/**
 * A route builder - returned by route() before children are applied
 */
export type RouteBuilder<TConfig extends AdapterConfig> = {
  (...children: RouteBuilder<TConfig>[]): RouteBuilder<TConfig>;
  /** Internal: get the node data */
  _node: RouteNode<TConfig>;
};

export type DefineRoutesContext<TConfig extends AdapterConfig> = {
  /**
   * Create the route tree with child routes
   */
  create: (...children: RouteBuilder<TConfig>[]) => RouteTree<TConfig>;

  /**
   * Define a child route
   */
  route: (
    path: string,
    component: ConnectedComponent<TConfig>
  ) => (...children: RouteBuilder<TConfig>[]) => RouteBuilder<TConfig>;
};

/**
 * Define routes without requiring a router instance
 *
 * @example
 * ```typescript
 * import { defineRoutes } from '@lattice/router';
 * import { Layout, HomePage, AboutPage, ProductPage } from './components';
 *
 * const appRoutes = defineRoutes('/', Layout).create(
 *   defineRoutes.route('/', HomePage)(),
 *   defineRoutes.route('/about', AboutPage)(),
 *   defineRoutes.route('/products', ProductsLayout)(
 *     defineRoutes.route(':id', ProductPage)()
 *   )
 * );
 *
 * // Mount to router later
 * const App = router.mount(appRoutes);
 * ```
 */
export function defineRoutes<TConfig extends AdapterConfig>(
  rootPath: string,
  rootComponent: ConnectedComponent<TConfig>
): DefineRoutesContext<TConfig> {
  /**
   * Create a route builder for a path and component
   */
  function route(
    path: string,
    component: ConnectedComponent<TConfig>
  ): (...children: RouteBuilder<TConfig>[]) => RouteBuilder<TConfig> {
    return (...children: RouteBuilder<TConfig>[]): RouteBuilder<TConfig> => {
      const node: RouteNode<TConfig> = {
        path,
        component,
        children: children.map((child) => child._node),
      };

      // Create the builder function that can accept more children
      const builder: RouteBuilder<TConfig> = (
        ...moreChildren: RouteBuilder<TConfig>[]
      ) => {
        // If called with children, return a new builder with combined children
        if (moreChildren.length > 0) {
          return route(path, component)(
            ...children,
            ...moreChildren
          ) as RouteBuilder<TConfig>;
        }
        return builder;
      };

      builder._node = node;
      return builder;
    };
  }

  /**
   * Create the final route tree
   */
  function create(...children: RouteBuilder<TConfig>[]): RouteTree<TConfig> {
    return {
      rootPath,
      rootComponent,
      children: children.map((child) => child._node),
    };
  }

  return { create, route };
}
