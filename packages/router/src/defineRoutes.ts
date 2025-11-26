/**
 * Route Definition API
 *
 * Provides pure data structures for defining routes without requiring a router instance.
 * Routes defined with defineRoutes() can be bound to a router via router.mount().
 *
 * This separation enables:
 * - Universal route definitions (same code for client and server)
 * - No singleton router needed at module load time
 * - Clean SSR without proxy patterns
 */

import type { RendererConfig, RefSpec } from '@lattice/view/types';
import type { RouteContext } from './createRouter';

/**
 * Connected component type - a function that receives route context
 */
export type ConnectedComponent<TConfig extends RendererConfig> = (
  routeContext: RouteContext<TConfig>
) => RefSpec<TConfig['baseElement']>;

/**
 * A single route node in the tree
 */
export interface RouteNode<TConfig extends RendererConfig> {
  /** The path pattern for this route (relative) */
  path: string;
  /** The component to render when this route matches */
  component: ConnectedComponent<TConfig>;
  /** Child routes */
  children: RouteNode<TConfig>[];
}

/**
 * The complete route tree returned by defineRoutes().create()
 */
export interface RouteTree<TConfig extends RendererConfig> {
  /** Root path (typically '/') */
  rootPath: string;
  /** Root layout component */
  rootComponent: ConnectedComponent<TConfig>;
  /** Child routes */
  children: RouteNode<TConfig>[];
}

/**
 * A route builder - returned by route() before children are applied
 */
export interface RouteBuilder<TConfig extends RendererConfig> {
  (...children: RouteBuilder<TConfig>[]): RouteBuilder<TConfig>;
  /** Internal: get the node data */
  _node: RouteNode<TConfig>;
}

/**
 * Context returned by defineRoutes() - mirrors router.root() API
 */
export interface DefineRoutesContext<TConfig extends RendererConfig> {
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
}

/**
 * Define routes without requiring a router instance
 *
 * Returns the same API shape as router.root() but produces pure data
 * that can be bound to a router later via router.mount().
 */
export function defineRoutes<TConfig extends RendererConfig>(
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
