/**
 * Route parameter map extracted from path patterns
 * e.g., '/products/:id' -> { id: string }
 */
export type RouteParams = Record<string, string>;

/**
 * Matched route information
 */
export interface RouteMatch {
  path: string;
  params: RouteParams;
}

/**
 * Route configuration options
 */
export type RouteConfig = Record<string, never>;
// Future: guards, meta, etc.
